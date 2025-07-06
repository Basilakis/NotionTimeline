import { createNotionClient, extractPageIdFromUrl, getTasks } from "./notion";
import { statusNotificationService } from "./statusNotifications";
import { storage } from "./storage";

interface TaskStatus {
  notionId: string;
  title: string;
  status: string;
  mainStatus: string;
  subStatus: string;
  projectName: string;
  assigneeEmail: string;
  userEmail: string;
  taskUrl: string;
  dueDate: string | null;
  priority: string | null;
  lastChecked: Date;
}

// In-memory store for tracking previous task statuses
const taskStatusCache = new Map<string, TaskStatus>();

export class StatusMonitor {
  private static instance: StatusMonitor;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  static getInstance(): StatusMonitor {
    if (!StatusMonitor.instance) {
      StatusMonitor.instance = new StatusMonitor();
    }
    return StatusMonitor.instance;
  }

  async startMonitoring(intervalMs: number = 30000) { // Check every 30 seconds
    if (this.isMonitoring) {
      console.log('[Status Monitor] Already monitoring');
      return;
    }

    this.isMonitoring = true;
    console.log(`[Status Monitor] Starting status monitoring (interval: ${intervalMs}ms)`);

    this.monitoringInterval = setInterval(async () => {
      await this.checkForStatusChanges();
    }, intervalMs);

    // Initial check
    await this.checkForStatusChanges();
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('[Status Monitor] Stopped status monitoring');
  }

  private async checkForStatusChanges() {
    try {
      // Get all user configurations to monitor their tasks
      const adminEmail = "basiliskan@gmail.com";
      const config = await storage.getConfiguration(adminEmail);
      
      if (!config) {
        return;
      }

      const notion = createNotionClient(config.notionSecret);
      const pageId = extractPageIdFromUrl(config.notionPageUrl);

      // Get current tasks from Notion
      const currentTasks = await getTasks(notion, pageId, adminEmail);

      for (const task of currentTasks) {
        const taskKey = task.notionId;
        const previousStatus = taskStatusCache.get(taskKey);

        const currentTaskStatus: TaskStatus = {
          notionId: task.notionId,
          title: task.title,
          status: task.status,
          mainStatus: task.mainStatus || task.status,
          subStatus: task.subStatus || task.status,
          projectName: this.extractProjectName(task),
          assigneeEmail: task.userEmail || adminEmail,
          userEmail: adminEmail,
          taskUrl: task.url || `https://notion.so/${task.notionId.replace(/-/g, '')}`,
          dueDate: task.dueDate,
          priority: task.priority,
          lastChecked: new Date()
        };

        // Check if status has changed
        if (previousStatus && previousStatus.status !== currentTaskStatus.status) {
          console.log(`[Status Monitor] Status change detected for task "${task.title}"`);
          console.log(`[Status Monitor] ${previousStatus.status} → ${currentTaskStatus.status}`);

          // Send status change notification
          await this.sendStatusChangeNotification(previousStatus, currentTaskStatus);
        }

        // Update cache with current status
        taskStatusCache.set(taskKey, currentTaskStatus);
      }

    } catch (error) {
      console.error('[Status Monitor] Error checking for status changes:', error);
    }
  }

  private async sendStatusChangeNotification(
    previousStatus: TaskStatus,
    currentStatus: TaskStatus
  ) {
    try {
      const notification = {
        taskTitle: currentStatus.title,
        projectName: currentStatus.projectName,
        oldStatus: previousStatus.status,
        newStatus: currentStatus.status,
        assigneeEmail: currentStatus.assigneeEmail,
        userEmail: currentStatus.userEmail,
        taskUrl: currentStatus.taskUrl,
        dueDate: currentStatus.dueDate || undefined,
        priority: currentStatus.priority || undefined
      };

      const success = await statusNotificationService.sendStatusChangeEmail(notification);
      
      if (success) {
        console.log(`[Status Monitor] Email notification sent for task "${currentStatus.title}"`);
      } else {
        console.log(`[Status Monitor] Failed to send email notification for task "${currentStatus.title}"`);
      }
    } catch (error) {
      console.error('[Status Monitor] Error sending status change notification:', error);
    }
  }

  private extractProjectName(task: any): string {
    // Try to extract project name from various sources
    if (task.projectName) return task.projectName;
    if (task.project?.title) return task.project.title;
    if (task.section) return task.section;
    return 'Unknown Project';
  }

  // Get current monitoring status
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      tasksTracked: taskStatusCache.size,
      lastCheck: Array.from(taskStatusCache.values()).reduce(
        (latest, task) => task.lastChecked > latest ? task.lastChecked : latest,
        new Date(0)
      )
    };
  }

  // Clear cache (useful for testing)
  clearCache() {
    taskStatusCache.clear();
    console.log('[Status Monitor] Cache cleared');
  }
}

export const statusMonitor = StatusMonitor.getInstance();