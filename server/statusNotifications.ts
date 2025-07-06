import { emailService } from './communications';

interface StatusChangeNotification {
  taskTitle: string;
  projectName: string;
  oldStatus: string;
  newStatus: string;
  assigneeEmail: string;
  userEmail: string;
  taskUrl: string;
  dueDate?: string;
  priority?: string;
}

export class StatusNotificationService {
  
  async sendStatusChangeEmail(notification: StatusChangeNotification): Promise<boolean> {
    const { taskTitle, projectName, oldStatus, newStatus, assigneeEmail, userEmail, taskUrl, dueDate, priority } = notification;
    
    // Determine the primary recipient (assignee or user)
    const recipientEmail = assigneeEmail || userEmail;
    
    if (!recipientEmail) {
      console.log('[Status Notification] No recipient email found, skipping notification');
      return false;
    }

    // Generate status change message
    const statusMessage = this.getStatusChangeMessage(oldStatus, newStatus);
    const urgencyLevel = this.getUrgencyLevel(newStatus, priority);
    
    const subject = `${urgencyLevel}Task Status Update: ${taskTitle}`;
    
    const htmlBody = this.generateEmailHTML({
      taskTitle,
      projectName,
      oldStatus,
      newStatus,
      statusMessage,
      taskUrl,
      dueDate,
      priority,
      urgencyLevel
    });

    const textBody = this.generateEmailText({
      taskTitle,
      projectName,
      oldStatus,
      newStatus,
      statusMessage,
      taskUrl,
      dueDate,
      priority
    });

    try {
      const success = await emailService.sendEmail(
        recipientEmail,
        subject,
        htmlBody,
        textBody
      );
      
      if (success) {
        console.log(`[Status Notification] Email sent to ${recipientEmail} for task "${taskTitle}"`);
      } else {
        console.error(`[Status Notification] Failed to send email to ${recipientEmail}`);
      }
      
      return success;
    } catch (error) {
      console.error('[Status Notification] Email sending error:', error);
      return false;
    }
  }

  private getStatusChangeMessage(oldStatus: string, newStatus: string): string {
    const messages = {
      'Planning': 'Task is now being planned and prepared',
      'In Progress': 'Work has started on this task',
      'Paused': 'Task has been temporarily paused',
      'Done': 'Task has been completed successfully!',
      'Canceled': 'Task has been canceled',
      'Backlog': 'Task has been moved to backlog'
    };
    
    return messages[newStatus as keyof typeof messages] || `Status changed from ${oldStatus} to ${newStatus}`;
  }

  private getUrgencyLevel(newStatus: string, priority?: string): string {
    if (newStatus === 'Done') return '✅ ';
    if (newStatus === 'Canceled') return '❌ ';
    if (priority === 'High') return '🔥 ';
    if (newStatus === 'In Progress') return '⚡ ';
    return '';
  }

  private generateEmailHTML(data: {
    taskTitle: string;
    projectName: string;
    oldStatus: string;
    newStatus: string;
    statusMessage: string;
    taskUrl: string;
    dueDate?: string;
    priority?: string;
    urgencyLevel: string;
  }): string {
    const { taskTitle, projectName, oldStatus, newStatus, statusMessage, taskUrl, dueDate, priority, urgencyLevel } = data;
    
    const statusColor = this.getStatusColor(newStatus);
    const priorityBadge = priority ? `<span style="background: ${priority === 'High' ? '#ef4444' : priority === 'Medium' ? '#f59e0b' : '#6b7280'}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${priority}</span>` : '';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Status Update</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #003319; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #003319; padding: 30px; border-radius: 10px; margin-bottom: 30px; text-align: center;">
        <div style="margin-bottom: 15px;">
            <img src="https://9e760ea8-1fc2-408e-8f04-d26e825e4da9-00-gcvaj0c4tpmq.picard.replit.dev/attached_assets/VertexDevelopments_1751826186443.png" alt="Vertex Developments" style="width: 120px; height: auto; margin-bottom: 10px;">
        </div>
        <h1 style="color: white; margin: 0; font-size: 24px;">${urgencyLevel}Task Status Update</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your task status has been updated</p>
    </div>
    
    <div style="background: #88B39D/20; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
        <h2 style="margin: 0 0 15px 0; color: #003319; font-size: 20px;">${taskTitle}</h2>
        <p style="margin: 0 0 15px 0; color: #003319/70;"><strong>Project:</strong> ${projectName}</p>
        
        <div style="display: flex; align-items: center; gap: 10px; margin: 20px 0;">
            <span style="background: #88B39D; color: #003319; padding: 4px 12px; border-radius: 20px; font-size: 14px;">${oldStatus}</span>
            <span style="color: #003319;">→</span>
            <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600;">${newStatus}</span>
            ${priorityBadge}
        </div>
        
        <p style="margin: 15px 0; color: #003319; font-size: 16px; font-style: italic;">${statusMessage}</p>
        
        ${dueDate ? `<p style="margin: 10px 0; color: #003319/70;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>` : ''}
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="${taskUrl}" style="background: #003319; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Task in Notion</a>
    </div>
    
    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; color: #64748b; font-size: 14px;">
        <p>This is an automated notification from your project management system.</p>
        <p>Stay updated with your project progress!</p>
    </div>
</body>
</html>`;
  }

  private generateEmailText(data: {
    taskTitle: string;
    projectName: string;
    oldStatus: string;
    newStatus: string;
    statusMessage: string;
    taskUrl: string;
    dueDate?: string;
    priority?: string;
  }): string {
    const { taskTitle, projectName, oldStatus, newStatus, statusMessage, taskUrl, dueDate, priority } = data;
    
    return `
TASK STATUS UPDATE

Task: ${taskTitle}
Project: ${projectName}

Status Change: ${oldStatus} → ${newStatus}
${statusMessage}

${priority ? `Priority: ${priority}` : ''}
${dueDate ? `Due Date: ${new Date(dueDate).toLocaleDateString()}` : ''}

View task in Notion: ${taskUrl}

---
This is an automated notification from your project management system.
`;
  }

  private getStatusColor(status: string): string {
    const colors = {
      'Planning': '#3b82f6',     // Blue
      'In Progress': '#f59e0b',  // Yellow
      'Done': '#10b981',         // Green
      'Canceled': '#ef4444',     // Red
      'Paused': '#8b5cf6',       // Purple
      'Backlog': '#6b7280'       // Gray
    };
    
    return colors[status as keyof typeof colors] || '#6b7280';
  }
}

export const statusNotificationService = new StatusNotificationService();