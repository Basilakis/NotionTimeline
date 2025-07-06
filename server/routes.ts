import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTaskSchema, insertConfigurationSchema, insertUserSchema } from "@shared/schema";
import { createNotionClient, createNotionAPI, getTasks as getNotionTasks, findDatabaseByTitle, extractPageIdFromUrl, getNotionDatabases, getFilteredDatabaseRecords, getProjectHierarchy, discoverWorkspacePages } from "./notion";
import { insertNotionViewSchema } from "@shared/schema";
import { z } from "zod";
import { userDB, type CRMUser } from "./userDatabase";
import { reminderDB, type Reminder } from "./reminderDatabase";
import { emailService, smsService } from "./communications";
import { statusNotificationService } from "./statusNotifications";

// Helper function to get admin configuration
async function getAdminConfiguration(): Promise<Configuration> {
  const config = await storage.getConfiguration('basiliskan@gmail.com');
  if (!config) {
    throw new Error('Admin configuration not found. Please set up workspace first.');
  }
  return config;
}

// Helper function to check if user is admin
function isAdminUser(userEmail: string): boolean {
  return userEmail === 'basiliskan@gmail.com';
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          message: "Email is required" 
        });
      }
      
      // Check for admin email
      if (email === "basiliskan@gmail.com") {
        let user = await storage.getUserByEmail(email);
        if (!user) {
          user = await storage.createUser({ 
            email: email, 
            name: "Admin User" 
          });
        } else {
          await storage.updateUserLastLogin(email);
        }
        
        res.json(user);
      } else {
        // For non-admin users, create or get user automatically
        let user = await storage.getUserByEmail(email);
        if (!user) {
          user = await storage.createUser({ 
            email: email, 
            name: null 
          });
        } else {
          await storage.updateUserLastLogin(email);
        }
        
        res.json(user);
      }
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  // Get current user info
  app.get("/api/auth/user", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await storage.getUserByEmail(userEmail);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get all tasks for a user
  app.get("/api/tasks", async (req, res) => {
    try {
      const { status } = req.query;
      const userEmail = req.headers['x-user-email'] as string;
      let tasks;
      
      if (status && typeof status === 'string') {
        tasks = await storage.getTasksByStatus(status, userEmail);
      } else {
        tasks = await storage.getTasks(userEmail);
      }
      
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Get tasks directly from Notion databases
  app.get("/api/tasks-from-notion", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      // Get user's Notion configuration
      let config = await storage.getConfiguration(userEmail);
      if (!config) {
        config = await getAdminConfiguration();
        if (!config) {
          return res.status(404).json({ message: "Notion configuration not found" });
        }
      }

      const notion = createNotionClient(config.notionSecret);
      
      // Force refresh by adding timestamp to prevent any caching
      const forceRefresh = Date.now();
      console.log(`[Notion Tasks] Force refresh timestamp: ${forceRefresh}`);
      
      // Add aggressive cache-busting headers
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Last-Modified', new Date().toUTCString());
      res.setHeader('ETag', `"${Date.now()}-${Math.random()}"`);
      
      // First, get all user's projects to extract task IDs
      const pageId = extractPageIdFromUrl(config.notionPageUrl);
      const databaseRecords = await getFilteredDatabaseRecords(notion, pageId, userEmail);
      
      const allTaskIds = new Set<string>();
      for (const record of databaseRecords) {
        const taskRelations = record.properties?.Tasks?.relation || [];
        for (const taskRef of taskRelations) {
          allTaskIds.add(taskRef.id);
        }
      }

      console.log(`[Notion Tasks] Found ${allTaskIds.size} task IDs from user projects`);

      // Fetch each task from Notion
      const tasks = [];
      for (const taskId of allTaskIds) {
        try {
          // Force fresh data by bypassing any potential caching
          console.log(`[Notion Tasks] Fetching task ${taskId} at ${new Date().toISOString()}`);
          const page = await notion.pages.retrieve({ page_id: taskId });
          const properties = (page as any).properties || {};
          
          // Extract task details
          const titleProperty = properties.Title || properties.Name || properties.Task || 
                               properties['Task Name'] || properties.Item || 
                               Object.values(properties).find((prop: any) => prop.type === 'title');
          
          const title = extractTextFromProperty(titleProperty) || 'Untitled Task';
          
          // Special debugging for Αποξηλώσεις task
          if (title === 'Αποξηλώσεις') {
            console.log(`[FORCE DEBUG] Αποξηλώσεις task ID: ${taskId}`);
            console.log(`[FORCE DEBUG] Full properties object:`, JSON.stringify(properties, null, 2));
            console.log(`[FORCE DEBUG] Last edited time: ${(page as any).last_edited_time}`);
          }
          
          // Fetch subtasks for this task
          let subtasks = [];
          try {
            // Get child pages (subtasks)
            const childBlocks = await notion.blocks.children.list({
              block_id: taskId,
              page_size: 50
            });

            const childPageBlocks = childBlocks.results.filter((block: any) => block.type === 'child_page');
            
            for (const childBlock of childPageBlocks) {
              try {
                const childPage = await notion.pages.retrieve({ page_id: childBlock.id });
                const childProperties = (childPage as any).properties || {};
                
                // Extract child page title
                const childTitleProperty = childProperties.title || childProperties.Title || childProperties.Name ||
                                          Object.values(childProperties).find((prop: any) => prop.type === 'title');
                const childTitle = extractTextFromProperty(childTitleProperty) || childBlock.child_page?.title || 'Untitled Subtask';
                
                const { statusName: childStatusName, statusColor: childStatusColor } = extractNotionStatus(childProperties);
                
                subtasks.push({
                  id: childBlock.id,
                  title: childTitle,
                  status: childStatusName,
                  statusColor: childStatusColor,
                  type: 'child_page',
                  lastEditedTime: (childPage as any).last_edited_time
                });
              } catch (childError) {
                console.log(`[Subtask] Could not fetch child page ${childBlock.id}:`, childError.message);
              }
            }

            // Also check for related tasks/subtasks from relations
            const relatedTasks = properties['Sub-tasks']?.relation || properties.Subtasks?.relation || properties.Related?.relation || [];
            for (const relatedTask of relatedTasks) {
              try {
                const relatedPage = await notion.pages.retrieve({ page_id: relatedTask.id });
                const relatedProperties = (relatedPage as any).properties || {};
                
                const relatedTitleProperty = relatedProperties.title || relatedProperties.Title || relatedProperties.Name ||
                                            Object.values(relatedProperties).find((prop: any) => prop.type === 'title');
                const relatedTitle = extractTextFromProperty(relatedTitleProperty) || 'Untitled Related Task';
                
                const { statusName: relatedStatusName, statusColor: relatedStatusColor } = extractNotionStatus(relatedProperties);
                
                subtasks.push({
                  id: relatedTask.id,
                  title: relatedTitle,
                  status: relatedStatusName,
                  statusColor: relatedStatusColor,
                  type: 'relation',
                  lastEditedTime: (relatedPage as any).last_edited_time
                });
              } catch (relatedError) {
                console.log(`[Subtask] Could not fetch related task ${relatedTask.id}:`, relatedError.message);
              }
            }
          } catch (subtaskError) {
            console.log(`[Subtask] Could not fetch subtasks for task ${taskId}:`, subtaskError.message);
          }

          // Extract status using the robust extraction function
          const { statusName, statusColor } = extractNotionStatus(properties, title);
          
          // Debug log for status extraction
          console.log(`[Task ${title}] Status: ${statusName}, Color: ${statusColor}`);

          const task = {
            id: taskId,
            notionId: taskId,
            title: title,
            status: statusName,
            mainStatus: mapNotionStatusToLocal(statusName, properties.Completed?.checkbox || false),
            subStatus: statusName,
            statusColor: statusColor,
            priority: properties.Priority?.select?.name || null,
            dueDate: properties['Due Date']?.date?.start || properties.Due?.date?.start || null,
            description: '', // Will be populated if needed
            section: null,
            isCompleted: properties.Completed?.checkbox || false,
            progress: calculateProgress(properties, statusName, properties.Completed?.checkbox || false),
            createdTime: (page as any).created_time,
            lastEditedTime: (page as any).last_edited_time,
            url: (page as any).url,
            assignee: extractTextFromProperty(properties.Assign),
            userEmail: extractEmailFromProperty(properties.Assign),
            projectName: extractProjectName({ 
              title: properties.Title?.title?.[0]?.plain_text || "Untitled Task",
              section: null,
              url: (page as any).url,
              properties: properties 
            }),
            properties: properties,
            subtasks: subtasks
          };

          // Skip Αγορές tasks in the regular tasks endpoint
          if (!title.toLowerCase().includes('αγορές') && !title.toLowerCase().includes('agores')) {
            tasks.push(task);
          }
        } catch (taskError) {
          console.log(`[Notion Tasks] Could not fetch task ${taskId}:`, taskError.message);
        }
      }

      console.log(`[Notion Tasks] Successfully fetched ${tasks.length} tasks (excluding Αγορές)`);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks from Notion:", error);
      res.status(500).json({ 
        message: "Failed to fetch tasks from Notion",
        error: (error as Error).message 
      });
    }
  });

  // Get purchase tasks (Αγορές) with subtasks
  app.get("/api/purchases-from-notion", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      // Get user's Notion configuration
      let config = await storage.getConfiguration(userEmail);
      if (!config) {
        config = await getAdminConfiguration();
        if (!config) {
          return res.status(404).json({ message: "Notion configuration not found" });
        }
      }

      const notion = createNotionClient(config.notionSecret);
      
      // First, get all user's projects to extract task IDs and create task-to-project mapping
      const pageId = extractPageIdFromUrl(config.notionPageUrl);
      const databaseRecords = await getFilteredDatabaseRecords(notion, pageId, userEmail);
      console.log(`[Notion Purchases] Found ${databaseRecords.length} database records for project mapping`);
      
      const allTaskIds = new Set<string>();
      const taskToProjectMap = new Map<string, string>(); // taskId -> projectName
      
      for (const record of databaseRecords) {
        // Get actual project name from properties - check all possible property names
        let projectName = null;
        const properties = record.properties || {};
        
        // Try different property names for the project title
        for (const propName of ['Title', 'title', 'Name', 'name', 'Project Name', 'Project']) {
          if (properties[propName]) {
            projectName = extractTextFromProperty(properties[propName]);
            if (projectName) break;
          }
        }
        
        // Fallback: use the first title-type property
        if (!projectName) {
          for (const [propName, prop] of Object.entries(properties)) {
            if (prop && typeof prop === 'object' && prop.type === 'title') {
              projectName = extractTextFromProperty(prop);
              if (projectName) break;
            }
          }
        }
        
        projectName = projectName || 'Unknown Project';
        const taskRelations = record.properties?.Tasks?.relation || [];
        
        console.log(`[Notion Purchases] Processing project: "${projectName}" with ${taskRelations.length} tasks`);
        console.log(`[Notion Purchases] Available properties:`, Object.keys(properties));
        
        for (const taskRef of taskRelations) {
          allTaskIds.add(taskRef.id);
          taskToProjectMap.set(taskRef.id, projectName);
          console.log(`[Notion Purchases] Mapping task ${taskRef.id} to project "${projectName}"`);
        }
      }

      console.log(`[Notion Purchases] Found ${allTaskIds.size} task IDs from user projects`);
      console.log(`[Notion Purchases] Task IDs:`, Array.from(allTaskIds));
      console.log(`[Notion Purchases] Project mapping:`, Array.from(taskToProjectMap.entries()));

      // Fetch purchase tasks (those containing Αγορές)
      const purchaseTasks = [];
      for (const taskId of allTaskIds) {
        try {
          const page = await notion.pages.retrieve({ page_id: taskId });
          const properties = (page as any).properties || {};

          // Extract task title
          const titleProperty = properties.title || properties.Title || properties.Name ||
                               Object.values(properties).find((prop: any) => prop.type === 'title');
          const title = extractTextFromProperty(titleProperty);
          if (!title) {
            console.log(`[Notion Purchases] Skipping task ${taskId} - no title found`);
            continue;
          }

          // Only include Αγορές tasks - check for exact title match or containing Αγορές
          let isAgoresTask = false;
          try {
            isAgoresTask = title && (
              title.toLowerCase().includes('αγορές') || 
              title.toLowerCase().includes('agores') ||
              title === 'Αγορές'
            );
          } catch (err) {
            console.log(`[Notion Purchases] Error checking title for task ${taskId}:`, err.message);
            continue;
          }
          
          if (!isAgoresTask) {
            console.log(`[Notion Purchases] Skipping task "${title}" - not an Αγορές task`);
            continue;
          }
          
          console.log(`[Notion Purchases] ✅ Found Αγορές task: "${title}" (${taskId})`);
          console.log(`[Notion Purchases] Extracting subtasks/sub-database items instead of main task...`);

          // Get the project name for this Αγορές task
          let currentProjectName = taskToProjectMap.get(taskId);
          
          console.log(`[Notion Purchases] Project name for Αγορές task: "${currentProjectName}"`);
          
          // Use the actual mapped project name without fallback override
          if (!currentProjectName) {
            currentProjectName = 'Unknown Project';
            console.log(`[Notion Purchases] No project mapping found - keeping as Unknown Project`);
          }
          
          console.log(`[Notion Purchases] Project name for Αγορές task: "${currentProjectName}"`);

          // Extract subtasks and sub-database items to show in purchases list
          const taskBlocks = await notion.blocks.children.list({ block_id: taskId });
          
          for (const block of taskBlocks.results) {
            if (block.type === 'child_page') {
              try {
                const childPage = await notion.pages.retrieve({ page_id: block.id });
                const childProperties = (childPage as any).properties || {};
                
                const childTitleProperty = childProperties.title || childProperties.Title || childProperties.Name ||
                                          Object.values(childProperties).find((prop: any) => prop.type === 'title');
                const childTitle = extractTextFromProperty(childTitleProperty) || block.child_page?.title || 'Untitled Purchase Item';
                
                // Create purchase item from child page
                const { statusName: childStatusName, statusColor: childStatusColor } = extractNotionStatus(childProperties);
                
                const purchaseItem = {
                  id: block.id,
                  notionId: block.id,
                  title: childTitle,
                  status: childStatusName,
                  mainStatus: mapNotionStatusToLocal(childStatusName, childProperties.Completed?.checkbox || false),
                  subStatus: childStatusName,
                  statusColor: childStatusColor,
                  priority: childProperties.Priority?.select?.name || null,
                  dueDate: childProperties.DueDate?.date?.start || null,
                  description: extractTextFromProperty(childProperties.Description) || '',
                  section: null,
                  isCompleted: childProperties.Status?.select?.name === 'Done',
                  progress: calculateProgress(childProperties, childProperties.Status?.select?.name, childProperties.Status?.select?.name === 'Done'),
                  createdTime: (childPage as any).created_time || new Date().toISOString(),
                  lastEditedTime: (childPage as any).last_edited_time || new Date().toISOString(),
                  url: `https://notion.so/${block.id.replace(/-/g, "")}`,
                  userEmail: userEmail,
                  assignee: extractTextFromProperty(childProperties.Assignee) || null,
                  projectName: currentProjectName,
                  properties: childProperties || {},
                  subtasks: [],
                  type: 'child_page'
                };

                console.log(`[Notion Purchases] Added child page item: "${childTitle}"`);
                purchaseTasks.push(purchaseItem);
              } catch (subtaskError) {
                console.log(`[Notion Purchases] Could not fetch child page ${block.id}:`, subtaskError);
              }
            } else if (block.type === 'child_database') {
              try {
                const database = await notion.databases.retrieve({ database_id: block.id });
                const dbRecords = await notion.databases.query({ database_id: block.id });
                
                console.log(`[Notion Purchases] Found child database with ${dbRecords.results.length} records`);
                
                for (const record of dbRecords.results) {
                  const recordProperties = (record as any).properties || {};
                  const recordTitleProperty = recordProperties.title || recordProperties.Title || recordProperties.Name ||
                                            Object.values(recordProperties).find((prop: any) => prop.type === 'title');
                  const recordTitle = extractTextFromProperty(recordTitleProperty) || 'Untitled Purchase Item';
                  
                  // Create purchase item from database record
                  const { statusName: recordStatusName, statusColor: recordStatusColor } = extractNotionStatus(recordProperties);
                  
                  const purchaseItem = {
                    id: record.id,
                    notionId: record.id,
                    title: recordTitle,
                    status: recordStatusName,
                    mainStatus: mapNotionStatusToLocal(recordStatusName, recordProperties.Completed?.checkbox || false),
                    subStatus: recordStatusName,
                    statusColor: recordStatusColor,
                    priority: recordProperties.Priority?.select?.name || null,
                    dueDate: recordProperties.DueDate?.date?.start || recordProperties.Date?.date?.start || null,
                    description: extractTextFromProperty(recordProperties.Description) || '',
                    section: null,
                    isCompleted: recordProperties.Status?.select?.name === 'Done',
                    progress: calculateProgress(recordProperties, recordProperties.Status?.select?.name, recordProperties.Status?.select?.name === 'Done'),
                    createdTime: (record as any).created_time || new Date().toISOString(),
                    lastEditedTime: (record as any).last_edited_time || new Date().toISOString(),
                    url: `https://notion.so/${record.id.replace(/-/g, "")}`,
                    userEmail: userEmail,
                    assignee: extractTextFromProperty(recordProperties.Assignee) || null,
                    projectName: currentProjectName,
                    properties: recordProperties || {},
                    subtasks: [],
                    type: 'database_record'
                  };

                  console.log(`[Notion Purchases] Added database record item: "${recordTitle}"`);
                  purchaseTasks.push(purchaseItem);
                }
              } catch (dbError) {
                console.log(`[Notion Purchases] Could not fetch database ${block.id}:`, dbError);
              }
            }
          }

          // Don't add the main Αγορές task itself - only its subtasks/sub-database items
          continue;
        } catch (taskError) {
          console.log(`[Notion Purchases] Could not fetch task ${taskId}:`, taskError.message);
          // Skip this task and continue with others
          continue;
        }
      }

      console.log(`[Notion Purchases] Successfully fetched ${purchaseTasks.length} purchase tasks`);
      res.json(purchaseTasks);
    } catch (error) {
      console.error("Error fetching purchase tasks from Notion:", error);
      res.status(500).json({ 
        message: "Failed to fetch purchase tasks from Notion",
        error: (error as Error).message 
      });
    }
  });

  // Get task by numeric ID (for local storage tasks)
  app.get("/api/tasks/local/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.getTask(id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  // Sync tasks from Notion
  app.post("/api/tasks/sync", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail) {
        return res.status(400).json({ 
          message: "User email is required" 
        });
      }

      const config = await storage.getConfiguration(userEmail);
      if (!config) {
        return res.status(400).json({ 
          message: "Configuration not found. Please set up Notion integration first." 
        });
      }

      // Create Notion client with user's secret
      const notion = createNotionClient(config.notionSecret);
      const pageId = extractPageIdFromUrl(config.notionPageUrl);

      // Get the user's task view configuration
      const taskView = await storage.getNotionViewByType(userEmail, 'tasks');
      if (!taskView || !taskView.databaseId) {
        return res.status(404).json({ 
          message: "Task database view not configured. Please set up your views first." 
        });
      }

      // Fetch tasks from Notion filtered by user email
      const notionTasks = await getNotionTasks(notion, taskView.databaseId, userEmail);
      
      // Sync tasks to local storage
      const syncedTasks = [];
      for (const notionTask of notionTasks) {
        const taskData = {
          notionId: notionTask.notionId,
          title: notionTask.title,
          description: notionTask.description || null,
          status: mapNotionStatusToLocal(notionTask.status, notionTask.isCompleted),
          assignee: notionTask.assignee || null,
          dueDate: notionTask.dueDate || null,
          completedAt: notionTask.completedAt || null,
          priority: notionTask.priority?.toLowerCase() || null,
          section: notionTask.section || null,
          progress: calculateProgress(notionTask.properties || {}, notionTask.status, notionTask.isCompleted),
          estimatedHours: null,
          notionUrl: `https://notion.so/${notionTask.notionId.replace(/-/g, '')}`
        };

        const syncedTask = await storage.upsertTaskByNotionId(taskData);
        syncedTasks.push(syncedTask);
      }

      res.json({ 
        message: `Successfully synced ${syncedTasks.length} tasks`,
        tasks: syncedTasks 
      });
    } catch (error) {
      console.error("Error syncing tasks:", error);
      res.status(500).json({ 
        message: "Failed to sync tasks from Notion",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get task statistics
  app.get("/api/tasks/stats", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      const allTasks = await storage.getTasks(userEmail);
      
      const stats = {
        total: allTasks.length,
        completed: allTasks.filter(t => t.status === 'completed').length,
        pending: allTasks.filter(t => t.status === 'pending').length,
        notStarted: allTasks.filter(t => t.status === 'not_started').length
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching task stats:", error);
      res.status(500).json({ message: "Failed to fetch task statistics" });
    }
  });

  // Configuration routes
  app.get("/api/config/:userEmail", async (req, res) => {
    try {
      const { userEmail } = req.params;
      const config = await storage.getConfiguration(userEmail);
      
      if (!config) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      
      // Don't expose the notion secret in the response
      const { notionSecret, ...safeConfig } = config;
      res.json(safeConfig);
    } catch (error) {
      console.error("Error fetching configuration:", error);
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      const configData = insertConfigurationSchema.parse(req.body);
      const config = await storage.createConfiguration(configData);
      
      // Don't expose the notion secret in the response
      const { notionSecret, ...safeConfig } = config;
      res.json(safeConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid configuration data",
          errors: error.errors 
        });
      }
      console.error("Error creating configuration:", error);
      res.status(500).json({ message: "Failed to create configuration" });
    }
  });

  app.put("/api/config/:userEmail", async (req, res) => {
    try {
      const { userEmail } = req.params;
      const configUpdate = insertConfigurationSchema.partial().parse(req.body);
      
      const updatedConfig = await storage.updateConfiguration(userEmail, configUpdate);
      if (!updatedConfig) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      
      // Don't expose the notion secret in the response
      const { notionSecret, ...safeConfig } = updatedConfig;
      res.json(safeConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid configuration data",
          errors: error.errors 
        });
      }
      console.error("Error updating configuration:", error);
      res.status(500).json({ message: "Failed to update configuration" });
    }
  });

  // Notion views routes
  app.get("/api/notion-views", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      // Check if views exist for this user
      let views = await storage.getNotionViews(userEmail);
      
      // If no views found and user is not admin, check if admin has Notion config and create demo views
      if (views.length === 0 && userEmail !== "basiliskan@gmail.com") {
        console.log(`[Notion Views] No views found for ${userEmail}, checking admin config for demo...`);
        
        const adminConfig = await getAdminConfiguration();
        if (adminConfig) {
          console.log(`[Notion Views] Admin config found, creating demo view for ${userEmail}...`);
          
          // Create a demo view using admin's database but for this user
          const adminPageId = extractPageIdFromUrl(adminConfig.notionPageUrl);
          const demoView = await storage.createNotionView({
            userEmail: userEmail,
            viewType: 'projects',
            pageId: 'direct',
            databaseId: adminPageId,
            title: 'Projects',
            icon: '📋',
            isActive: true,
            sortOrder: 2
          });
          
          views = [demoView];
          console.log(`[Notion Views] Created demo view for ${userEmail}`);
        }
      }

      res.json(views);
    } catch (error) {
      console.error("Error fetching notion views:", error);
      res.status(500).json({ message: "Failed to fetch notion views" });
    }
  });

  app.post("/api/notion-views", async (req, res) => {
    try {
      const viewData = insertNotionViewSchema.parse(req.body);
      const view = await storage.createNotionView(viewData);
      res.json(view);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid view data",
          errors: error.errors 
        });
      }
      console.error("Error creating notion view:", error);
      res.status(500).json({ message: "Failed to create notion view" });
    }
  });

  // Get filtered database records for a specific view
  app.get("/api/notion-database/:databaseId", async (req, res) => {
    try {
      const { databaseId } = req.params;
      const userEmail = req.headers['x-user-email'] as string;
      
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      // Get admin configuration (since you own all databases)
      console.log(`[Database Records] Looking for config for user: ${userEmail}`);
      let adminConfig = await storage.getConfiguration(userEmail);
      
      if (!adminConfig) {
        console.log(`[Database Records] Config not found for ${userEmail}, trying admin emails...`);
        adminConfig = await getAdminConfiguration() || 
                     await storage.getConfiguration('admin') || 
                     await storage.getConfiguration(process.env.ADMIN_EMAIL || '');
      }
      
      if (!adminConfig) {
        console.log(`[Database Records] No configuration found for any admin user`);
        return res.status(400).json({ message: "Admin configuration not found. Please set up the workspace first." });
      }
      
      console.log(`[Database Records] Found config for workspace: ${adminConfig.workspaceName}`);

      const notion = createNotionClient(adminConfig.notionSecret);
      
      // Get filtered records for this user
      const records = await getFilteredDatabaseRecords(notion, databaseId, userEmail);
      
      res.json({
        database_id: databaseId,
        user_email: userEmail,
        records: records,
        total_count: records.length
      });
    } catch (error) {
      console.error("Error fetching filtered database:", error);
      res.status(500).json({ message: "Failed to fetch database records" });
    }
  });

  // Setup admin workspace and discover databases (admin only)
  app.post("/api/admin/workspace/setup", async (req, res) => {
    try {
      const { notionSecret, notionPageUrl, adminEmail } = req.body;
      
      if (!notionSecret || !notionPageUrl || !adminEmail) {
        return res.status(400).json({ message: "Notion secret, page URL, and admin email are required" });
      }

      // Create admin configuration
      const adminConfig = await storage.createConfiguration({
        userEmail: adminEmail,
        notionSecret,
        notionPageUrl,
        workspaceName: "Admin Workspace"
      });

      const notion = createNotionClient(notionSecret);
      const pageId = extractPageIdFromUrl(notionPageUrl);

      // Get all databases from the workspace
      const databases = await getNotionDatabases(notion, pageId);
      
      res.json({
        message: `Admin workspace configured with ${databases.length} databases`,
        adminConfig,
        databases
      });
    } catch (error) {
      console.error("Error setting up admin workspace:", error);
      res.status(500).json({ message: "Failed to setup admin workspace" });
    }
  });

  // Create user views for specific databases
  app.post("/api/user/views/setup", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      const { views } = req.body; // Array of { viewType, databaseId, title }
      
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      const createdViews = [];
      for (const viewData of views) {
        const view = await storage.createNotionView({
          userEmail,
          viewType: viewData.viewType,
          pageId: viewData.databaseId,
          databaseId: viewData.databaseId,
          title: viewData.title,
          icon: getIconForViewType(viewData.viewType),
          isActive: true,
          sortOrder: getSortOrderForViewType(viewData.viewType)
        });
        createdViews.push(view);
      }

      res.json({
        message: `Created ${createdViews.length} views for ${userEmail}`,
        views: createdViews
      });
    } catch (error) {
      console.error("Error setting up user views:", error);
      res.status(500).json({ message: "Failed to setup user views" });
    }
  });

  // Auto-discover and setup views based on database names (admin helper)
  app.post("/api/admin/workspace/auto-setup", async (req, res) => {
    try {
      const adminEmail = req.body.adminEmail || process.env.ADMIN_EMAIL;
      
      if (!adminEmail) {
        return res.status(400).json({ message: "Admin email is required" });
      }

      const config = await storage.getConfiguration(adminEmail);
      if (!config) {
        return res.status(400).json({ message: "Admin configuration not found" });
      }

      const notion = createNotionClient(config.notionSecret);
      const pageId = extractPageIdFromUrl(config.notionPageUrl);

      // Get all databases from the workspace
      const databases = await getNotionDatabases(notion, pageId);
      
      res.json({ 
        message: `Found ${databases.length} databases in workspace`,
        databases: databases.map(db => ({
          id: db.id,
          title: 'title' in db && db.title && Array.isArray(db.title) && db.title.length > 0 
            ? db.title[0]?.plain_text 
            : 'Untitled Database',
          url: (db as any).url || `https://notion.so/${db.id.replace(/-/g, '')}`
        }))
      });
    } catch (error) {
      console.error("Error auto-setting up workspace:", error);
      res.status(500).json({ message: "Failed to auto-setup workspace" });
    }
  });

  // Admin API routes
  
  // Get admin projects list with hierarchical structure
  app.get("/api/admin/projects", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const config = await storage.getConfiguration(userEmail);
      if (!config) {
        return res.json([]);
      }

      const notion = createNotionClient(config.notionSecret);
      const pageId = extractPageIdFromUrl(config.notionPageUrl);
      
      // Get project hierarchy: Main project -> Sub-pages -> Databases
      const projectHierarchy = await getProjectHierarchy(notion, pageId);
      
      const projects = [{
        id: pageId,
        title: config.workspaceName || "Main Workspace",
        databaseCount: projectHierarchy.totalDatabases,
        subPageCount: projectHierarchy.subPages.length,
        url: config.notionPageUrl,
        lastUpdated: new Date().toISOString(),
        userCount: projectHierarchy.uniqueUsers.length,
        taskCount: projectHierarchy.totalRecords,
        subPages: projectHierarchy.subPages
      }];

      res.json(projects);
    } catch (error) {
      console.error("Error fetching admin projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Get admin configuration
  app.get("/api/admin/config", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const config = await storage.getConfiguration(userEmail);
      if (!config) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      res.json(config);
    } catch (error) {
      console.error("Error fetching admin config:", error);
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  // Update admin configuration
  app.put("/api/admin/config", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { notionSecret, notionPageUrl, workspaceName } = req.body;
      
      let config = await storage.getConfiguration(userEmail);
      if (!config) {
        config = await storage.createConfiguration({
          userEmail,
          notionSecret,
          notionPageUrl,
          workspaceName: workspaceName || "Admin Workspace"
        });
      } else {
        config = await storage.updateConfiguration(userEmail, {
          notionSecret,
          notionPageUrl,
          workspaceName
        });
      }

      res.json(config);
    } catch (error) {
      console.error("Error updating admin config:", error);
      res.status(500).json({ message: "Failed to update configuration" });
    }
  });

  // Test Notion connection
  app.post("/api/admin/test-connection", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const config = await storage.getConfiguration(userEmail);
      if (!config) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      const notion = createNotionClient(config.notionSecret);
      const pageId = extractPageIdFromUrl(config.notionPageUrl);
      const databases = await getNotionDatabases(notion, pageId);

      res.json({
        success: true,
        workspaceName: config.workspaceName,
        databaseCount: databases.length
      });
    } catch (error) {
      console.error("Error testing connection:", error);
      res.status(500).json({ message: "Connection failed: " + (error as any).message });
    }
  });

  // Get overall admin stats
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const allTasks = await storage.getTasks();
      const totalProjects = 1;
      const activeUsers = 1;
      const totalTasks = allTasks.length;

      res.json({
        totalProjects,
        activeUsers,
        totalTasks
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get project details
  app.get("/api/admin/project-details/:projectId", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { projectId } = req.params;
      const config = await storage.getConfiguration(userEmail);
      
      if (!config) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      const notion = createNotionClient(config.notionSecret);
      const databases = await getNotionDatabases(notion, projectId);
      
      const projectDetails = {
        databases: databases.map(db => ({
          id: db.id,
          title: 'title' in db && db.title && Array.isArray(db.title) && db.title.length > 0 
            ? db.title[0]?.plain_text 
            : 'Untitled Database',
          recordCount: Math.floor(Math.random() * 100) + 10,
          lastSync: new Date().toISOString()
        })),
        recentActivity: [
          {
            user: "Admin User",
            action: "updated task database",
            timestamp: new Date().toISOString()
          }
        ],
        stats: {
          totalTasks: databases.length * 15,
          completedTasks: databases.length * 8,
          activeUsers: 1
        }
      };

      res.json(projectDetails);
    } catch (error) {
      console.error("Error fetching project details:", error);
      res.status(500).json({ message: "Failed to fetch project details" });
    }
  });

  // CRM User Management API Routes
  
  // Get all CRM users
  app.get("/api/admin/crm/users", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { search } = req.query;
      let users: CRMUser[];

      if (search && typeof search === 'string') {
        users = await userDB.searchUsers(search);
      } else {
        users = await userDB.getAllUsers();
      }

      res.json(users);
    } catch (error) {
      console.error("Error fetching CRM users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get CRM user stats
  app.get("/api/admin/crm/stats", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stats = await userDB.getUsersStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching CRM stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Create new CRM user
  app.post("/api/admin/crm/users", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userName, userEmail: newUserEmail, userPhone, notionId } = req.body;
      
      if (!userName || !newUserEmail) {
        return res.status(400).json({ message: "User name and email are required" });
      }

      const newUser = await userDB.createUser({
        userName,
        userEmail: newUserEmail,
        userPhone: userPhone || "",
        notionId
      });

      res.status(201).json(newUser);
    } catch (error) {
      console.error("Error creating CRM user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Update CRM user
  app.put("/api/admin/crm/users/:userId", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.params;
      const { userName, userEmail: newUserEmail, userPhone, notionId } = req.body;

      const updatedUser = await userDB.updateUser(userId, {
        userName,
        userEmail: newUserEmail,
        userPhone,
        notionId
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating CRM user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete CRM user
  app.delete("/api/admin/crm/users/:userId", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.params;
      const deleted = await userDB.deleteUser(userId);

      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting CRM user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Sync users from Notion database
  app.post("/api/admin/crm/sync-from-notion", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { databaseId } = req.body;
      
      if (!databaseId) {
        return res.status(400).json({ message: "Database ID is required" });
      }

      const config = await storage.getConfiguration(userEmail);
      if (!config) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      const notion = createNotionClient(config.notionSecret);
      const response = await notion.databases.query({
        database_id: databaseId
      });

      let syncedCount = 0;
      const syncErrors: string[] = [];

      for (const page of response.results) {
        try {
          if ('properties' in page) {
            const properties = page.properties;
            
            // Extract user data from Notion properties
            const userName = extractTextFromProperty(properties['User Name'] || properties['Name']);
            const userEmailFromNotion = extractEmailFromProperty(properties['User Email'] || properties['Email']);
            const userPhone = extractTextFromProperty(properties['User Phone'] || properties['Phone']);

            if (userName && userEmailFromNotion) {
              await userDB.upsertUser({
                userName,
                userEmail: userEmailFromNotion,
                userPhone: userPhone || "",
                notionId: page.id
              });
              syncedCount++;
            }
          }
        } catch (error: any) {
          syncErrors.push(`Failed to sync user from page ${page.id}: ${error.message}`);
        }
      }

      res.json({
        message: `Synced ${syncedCount} users from Notion`,
        syncedCount,
        errors: syncErrors
      });
    } catch (error) {
      console.error("Error syncing users from Notion:", error);
      res.status(500).json({ message: "Failed to sync users from Notion" });
    }
  });

  // Reminder Management API Routes
  
  // Get reminders for a user
  app.get("/api/admin/crm/users/:userId/reminders", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.params;
      const reminders = await reminderDB.getRemindersByUserId(userId);
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching reminders:", error);
      res.status(500).json({ message: "Failed to fetch reminders" });
    }
  });

  // Create a new reminder
  app.post("/api/admin/crm/users/:userId/reminders", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.params;
      const { message, reminderDate, reminderType } = req.body;

      if (!message || !reminderDate || !reminderType) {
        return res.status(400).json({ message: "Message, reminder date, and type are required" });
      }

      const reminder = await reminderDB.createReminder({
        userId,
        message,
        reminderDate,
        reminderType
      });

      res.status(201).json(reminder);
    } catch (error) {
      console.error("Error creating reminder:", error);
      res.status(500).json({ message: "Failed to create reminder" });
    }
  });

  // Update a reminder
  app.put("/api/admin/crm/reminders/:reminderId", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { reminderId } = req.params;
      const { message, reminderDate, reminderType } = req.body;

      const updatedReminder = await reminderDB.updateReminder(reminderId, {
        message,
        reminderDate,
        reminderType
      });

      if (!updatedReminder) {
        return res.status(404).json({ message: "Reminder not found" });
      }

      res.json(updatedReminder);
    } catch (error) {
      console.error("Error updating reminder:", error);
      res.status(500).json({ message: "Failed to update reminder" });
    }
  });

  // Delete a reminder
  app.delete("/api/admin/crm/reminders/:reminderId", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { reminderId } = req.params;
      const deleted = await reminderDB.deleteReminder(reminderId);

      if (!deleted) {
        return res.status(404).json({ message: "Reminder not found" });
      }

      res.json({ message: "Reminder deleted successfully" });
    } catch (error) {
      console.error("Error deleting reminder:", error);
      res.status(500).json({ message: "Failed to delete reminder" });
    }
  });

  // Send SMS to user
  app.post("/api/admin/crm/users/:userId/send-sms", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.params;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      const user = await userDB.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.userPhone) {
        return res.status(400).json({ message: "User has no phone number" });
      }

      const success = await smsService.sendSMS(user.userPhone, message);
      
      if (success) {
        res.json({ message: "SMS sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send SMS" });
      }
    } catch (error) {
      console.error("Error sending SMS:", error);
      res.status(500).json({ message: "Failed to send SMS" });
    }
  });

  // Send email to user
  app.post("/api/admin/crm/users/:userId/send-email", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.params;
      const { subject, htmlBody, textBody } = req.body;

      if (!subject || !htmlBody) {
        return res.status(400).json({ message: "Subject and message content are required" });
      }

      const user = await userDB.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const success = await emailService.sendEmail(
        user.userEmail,
        subject,
        htmlBody,
        textBody
      );
      
      if (success) {
        res.json({ message: "Email sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send email" });
      }
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  // API Settings Management Routes
  
  // Get API settings
  app.get("/api/admin/settings/api", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Load persistent settings
      const persistentSettings = await storage.getApiSettings();
      
      // Return current settings (masked for security)
      const apiSettings = {
        twilioAccountSid: persistentSettings.TWILIO_ACCOUNT_SID ? persistentSettings.TWILIO_ACCOUNT_SID.substring(0, 8) + "..." : "",
        twilioAuthToken: persistentSettings.TWILIO_AUTH_TOKEN ? "****" : "",
        twilioPhoneNumber: persistentSettings.TWILIO_PHONE_NUMBER || "",
        awsAccessKeyId: persistentSettings.AWS_ACCESS_KEY_ID ? persistentSettings.AWS_ACCESS_KEY_ID.substring(0, 8) + "..." : "",
        awsSecretAccessKey: persistentSettings.AWS_SECRET_ACCESS_KEY ? "****" : "",
        awsRegion: persistentSettings.AWS_REGION || "us-east-1"
      };

      res.json(apiSettings);
    } catch (error) {
      console.error("Error fetching API settings:", error);
      res.status(500).json({ message: "Failed to fetch API settings" });
    }
  });

  // Save API settings (persists to JSON file and updates environment variables)
  app.post("/api/admin/settings/api", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { 
        twilioAccountSid, 
        twilioAuthToken, 
        twilioPhoneNumber, 
        awsAccessKeyId, 
        awsSecretAccessKey, 
        awsRegion 
      } = req.body;

      // Save to persistent storage
      if (twilioAccountSid) await storage.setApiSetting('TWILIO_ACCOUNT_SID', twilioAccountSid);
      if (twilioAuthToken) await storage.setApiSetting('TWILIO_AUTH_TOKEN', twilioAuthToken);
      if (twilioPhoneNumber) await storage.setApiSetting('TWILIO_PHONE_NUMBER', twilioPhoneNumber);
      if (awsAccessKeyId) await storage.setApiSetting('AWS_ACCESS_KEY_ID', awsAccessKeyId);
      if (awsSecretAccessKey) await storage.setApiSetting('AWS_SECRET_ACCESS_KEY', awsSecretAccessKey);
      if (awsRegion) await storage.setApiSetting('AWS_REGION', awsRegion);

      // Also update environment variables for this session
      if (twilioAccountSid) process.env.TWILIO_ACCOUNT_SID = twilioAccountSid;
      if (twilioAuthToken) process.env.TWILIO_AUTH_TOKEN = twilioAuthToken;
      if (twilioPhoneNumber) process.env.TWILIO_PHONE_NUMBER = twilioPhoneNumber;
      if (awsAccessKeyId) process.env.AWS_ACCESS_KEY_ID = awsAccessKeyId;
      if (awsSecretAccessKey) process.env.AWS_SECRET_ACCESS_KEY = awsSecretAccessKey;
      if (awsRegion) process.env.AWS_REGION = awsRegion;

      res.json({ message: "API settings updated and saved successfully" });
    } catch (error) {
      console.error("Error saving API settings:", error);
      res.status(500).json({ message: "Failed to save API settings" });
    }
  });

  // Test Twilio connection
  app.post("/api/admin/test/twilio", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Test Twilio configuration by checking credentials
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        return res.status(400).json({ message: "Twilio credentials not configured" });
      }

      // Try to initialize Twilio client to test credentials
      try {
        const twilio = require('twilio');
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        // Test by fetching account info
        await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
        
        res.json({ message: "Twilio connection successful" });
      } catch (twilioError: any) {
        res.status(400).json({ message: `Twilio connection failed: ${twilioError.message}` });
      }
    } catch (error) {
      console.error("Error testing Twilio:", error);
      res.status(500).json({ message: "Failed to test Twilio connection" });
    }
  });

  // Test AWS SES connection
  app.post("/api/admin/test/ses", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Test AWS SES configuration
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        return res.status(400).json({ message: "AWS credentials not configured" });
      }

      try {
        const { SESClient, GetSendQuotaCommand } = require('@aws-sdk/client-ses');
        
        const sesClient = new SESClient({
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          }
        });

        // Test by getting send quota
        await sesClient.send(new GetSendQuotaCommand({}));
        
        res.json({ message: "AWS SES connection successful" });
      } catch (sesError: any) {
        res.status(400).json({ message: `AWS SES connection failed: ${sesError.message}` });
      }
    } catch (error) {
      console.error("Error testing AWS SES:", error);
      res.status(500).json({ message: "Failed to test AWS SES connection" });
    }
  });

  // Test OpenAI API connection
  app.post("/api/admin/test/openai", async (req, res) => {
    try {
      // Check if OpenAI API key is configured
      const openaiKey = await storage.getApiSetting('openaiApiKey') || process.env.OPENAI_API_KEY;
      
      if (!openaiKey) {
        return res.status(400).json({ message: "OpenAI API key not configured" });
      }

      try {
        // Import OpenAI dynamically
        const { default: OpenAI } = await import('openai');
        
        // Create OpenAI client with the configured key
        const openai = new OpenAI({ 
          apiKey: openaiKey 
        });

        // Test with a simple completion request
        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            {
              role: "user",
              content: "Test connection. Please respond with 'Connection successful'."
            }
          ],
          max_tokens: 10
        });

        if (response.choices[0]?.message?.content) {
          res.json({ message: "OpenAI API connection successful" });
        } else {
          res.status(400).json({ message: "OpenAI API test failed: No response received" });
        }
      } catch (openaiError: any) {
        console.error("OpenAI API test error:", openaiError);
        
        if (openaiError.status === 401) {
          res.status(400).json({ message: "OpenAI API connection failed: Invalid API key" });
        } else if (openaiError.status === 429) {
          res.status(400).json({ message: "OpenAI API connection failed: Rate limit exceeded or quota exceeded" });
        } else {
          res.status(400).json({ message: `OpenAI API connection failed: ${openaiError.message}` });
        }
      }
    } catch (error) {
      console.error("Error testing OpenAI API:", error);
      res.status(500).json({ message: "Failed to test OpenAI API connection" });
    }
  });

  // AI Request endpoint
  app.post("/api/ai/request", async (req, res) => {
    try {
      const { message } = req.body;
      const userEmail = req.headers['x-user-email'] as string;

      if (!userEmail) {
        return res.status(400).json({ message: "User email required" });
      }

      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Import AI service dynamically
      const { aiService } = await import('./aiService');

      // Generate AI response based on user's Notion context
      const response = await aiService.generateResponse(userEmail, message);

      res.json({ 
        message: response,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error("Error processing AI request:", error);
      console.error("Error status:", error.status);
      console.error("Error message:", error.message);
      
      if (error.message.includes("OpenAI API key not configured")) {
        res.status(400).json({ 
          message: "AI service is not available. Please configure OpenAI API key in admin settings." 
        });
      } else if (error.status === 429 || error.message.includes("quota") || error.message.includes("Rate limit")) {
        res.status(429).json({ 
          message: "OpenAI API quota exceeded. Please check your OpenAI billing and upgrade your plan, or wait for the quota to reset. You can configure a different API key in admin settings." 
        });
      } else if (error.status === 401 || error.message.includes("Invalid API key")) {
        res.status(400).json({ 
          message: "Invalid OpenAI API key. Please check your API key in admin settings and ensure it's valid." 
        });
      } else {
        res.status(500).json({ 
          message: error.message || "Failed to process AI request. Please try again." 
        });
      }
    }
  });

  // Find all databases in the workspace including child databases




  // Quick search for Αγορές database only
  app.get('/api/notion-workspace/find-agores', async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      const config = await storage.getConfiguration(userEmail);
      if (!config) {
        return res.status(404).json({ message: "No Notion configuration found" });
      }

      const notion = createNotionClient(config.notionSecret);
      let parentPageId = extractPageIdFromUrl(config.notionPageUrl);

      // If the current URL is a database, find its parent page
      try {
        const currentDb = await notion.databases.retrieve({ database_id: parentPageId });
        if ('parent' in currentDb && currentDb.parent.type === 'page_id') {
          parentPageId = currentDb.parent.page_id;
          console.log(`[Find Agores] Found parent page: ${parentPageId}`);
        }
      } catch (err) {
        console.log(`[Find Agores] Current ID is a page, not a database`);
      }

      console.log(`[Find Agores] Scanning parent page ${parentPageId} for Αγορές database...`);

      // Get all blocks from the parent page only (no recursion)
      const response = await notion.blocks.children.list({
        block_id: parentPageId,
      });

      console.log(`[Find Agores] Found ${response.results.length} blocks in parent page`);

      // Look for any database blocks and check their names
      for (const block of response.results) {
        console.log(`[Find Agores] Checking block type: ${('type' in block) ? block.type : 'unknown'}`);
        
        if ('type' in block && (block.type === "child_database" || block.type === "table")) {
          try {
            const databaseInfo = await notion.databases.retrieve({
              database_id: block.id,
            });
            
            const title = databaseInfo.title?.[0]?.plain_text || 'Untitled';
            console.log(`[Find Agores] Found database: "${title}" (ID: ${block.id})`);
            
            if (title === 'Αγορές') {
              console.log(`[Find Agores] Found Αγορές database! Creating view...`);
              
              // Auto-create the view
              const existingView = await storage.getNotionViewByType(userEmail, 'αγορές');
              if (!existingView) {
                await storage.createNotionView({
                  userEmail: userEmail,
                  viewType: 'αγορές',
                  pageId: parentPageId,
                  databaseId: block.id,
                  title: 'Αγορές',
                  icon: '🛒',
                  isActive: true,
                  sortOrder: 3
                });
                console.log(`[Find Agores] Created Αγορές view for database: ${block.id}`);
              }
              
              return res.json({
                found: true,
                database: {
                  id: block.id,
                  title: title
                },
                viewCreated: !existingView
              });
            }
          } catch (error) {
            console.log(`[Find Agores] Error checking database ${block.id}:`, error);
          }
        }
      }

      res.json({ found: false, message: "Αγορές database not found in parent page" });

    } catch (error) {
      console.error("Error finding Αγορές database:", error);
      res.status(500).json({ 
        message: "Failed to find Αγορές database",
        error: (error as Error).message 
      });
    }
  });

  app.get('/api/notion-workspace/all-databases', async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      let config = await storage.getConfiguration(userEmail);
      if (!config) {
        config = await getAdminConfiguration();
        if (!config) {
          return res.status(404).json({ message: "Notion configuration not found" });
        }
      }

      const notion = createNotionClient(config.notionSecret);
      const pageId = extractPageIdFromUrl(config.notionPageUrl);

      console.log(`[All Databases] Searching for all databases from page: ${pageId}`);

      // First try to get the database info to find its parent
      let parentPageId = pageId;
      try {
        const currentDb = await notion.databases.retrieve({ database_id: pageId });
        if ('parent' in currentDb && currentDb.parent.type === 'page_id') {
          parentPageId = currentDb.parent.page_id;
          console.log(`[All Databases] Found parent page: ${parentPageId}`);
        }
      } catch (err) {
        console.log(`[All Databases] Current ID is a page, not a database`);
        parentPageId = pageId;
      }

      // Get all databases from the parent page
      const allDatabases = await getNotionDatabases(notion, parentPageId);
      
      console.log(`[All Databases] Found ${allDatabases.length} total databases`);
      
      const databaseList = allDatabases.map(db => ({
        id: db.id,
        title: 'title' in db && db.title && Array.isArray(db.title) && db.title.length > 0 
          ? db.title[0]?.plain_text 
          : 'Untitled Database',
        parent: parentPageId
      }));

      // Look for the "Αγορές" database specifically (could be named Αγορές or be an Untitled database)
      const agoresDb = allDatabases.find(db => 
        'title' in db && db.title && Array.isArray(db.title) && db.title.length > 0 && 
        (db.title[0]?.plain_text === 'Αγορές' || 
         db.title[0]?.plain_text?.toLowerCase().includes('agores') ||
         db.title[0]?.plain_text?.toLowerCase().includes('purchases'))
      );

      const agoresFound = !!agoresDb;
      console.log(`[All Databases] Αγορές database found: ${agoresFound}`);

      // If Αγορές database is found, automatically create the view
      if (agoresFound && agoresDb) {
        try {
          const existingView = await storage.getNotionViewByType(userEmail, 'αγορές');
          if (!existingView) {
            await storage.createNotionView({
              userEmail: userEmail,
              viewType: 'αγορές',
              pageId: parentPageId,
              databaseId: agoresDb.id,
              title: 'Αγορές',
              icon: '🛒',
              isActive: true,
              sortOrder: 3
            });
            console.log(`[All Databases] Auto-created Αγορές view for database: ${agoresDb.id}`);
          }
        } catch (error) {
          console.error(`[All Databases] Error auto-creating Αγορές view:`, error);
        }
      }

      res.json({
        databases: databaseList,
        parentPageId: parentPageId,
        totalFound: allDatabases.length,
        agoresFound: agoresFound,
        agoresId: agoresDb?.id
      });

    } catch (error) {
      console.error("Error finding all databases:", error);
      res.status(500).json({ 
        message: "Failed to find databases",
        error: (error as Error).message 
      });
    }
  });

  // Create new view for Αγορές database
  app.post('/api/notion-views/create-agores', async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      let config = await storage.getConfiguration(userEmail);
      if (!config) {
        config = await getAdminConfiguration();
        if (!config) {
          return res.status(404).json({ message: "Notion configuration not found" });
        }
      }

      const notion = createNotionClient(config.notionSecret);
      const pageId = extractPageIdFromUrl(config.notionPageUrl);

      // Get parent page
      let parentPageId = pageId;
      try {
        const currentDb = await notion.databases.retrieve({ database_id: pageId });
        if ('parent' in currentDb && currentDb.parent.type === 'page_id') {
          parentPageId = currentDb.parent.page_id;
        }
      } catch (err) {
        parentPageId = pageId;
      }

      // Find the Αγορές database
      const allDatabases = await getNotionDatabases(notion, parentPageId);
      const agoresDb = allDatabases.find(db => 
        'title' in db && db.title && Array.isArray(db.title) && db.title.length > 0 && 
        db.title[0]?.plain_text === 'Αγορές'
      );

      if (!agoresDb) {
        return res.status(404).json({ 
          message: "Αγορές database not found",
          availableDatabases: allDatabases.map(db => ({
            id: db.id,
            title: 'title' in db && db.title && Array.isArray(db.title) && db.title.length > 0 
              ? db.title[0]?.plain_text 
              : 'Untitled Database'
          }))
        });
      }

      // Create new view for Αγορές
      const newView = await storage.createNotionView({
        userEmail: userEmail,
        viewType: 'agores',
        pageId: 'direct',
        databaseId: agoresDb.id,
        title: 'Αγορές',
        icon: '🛒',
        isActive: true,
        sortOrder: 3
      });

      console.log(`[Αγορές View] Created new view for Αγορές database: ${agoresDb.id}`);

      res.json({
        success: true,
        view: newView,
        databaseId: agoresDb.id
      });

    } catch (error) {
      console.error("Error creating Αγορές view:", error);
      res.status(500).json({ 
        message: "Failed to create Αγορές view",
        error: (error as Error).message 
      });
    }
  });

  // Notion workspace discovery route
  app.post("/api/notion-workspace/discover", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail) {
        return res.status(401).json({ message: "User email required" });
      }

      // Get user configuration
      const config = await storage.getConfiguration(userEmail);
      if (!config || !config.notionSecret || !config.notionPageUrl) {
        return res.status(400).json({ message: "Notion configuration not found. Please configure your Notion settings first." });
      }

      const notion = createNotionClient(config.notionSecret);
      const pageId = extractPageIdFromUrl(config.notionPageUrl);



      try {
        // First, try to determine if the provided URL is a database or page
        let workspaceStructure;
        let isDatabaseUrl = false;
        
        try {
          // Try to retrieve as a page first
          await notion.pages.retrieve({ page_id: pageId });
          console.log(`[Discovery] URL is a page, scanning for child databases...`);
          workspaceStructure = await discoverWorkspacePages(notion, pageId, userEmail);
        } catch (pageError: any) {
          if (pageError.message?.includes('is a database, not a page')) {
            console.log(`[Discovery] URL is a database, checking it directly...`);
            isDatabaseUrl = true;
            
            // If it's a database, check it directly for user records
            try {
              const userRecords = await getFilteredDatabaseRecords(notion, pageId, userEmail);
              const database = await notion.databases.retrieve({ database_id: pageId });
              
              if (userRecords.length > 0) {
                workspaceStructure = {
                  userPages: [],
                  userDatabases: [{
                    id: pageId,
                    title: 'title' in database && database.title && Array.isArray(database.title) && database.title.length > 0 
                      ? database.title[0]?.plain_text 
                      : 'Untitled Database',
                    parentPageId: 'direct',
                    parentPageTitle: 'Direct Database',
                    recordCount: userRecords.length
                  }],
                  databases: [{
                    id: pageId,
                    title: 'title' in database && database.title && Array.isArray(database.title) && database.title.length > 0 
                      ? database.title[0]?.plain_text 
                      : 'Untitled Database',
                    parentPageId: 'direct',
                    parentPageTitle: 'Direct Database'
                  }],
                  totalFound: 1
                };
              } else {
                workspaceStructure = {
                  userPages: [],
                  userDatabases: [],
                  databases: [],
                  totalFound: 0
                };
              }
            } catch (dbError) {
              console.error("Error checking database directly:", dbError);
              throw dbError;
            }
          } else {
            throw pageError;
          }
        }
        
        if (workspaceStructure.userPages.length === 0 && workspaceStructure.userDatabases.length === 0) {
          if (isDatabaseUrl) {
            return res.status(404).json({ message: "No records found for your user email in this database. Please ensure your email is added to a 'User Email' property in the database records." });
          } else {
            return res.status(404).json({ message: "No databases found for your user email. Please ensure your email is added to the 'User Email' property in relevant Notion pages or databases." });
          }
        }

        let viewsCreated = 0;

        // Create views for user-specific databases
        for (const dbInfo of workspaceStructure.userDatabases) {
          const databaseTitle = dbInfo.title || "Untitled Database";

          // Determine view type based on database title
          let viewType = 'general';
          let icon = '📊';
          let sortOrder = 100;

          if (databaseTitle.toLowerCase().includes('task')) {
            viewType = 'tasks';
            icon = '✅';
            sortOrder = 1;
          } else if (databaseTitle.toLowerCase().includes('project')) {
            viewType = 'projects';
            icon = '📋';
            sortOrder = 2;
          } else if (databaseTitle.toLowerCase().includes('user') || databaseTitle.toLowerCase().includes('people')) {
            viewType = 'users';
            icon = '👥';
            sortOrder = 3;
          } else if (databaseTitle.toLowerCase().includes('document') || databaseTitle.toLowerCase().includes('note')) {
            viewType = 'documents';
            icon = '📄';
            sortOrder = 4;
          }

          // Check if view already exists
          const existingView = await storage.getNotionViewByType(userEmail, viewType);
          
          if (!existingView) {
            // Create new view
            await storage.createNotionView({
              userEmail,
              viewType,
              pageId: dbInfo.parentPageId,
              databaseId: dbInfo.id,
              title: databaseTitle,
              icon,
              isActive: true,
              sortOrder
            });
            viewsCreated++;
          }
        }

        res.json({ 
          message: `Workspace discovery complete. Found ${workspaceStructure.userPages.length} user pages and ${workspaceStructure.userDatabases.length} databases with your data. Created ${viewsCreated} new views.`,
          userPagesFound: workspaceStructure.userPages.length,
          userDatabasesFound: workspaceStructure.userDatabases.length,
          totalDatabasesScanned: workspaceStructure.databases.length,
          viewsCreated 
        });

      } catch (notionError: any) {
        console.error("Notion API error:", notionError);
        res.status(400).json({ message: `Failed to access Notion workspace: ${notionError.message}` });
      }

    } catch (error) {
      console.error("Error discovering workspace:", error);
      res.status(500).json({ message: "Failed to discover workspace" });
    }
  });

  // Debug endpoint for checking all database records (no filtering)
  app.get("/api/debug/notion-database-all/:databaseId", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { databaseId } = req.params;
      const adminConfig = await getAdminConfiguration();
      
      if (!adminConfig) {
        return res.status(400).json({ message: "Admin configuration not found" });
      }

      const notion = createNotionClient(adminConfig.notionSecret);
      
      // Get ALL records without any filtering
      const response = await notion.databases.query({
        database_id: databaseId
      });

      const allRecords = response.results.map((page: any) => {
        const properties = page.properties;
        return {
          notionId: page.id,
          projectName: properties?.["Project name"]?.title?.[0]?.plain_text || "Untitled",
          userEmail: properties?.["User Email"]?.email || null,
          status: properties?.Status?.status?.name || null,
          people: properties?.People?.people || [],
          createdTime: page.created_time,
          lastEditedTime: page.last_edited_time,
          url: page.url
        };
      });

      res.json({
        database_id: databaseId,
        total_records: allRecords.length,
        records: allRecords
      });
    } catch (error) {
      console.error("Error fetching all database records:", error);
      res.status(500).json({ message: "Failed to fetch all database records" });
    }
  });

  // Get tasks from all databases (including project-specific databases)
  app.get("/api/tasks", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      // Get user's Notion configuration
      const config = await storage.getConfiguration(userEmail);
      if (!config) {
        return res.status(404).json({ message: "Notion configuration not found" });
      }

      const notion = createNotionClient(config.notionSecret);
      const allTasks = [];

      // Get all views for this user
      const views = await storage.getNotionViews(userEmail);
      
      // Find all task-related databases
      const taskDatabases = views.filter(v => 
        v.viewType === 'tasks' || 
        v.viewType === 'database' || 
        v.title.toLowerCase().includes('task')
      );

      console.log(`[Tasks API] Found ${taskDatabases.length} potential task databases`);

      // Query each database for tasks
      for (const db of taskDatabases) {
        if (!db.databaseId) continue;
        
        try {
          console.log(`[Tasks API] Querying database: ${db.title} (${db.databaseId})`);
          
          const response = await notion.databases.query({
            database_id: db.databaseId,
            page_size: 100
          });

          const tasks = response.results.map((page: any) => {
            const properties = page.properties || {};
            
            // Try multiple possible field names for the title
            const titleProperty = properties.Title || properties.Name || properties.Task || 
                                 properties['Task Name'] || properties.Item || properties.Project;
            
            return {
              id: page.id,
              title: extractTextFromProperty(titleProperty) || 'Untitled Task',
              status: properties.Status?.select?.name || properties.Status?.status?.name || 'Unknown',
              priority: properties.Priority?.select?.name || null,
              assignee: properties.Assignee?.people?.[0]?.name || null,
              dueDate: properties['Due Date']?.date?.start || properties.Due?.date?.start || null,
              createdTime: (page as any).created_time,
              lastEditedTime: (page as any).last_edited_time,
              url: (page as any).url,
              project: properties.Project?.relation?.[0]?.id || null,
              description: extractTextFromProperty(properties.Description),
              database: db.title,
              databaseId: db.databaseId,
              properties: properties
            };
          });

          allTasks.push(...tasks);
          console.log(`[Tasks API] Found ${tasks.length} tasks in ${db.title}`);
        } catch (dbError) {
          console.error(`[Tasks API] Error querying database ${db.title}:`, dbError);
        }
      }

      res.json({
        tasks: allTasks,
        total: allTasks.length
      });
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ 
        message: "Failed to fetch tasks",
        error: (error as Error).message 
      });
    }
  });

  // Get tasks from specific database
  app.get("/api/database/:databaseId/tasks", async (req, res) => {
    try {
      const { databaseId } = req.params;
      const userEmail = req.headers['x-user-email'] as string;
      
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      // Get user's Notion configuration
      let config = await storage.getConfiguration(userEmail);
      if (!config) {
        config = await getAdminConfiguration();
        if (!config) {
          return res.status(404).json({ message: "Notion configuration not found" });
        }
      }

      const notion = createNotionClient(config.notionSecret);
      
      console.log(`[Database Tasks] Fetching tasks from database: ${databaseId}`);
      
      try {
        // Query the specific database
        const response = await notion.databases.query({
          database_id: databaseId,
          page_size: 100
        });

        const tasks = response.results.map((page: any) => {
          const properties = page.properties || {};
          
          // Try multiple possible field names for the title
          const titleProperty = properties.Title || properties.Name || properties.Task || 
                               properties['Task Name'] || properties.Item || properties.Project ||
                               Object.values(properties).find((prop: any) => prop.type === 'title');
          
          return {
            id: page.id,
            title: extractTextFromProperty(titleProperty) || 'Untitled Entry',
            status: properties.Status?.select?.name || properties.Status?.status?.name || 'Unknown',
            priority: properties.Priority?.select?.name || null,
            assignee: properties.Assignee?.people?.[0]?.name || null,
            dueDate: properties['Due Date']?.date?.start || properties.Due?.date?.start || null,
            createdTime: (page as any).created_time,
            lastEditedTime: (page as any).last_edited_time,
            url: (page as any).url,
            project: properties.Project?.relation?.[0]?.id || null,
            description: extractTextFromProperty(properties.Description),
            databaseId: databaseId,
            properties: properties
          };
        });

        console.log(`[Database Tasks] Found ${tasks.length} entries in database ${databaseId}`);
        
        res.json({
          tasks,
          total: tasks.length,
          databaseId
        });
      } catch (dbError) {
        console.error(`[Database Tasks] Error accessing database ${databaseId}:`, dbError);
        // Return a more user-friendly error
        res.status(403).json({ 
          message: "Database access denied",
          error: "This database may not be shared with the integration or may not exist",
          databaseId
        });
      }
    } catch (error) {
      console.error("Error fetching database tasks:", error);
      res.status(500).json({ 
        message: "Failed to fetch database tasks",
        error: (error as Error).message 
      });
    }
  });

  // Get all tasks from all accessible databases for a project
  app.get("/api/project/:projectId/tasks", async (req, res) => {
    try {
      const { projectId } = req.params;
      const userEmail = req.headers['x-user-email'] as string;
      
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      // Get user's Notion configuration
      let config = await storage.getConfiguration(userEmail);
      if (!config) {
        config = await getAdminConfiguration();
        if (!config) {
          return res.status(404).json({ message: "Notion configuration not found" });
        }
      }

      const notion = createNotionClient(config.notionSecret);
      
      console.log(`[Project Tasks] Fetching all tasks for project: ${projectId}`);
      
      // Get project structure to find databases
      const projectStructure = await getProjectHierarchy(notion, projectId);
      const allTasks: any[] = [];
      
      // Search through all databases for tasks related to this project
      const databases = projectStructure.databases || [];
      console.log(`[Project Tasks] Found ${databases.length} databases in project structure`);
      
      for (const database of databases) {
        try {
          console.log(`[Project Tasks] Checking database: ${database.title} (${database.id})`);
          
          const response = await notion.databases.query({
            database_id: database.id,
            page_size: 100,
            filter: {
              or: [
                {
                  property: 'Project',
                  relation: {
                    contains: projectId
                  }
                },
                {
                  property: 'Projects',
                  relation: {
                    contains: projectId
                  }
                }
              ]
            }
          });

          const databaseTasks = response.results.map((page: any) => {
            const properties = page.properties || {};
            
            // Try multiple possible field names for the title
            const titleProperty = properties.Title || properties.Name || properties.Task || 
                                 properties['Task Name'] || properties.Item || 
                                 Object.values(properties).find((prop: any) => prop.type === 'title');
            
            return {
              id: page.id,
              title: extractTextFromProperty(titleProperty) || 'Untitled Entry',
              status: properties.Status?.select?.name || properties.Status?.status?.name || 'No Status',
              priority: properties.Priority?.select?.name || null,
              assignee: properties.Assignee?.people?.[0]?.name || 
                       (properties.People?.people?.[0]?.name) || null,
              dueDate: properties['Due Date']?.date?.start || properties.Due?.date?.start || null,
              createdTime: (page as any).created_time,
              lastEditedTime: (page as any).last_edited_time,
              url: (page as any).url,
              project: projectId,
              description: extractTextFromProperty(properties.Description) || 'No description available',
              databaseId: database.id,
              databaseTitle: database.title,
              properties: properties
            };
          });
          
          allTasks.push(...databaseTasks);
          console.log(`[Project Tasks] Found ${databaseTasks.length} tasks in ${database.title}`);
          
        } catch (dbError) {
          console.log(`[Project Tasks] Could not access database ${database.title}:`, dbError);
        }
      }

      console.log(`[Project Tasks] Total tasks found for project ${projectId}: ${allTasks.length}`);
      
      res.json({
        projectId,
        tasks: allTasks,
        total: allTasks.length
      });
    } catch (error) {
      console.error("Error fetching project tasks:", error);
      res.status(500).json({ 
        message: "Failed to fetch project tasks",
        error: (error as Error).message 
      });
    }
  });

  // Get specific task by ID
  app.get("/api/tasks/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const userEmail = req.headers['x-user-email'] as string;
      
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      // Get user's Notion configuration
      let config = await storage.getConfiguration(userEmail);
      if (!config) {
        config = await getAdminConfiguration();
        if (!config) {
          return res.status(404).json({ message: "Notion configuration not found" });
        }
      }

      const notion = createNotionClient(config.notionSecret);
      
      console.log(`[Task Details] Fetching task: ${taskId}`);
      
      try {
        // Get the specific task page
        console.log(`[Task Details] Attempting to retrieve page: ${taskId}`);
        const page = await notion.pages.retrieve({ page_id: taskId });
        console.log(`[Task Details] Page retrieved successfully: ${page.id}`);
        const properties = (page as any).properties || {};
        
        // Try multiple possible field names for the title
        const titleProperty = properties.Title || properties.Name || properties.Task || 
                             properties['Task Name'] || properties.Item || 
                             Object.values(properties).find((prop: any) => prop.type === 'title');
        
        const title = extractTextFromProperty(titleProperty) || 'Untitled Entry';
        
        console.log(`[Task Details] Found task: ${title}`);
        
        // Get page content (description) and find sub-pages
        let description = '';
        let subtasks: any[] = [];
        try {
          const blocks = await notion.blocks.children.list({
            block_id: taskId,
            page_size: 100
          });
          
          // Extract text from blocks and find child pages
          const textBlocks: string[] = [];
          for (const block of blocks.results) {
            if (block.type === 'paragraph' && block.paragraph?.rich_text) {
              textBlocks.push(block.paragraph.rich_text.map((text: any) => text.plain_text).join(''));
            } else if (block.type === 'heading_1' && block.heading_1?.rich_text) {
              textBlocks.push('# ' + block.heading_1.rich_text.map((text: any) => text.plain_text).join(''));
            } else if (block.type === 'heading_2' && block.heading_2?.rich_text) {
              textBlocks.push('## ' + block.heading_2.rich_text.map((text: any) => text.plain_text).join(''));
            } else if (block.type === 'heading_3' && block.heading_3?.rich_text) {
              textBlocks.push('### ' + block.heading_3.rich_text.map((text: any) => text.plain_text).join(''));
            } else if (block.type === 'bulleted_list_item' && block.bulleted_list_item?.rich_text) {
              textBlocks.push('• ' + block.bulleted_list_item.rich_text.map((text: any) => text.plain_text).join(''));
            } else if (block.type === 'child_page') {
              // Found a sub-page, fetch its details
              try {
                const childPage = await notion.pages.retrieve({ page_id: block.id });
                const childProperties = (childPage as any).properties || {};
                const childTitleProperty = childProperties.Title || childProperties.Name || 
                                          Object.values(childProperties).find((prop: any) => prop.type === 'title');
                
                subtasks.push({
                  id: block.id,
                  title: extractTextFromProperty(childTitleProperty) || 'Untitled Subtask',
                  type: 'child_page',
                  url: (childPage as any).url,
                  createdTime: (childPage as any).created_time,
                  lastEditedTime: (childPage as any).last_edited_time
                });
                console.log(`[Task Details] Found child page: ${extractTextFromProperty(childTitleProperty)}`);
              } catch (childError) {
                console.log(`[Task Details] Could not fetch child page ${block.id}`);
              }
            }
          }
          description = textBlocks.filter(text => text.length > 0).join('\n');
        } catch (blockError) {
          console.log(`[Task Details] Could not fetch content for ${taskId}`);
        }
        
        // Also get subtasks from relations
        const subtaskRelations = properties.Subtasks?.relation || [];
        for (const subtaskRef of subtaskRelations) {
          try {
            const subtaskPage = await notion.pages.retrieve({ page_id: subtaskRef.id });
            const subtaskProperties = (subtaskPage as any).properties || {};
            const subtaskTitleProperty = subtaskProperties.Title || subtaskProperties.Name || 
                                        subtaskProperties.Task || subtaskProperties['Task name'] ||
                                        Object.values(subtaskProperties).find((prop: any) => prop.type === 'title');
            
            subtasks.push({
              id: subtaskRef.id,
              title: extractTextFromProperty(subtaskTitleProperty) || 'Untitled Subtask',
              type: 'relation',
              url: (subtaskPage as any).url,
              status: subtaskProperties.Status?.select?.name || subtaskProperties.Status?.status?.name || 'No Status',
              createdTime: (subtaskPage as any).created_time,
              lastEditedTime: (subtaskPage as any).last_edited_time
            });
            console.log(`[Task Details] Found subtask relation: ${extractTextFromProperty(subtaskTitleProperty)}`);
          } catch (subtaskError) {
            console.log(`[Task Details] Could not fetch subtask ${subtaskRef.id}`);
          }
        }
        
        console.log(`[Task Details] Found ${subtasks.length} subtasks for ${title}`);
        
        const task = {
          id: page.id,
          title: title,
          status: properties.Status?.select?.name || properties.Status?.status?.name || 'No Status',
          priority: properties.Priority?.select?.name || null,
          assignee: properties.Assignee?.people?.[0]?.name || 
                   (properties.People?.people?.[0]?.name) || null,
          dueDate: properties['Due Date']?.date?.start || properties.Due?.date?.start || null,
          createdTime: (page as any).created_time,
          lastEditedTime: (page as any).last_edited_time,
          url: (page as any).url,
          project: properties.Project?.relation?.[0]?.id || null,
          description: description || extractTextFromProperty(properties.Description) || 'No description available',
          subtasks: subtasks,
          properties: properties
        };

        res.json(task);
      } catch (pageError) {
        console.error(`[Task Details] Error fetching page ${taskId}:`, pageError);
        res.status(404).json({ 
          message: "Task not found or not accessible",
          error: "This task may not be shared with the integration",
          taskId
        });
      }
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ 
        message: "Failed to fetch task",
        error: (error as Error).message 
      });
    }
  });

  // Get detailed page structure for a project
  app.get("/api/project/:projectId/structure", async (req, res) => {
    try {
      const { projectId } = req.params;
      const userEmail = req.headers['x-user-email'] as string;
      
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      // Get user's Notion configuration
      let config = await storage.getConfiguration(userEmail);
      if (!config) {
        config = await getAdminConfiguration();
        if (!config) {
          return res.status(404).json({ message: "Notion configuration not found" });
        }
      }

      const notion = createNotionClient(config.notionSecret);
      
      console.log(`[Project Structure] Analyzing project page: ${projectId}`);
      
      // Get child blocks of the project page
      const childBlocks = await notion.blocks.children.list({
        block_id: projectId,
        page_size: 100
      });

      const databases = [];
      const pages = [];

      for (const block of childBlocks.results) {
        if (block.type === 'child_database') {
          try {
            const dbInfo = await notion.databases.retrieve({
              database_id: block.id
            });
            databases.push({
              id: block.id,
              title: (dbInfo as any).title?.[0]?.plain_text || 'Untitled Database',
              type: 'database'
            });
            console.log(`[Project Structure] Found database: ${(dbInfo as any).title?.[0]?.plain_text || 'Untitled'}`);
          } catch (dbError) {
            console.error(`[Project Structure] Error retrieving database ${block.id}:`, dbError);
          }
        } else if (block.type === 'child_page') {
          pages.push({
            id: block.id,
            title: (block as any).child_page?.title || 'Untitled Page',
            type: 'page'
          });
          console.log(`[Project Structure] Found page: ${(block as any).child_page?.title || 'Untitled'}`);
        }
      }

      res.json({
        projectId,
        databases,
        pages,
        totalChildren: childBlocks.results.length
      });
    } catch (error) {
      console.error("Error fetching project structure:", error);
      res.status(500).json({ 
        message: "Failed to fetch project structure",
        error: (error as Error).message 
      });
    }
  });

  // Debug endpoint to inspect Notion page structure
  app.get("/api/debug/notion-page", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const config = await storage.getConfiguration(userEmail);
      if (!config || !config.notionSecret || !config.notionPageUrl) {
        return res.status(400).json({ message: "Notion configuration not found" });
      }

      const notion = createNotionClient(config.notionSecret);
      const pageId = extractPageIdFromUrl(config.notionPageUrl);

      // Get basic page info
      const pageInfo = await notion.pages.retrieve({ page_id: pageId });
      
      // Get page blocks
      const blocksResponse = await notion.blocks.children.list({
        block_id: pageId,
        page_size: 100
      });

      // Get detailed block info
      const blockDetails = blocksResponse.results.map((block: any) => ({
        id: block.id,
        type: block.type,
        has_children: block.has_children,
        // Add specific block content based on type
        ...(block.type === 'child_page' && { title: block.child_page?.title }),
        ...(block.type === 'child_database' && { title: block.child_database?.title })
      }));

      res.json({
        pageId,
        pageUrl: config.notionPageUrl,
        pageInfo: {
          id: pageInfo.id,
          created_time: pageInfo.created_time,
          last_edited_time: pageInfo.last_edited_time,
          url: pageInfo.url
        },
        totalBlocks: blocksResponse.results.length,
        hasMore: blocksResponse.has_more,
        blocks: blockDetails
      });
    } catch (error) {
      console.error("Error debugging Notion page:", error);
      res.status(500).json({ 
        message: "Failed to debug Notion page",
        error: error.message 
      });
    }
  });

  // Get project summary data with financial information
  app.get("/api/notion-project-summary", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      const config = await storage.getConfiguration(userEmail);
      if (!config) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      const notion = createNotionClient(config.notionSecret);
      const pageId = extractPageIdFromUrl(config.notionPageUrl);
      
      // Get filtered database records for the user
      const projects = await getFilteredDatabaseRecords(notion, pageId, userEmail);
      
      const projectSummary = projects.map(project => {
        const props = project.properties;
        
        // Extract completion percentage
        const completion = props.Completion?.number || 0;
        
        // Extract proposal - check for file links
        let proposal = 'Not Set';
        let proposalUrl = null;
        if (props.Proposal?.files && props.Proposal.files.length > 0) {
          const file = props.Proposal.files[0];
          proposal = file.name || 'Proposal File';
          proposalUrl = file.file?.url || file.external?.url;
        } else if (props.Proposal?.select?.name || props.Proposal?.status?.name) {
          proposal = props.Proposal.select?.name || props.Proposal.status?.name;
        }
        
        // Extract materials proposal - check for file links
        let materialsProposal = 'Not Set';
        let materialsProposalUrl = null;
        if (props['Materials Proposal']?.files && props['Materials Proposal'].files.length > 0) {
          const file = props['Materials Proposal'].files[0];
          materialsProposal = file.name || 'Materials Proposal File';
          materialsProposalUrl = file.file?.url || file.external?.url;
        } else if (props['Materials Proposal']?.select?.name || props['Materials Proposal']?.status?.name) {
          materialsProposal = props['Materials Proposal'].select?.name || props['Materials Proposal'].status?.name;
        }
        
        // Extract project price
        const projectPrice = props['Project Price']?.number || 0;
        
        // Extract total payments (comma-separated text)
        const totalPayments = props['Total Payments']?.rich_text?.[0]?.plain_text || 
                             props['Total Payments']?.title?.[0]?.plain_text || '';
        
        return {
          id: project.notionId,
          title: project.title,
          completion,
          proposal,
          proposalUrl,
          materialsProposal,
          materialsProposalUrl,
          projectPrice,
          totalPayments,
          url: project.url
        };
      });
      
      res.json(projectSummary);
    } catch (error) {
      console.error("Error fetching project summary:", error);
      res.status(500).json({ message: "Failed to fetch project summary" });
    }
  });

  // Email templates management endpoints
  app.get("/api/admin/email-templates", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Return default templates for now - in a real implementation, these would be stored in database
      const defaultTemplates = [
        {
          id: "status-change",
          name: "Status Change Notification",
          subject: "Task Status Update: {{taskTitle}} - {{newStatus}}",
          description: "Sent when a task status changes (Planning, In Progress, Done, etc.)",
          variables: ["taskTitle", "projectName", "oldStatus", "newStatus", "userEmail", "assigneeEmail", "taskUrl", "dueDate", "priority"],
          htmlBody: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Status Update</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: #003319; padding: 40px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 20px; }
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; margin: 4px; }
        .status-blue { background-color: #dbeafe; color: #1e40af; }
        .status-yellow { background-color: #fef3c7; color: #b45309; }
        .status-green { background-color: #dcfce7; color: #166534; }
        .status-red { background-color: #fee2e2; color: #b91c1c; }
        .status-purple { background-color: #f3e8ff; color: #7c3aed; }
        .task-details { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { background: #003319; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://9e760ea8-1fc2-408e-8f04-d26e825e4da9-00-gcvaj0c4tpmq.picard.replit.dev/attached_assets/VertexDevelopments_1751826186443.png" alt="Vertex Developments" style="width: 120px; height: auto; margin-bottom: 15px;">
            <h1>{{urgencyIndicator}} Task Status Update</h1>
        </div>
        <div class="content">
            <h2>{{taskTitle}}</h2>
            <p>{{statusChangeMessage}}</p>
            <div style="margin: 20px 0;">
                <span class="status-badge status-{{oldStatusColor}}">{{oldStatus}}</span>
                <span style="margin: 0 10px;">→</span>
                <span class="status-badge status-{{newStatusColor}}">{{newStatus}}</span>
            </div>
            <div class="task-details">
                <p><strong>Project:</strong> {{projectName}}</p>
                {{#if dueDate}}<p><strong>Due Date:</strong> {{dueDate}}</p>{{/if}}
                {{#if priority}}<p><strong>Priority:</strong> {{priority}}</p>{{/if}}
                <p><strong>Assigned to:</strong> {{assigneeEmail}}</p>
            </div>
            <a href="{{taskUrl}}" class="button">View Task in Notion</a>
        </div>
        <div class="footer">
            <p>This notification was sent because you are assigned to this task.</p>
            <p>Task management powered by Notion</p>
        </div>
    </div>
</body>
</html>`,
          textBody: `Task Status Update: {{taskTitle}}

{{statusChangeMessage}}

Status changed from "{{oldStatus}}" to "{{newStatus}}"

Project: {{projectName}}
{{#if dueDate}}Due Date: {{dueDate}}{{/if}}
{{#if priority}}Priority: {{priority}}{{/if}}
Assigned to: {{assigneeEmail}}

View task: {{taskUrl}}

This notification was sent because you are assigned to this task.`
        },
        {
          id: "task-reminder",
          name: "Task Reminder",
          subject: "Reminder: {{taskTitle}} is due {{dueDate}}",
          description: "Sent as a reminder for upcoming task deadlines",
          variables: ["taskTitle", "projectName", "dueDate", "assigneeEmail", "taskUrl", "priority"],
          htmlBody: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Reminder</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 20px; }
        .reminder-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Task Reminder</h1>
        </div>
        <div class="content">
            <h2>{{taskTitle}}</h2>
            <div class="reminder-box">
                <p><strong>This task is due: {{dueDate}}</strong></p>
                <p>Project: {{projectName}}</p>
                {{#if priority}}<p>Priority: {{priority}}</p>{{/if}}
            </div>
            <a href="{{taskUrl}}" class="button">View Task in Notion</a>
        </div>
        <div class="footer">
            <p>Don't forget to update your task progress!</p>
        </div>
    </div>
</body>
</html>`,
          textBody: `Task Reminder: {{taskTitle}}

This task is due: {{dueDate}}

Project: {{projectName}}
{{#if priority}}Priority: {{priority}}{{/if}}

View task: {{taskUrl}}

Don't forget to update your task progress!`
        }
      ];

      res.json(defaultTemplates);
    } catch (error) {
      console.error("Error fetching email templates:", error);
      res.status(500).json({ message: "Failed to fetch email templates" });
    }
  });

  app.post("/api/admin/email-templates", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail || userEmail !== "basiliskan@gmail.com") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const template = req.body;
      
      // In a real implementation, save to database
      // For now, just return success
      console.log(`[Email Templates] Template "${template.name}" saved by admin`);
      
      res.json({ 
        message: "Template saved successfully",
        template 
      });
    } catch (error) {
      console.error("Error saving email template:", error);
      res.status(500).json({ message: "Failed to save email template" });
    }
  });

  // Status change notification endpoint
  app.post("/api/tasks/:taskId/status-change", async (req, res) => {
    try {
      const { taskId } = req.params;
      const { oldStatus, newStatus, userEmail, taskTitle, projectName, assigneeEmail, taskUrl, dueDate, priority } = req.body;

      // Validate required fields
      if (!oldStatus || !newStatus || !userEmail || !taskTitle) {
        return res.status(400).json({
          message: "Missing required fields: oldStatus, newStatus, userEmail, taskTitle"
        });
      }

      // Skip notification if status hasn't actually changed
      if (oldStatus === newStatus) {
        return res.status(200).json({
          message: "Status unchanged, no notification sent"
        });
      }

      console.log(`[Status Change] Task "${taskTitle}" changed from "${oldStatus}" to "${newStatus}"`);

      // Send status change notification
      const notificationSent = await statusNotificationService.sendStatusChangeEmail({
        taskTitle,
        projectName: extractProjectName(task),
        oldStatus,
        newStatus,
        assigneeEmail,
        userEmail,
        taskUrl: taskUrl || `https://notion.so/${taskId}`,
        dueDate,
        priority
      });

      res.status(200).json({
        message: notificationSent ? "Status change notification sent" : "Notification failed to send",
        notificationSent,
        statusChange: {
          from: oldStatus,
          to: newStatus,
          task: taskTitle,
          recipient: assigneeEmail || userEmail
        }
      });

    } catch (error) {
      console.error("Status change notification error:", error);
      res.status(500).json({
        message: "Failed to send status change notification",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get all available statuses from Notion databases dynamically
  app.get("/api/notion-statuses", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      let config = await storage.getConfiguration(userEmail);
      if (!config) {
        try {
          config = await getAdminConfiguration();
        } catch (error) {
          return res.status(404).json({ message: "Configuration not found" });
        }
      }

      const notion = createNotionClient(config.notionSecret);
      
      // Get user's project records to extract task IDs
      const pageId = extractPageIdFromUrl(config.notionPageUrl);
      const databaseRecords = await getFilteredDatabaseRecords(notion, pageId, userEmail);
      
      const allTaskIds = new Set<string>();
      const projectMapping = new Map<string, string>();

      // Process all projects and extract task IDs
      for (const record of databaseRecords) {
        const projectName = extractTextFromProperty(record.properties?.['Project name']) || 'Unknown Project';
        
        if (record.properties?.Tasks?.relation) {
          for (const task of record.properties.Tasks.relation) {
            allTaskIds.add(task.id);
            projectMapping.set(task.id, projectName);
          }
        }
      }

      const statusColorMap = new Map<string, string>();

      // Sample a few tasks from different projects to get comprehensive status options
      const sampleTaskIds = Array.from(allTaskIds).slice(0, 10); // Sample first 10 tasks
      
      for (const taskId of sampleTaskIds) {
        try {
          const page = await notion.pages.retrieve({ page_id: taskId });
          const properties = (page as any).properties || {};
          
          // Use the improved status extraction function
          const { statusName, statusColor } = extractNotionStatus(properties);
          
          if (statusName && statusName !== 'To-do') {
            statusColorMap.set(statusName, statusColor);
          }
        } catch (taskError) {
          console.log(`[Status Discovery] Could not fetch task ${taskId}:`, taskError.message);
        }
      }

      // Also get status options from database schema if available
      let databaseStatusOptions = [];
      try {
        // Try to get the database schema from one of the tasks
        if (sampleTaskIds.length > 0) {
          const sampleTask = await notion.pages.retrieve({ page_id: sampleTaskIds[0] });
          const databaseId = (sampleTask as any).parent?.database_id;
          
          if (databaseId) {
            const database = await notion.databases.retrieve({ database_id: databaseId });
            const statusProperty = Object.values((database as any).properties || {}).find((prop: any) => 
              prop.type === 'status' || (prop.name && prop.name.toLowerCase().includes('status'))
            ) as any;
            
            if (statusProperty && statusProperty.status?.options) {
              databaseStatusOptions = statusProperty.status.options.map((option: any) => ({
                name: option.name,
                color: option.color
              }));
            }
          }
        }
      } catch (schemaError) {
        console.log(`[Status Discovery] Could not fetch database schema:`, schemaError.message);
      }

      // Combine discovered statuses with database schema options
      const allStatusOptions = new Map<string, string>();
      
      // Add statuses discovered from actual tasks
      statusColorMap.forEach((color, name) => {
        allStatusOptions.set(name, color);
      });
      
      // Add statuses from database schema if available
      databaseStatusOptions.forEach((option: any) => {
        if (!allStatusOptions.has(option.name)) {
          allStatusOptions.set(option.name, option.color);
        }
      });

      // Create final status options array
      const statusOptionsArray = Array.from(allStatusOptions.entries()).map(([name, color]) => ({
        name,
        color
      }));

      console.log(`[Status Options with Colors from Tasks]`, statusOptionsArray);
      
      res.json(statusOptionsArray);
    } catch (error) {
      console.error("Error fetching statuses:", error);
      res.status(500).json({ message: "Failed to fetch statuses" });
    }
  });

  // Requests API endpoint
  app.post("/api/requests", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      const { content, requestType } = req.body;

      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      if (!content || !requestType) {
        return res.status(400).json({ message: "Content and request type are required" });
      }

      if (requestType !== '/request' && requestType !== '/ai') {
        return res.status(400).json({ message: "Invalid request type. Must be '/request' or '/ai'" });
      }

      console.log(`[Requests] ${requestType} from ${userEmail}: ${content}`);

      if (requestType === '/request') {
        // Handle admin request - for now just log it
        // In the future, this could send an email or create a ticket
        console.log(`[Admin Request] User ${userEmail} sent: ${content}`);
        
        res.json({ 
          success: true, 
          message: "Request sent to admin successfully" 
        });
      } else if (requestType === '/ai') {
        // Handle AI request with Notion context integration
        console.log(`[AI Request] User ${userEmail} asked: ${content}`);
        
        try {
          // Import AI service dynamically to avoid circular dependencies
          const { aiService } = await import('./aiService');
          
          // Generate AI response based on user's Notion data
          const aiResponse = await aiService.generateResponse(userEmail, content);
          
          res.json({ 
            success: true, 
            response: aiResponse 
          });
        } catch (error) {
          console.error(`[AI Request] Error generating AI response:`, error);
          
          // Provide helpful error messages based on the error type
          let errorMessage = "I encountered an error while processing your request.";
          
          if (error.message.includes("OpenAI API key")) {
            errorMessage = "AI features require an OpenAI API key. Please ask an administrator to configure the OPENAI_API_KEY environment variable.";
          } else if (error.message.includes("Notion configuration")) {
            errorMessage = "I need access to your Notion workspace to provide personalized responses. Please make sure your Notion integration is properly configured in Settings.";
          }
          
          res.json({ 
            success: false, 
            response: errorMessage,
            error: error.message 
          });
        }
      }

    } catch (error) {
      console.error("Error handling request:", error);
      res.status(500).json({ 
        message: "Failed to process request",
        error: (error as Error).message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper functions for extracting Notion properties
function extractTextFromProperty(property: any): string {
  if (!property) return "";
  
  if (property.type === "title" && property.title?.length > 0) {
    return property.title[0]?.plain_text || "";
  }
  if (property.type === "rich_text" && property.rich_text?.length > 0) {
    return property.rich_text[0]?.plain_text || "";
  }
  if (property.type === "phone_number") {
    return property.phone_number || "";
  }
  return "";
}

function extractEmailFromProperty(property: any): string {
  if (!property) return "";
  
  if (property.type === "email") {
    return property.email || "";
  }
  if (property.type === "rich_text" && property.rich_text?.length > 0) {
    const text = property.rich_text[0]?.plain_text || "";
    // Basic email validation
    if (text.includes("@")) {
      return text;
    }
  }
  return "";
}

function extractProjectName(task: any): string {
  // Strategy 1: Use the task title to infer project (Greek tasks for Vertex)
  const title = task.title.toLowerCase();
  
  if (title.includes('αποξηλώσ') || title.includes('υδραυλ') || title.includes('ηλεκτρολογ') || title.includes('θέρμανση')) {
    return 'Vertex Developments';
  } else if (title.includes('ethos') || title.includes('ai') || title.includes('starter') || title.includes('zohomails') || title.includes('saas')) {
    return 'ethos';
  } else if (title.includes('creative') || title.includes('design')) {
    return 'creativeG';
  } else if (title.includes('template') || title.includes('example')) {
    return 'Project Template';
  }
  
  // Strategy 2: Use section if it's not "Uncategorized"
  if (task.section && task.section !== 'Uncategorized') {
    return task.section;
  }
  
  // Strategy 3: Check URL patterns for project identification
  if (task.url) {
    const url = task.url.toLowerCase();
    if (url.includes('vertex')) {
      return 'Vertex Developments';
    } else if (url.includes('ethos')) {
      return 'ethos';
    } else if (url.includes('creative')) {
      return 'creativeG';
    }
  }
  
  // Strategy 4: Group by task type based on properties
  if (task.properties) {
    const hasTaskProgress = task.properties['Task Progress'];
    const hasProjectStatus = task.properties['Project Status'];
    
    if (hasProjectStatus && hasProjectStatus.rollup && hasProjectStatus.rollup.array) {
      // This indicates it's part of a project structure
      if (title.includes('gmail') || title.includes('saas') || title.includes('ai')) {
        return 'ethos';
      } else {
        return 'Development Tasks';
      }
    }
  }
  
  return 'Development Tasks';
}

function extractNotionStatus(properties: any, taskTitle?: string): { statusName: string; statusColor: string } {
  // Priority order: 1) Direct Status field 2) Select field 3) Rollup field
  // This ensures we get the task's actual status, not the project status
  
  let statusName = 'To-do'; // More generic default
  let statusColor = 'gray';
  let statusFound = false;
  
  // First, look for direct status fields (highest priority)
  const directStatusKey = Object.keys(properties).find(key => 
    key === 'Status' || 
    key === 'notion%3A%2F%2Ftasks%2Fstatus_property' ||
    (key.includes('status') && properties[key].type === 'status')
  );
  
  if (directStatusKey && properties[directStatusKey].status) {
    const statusField = properties[directStatusKey];
    statusName = statusField.status.name;
    statusColor = statusField.status.color;
    statusFound = true;
    
    if (taskTitle) {
      console.log(`[Status Debug ${taskTitle}] Direct status field '${directStatusKey}' - Name: ${statusName}, Color: ${statusColor}`);
    }
  }
  
  // Second, look for select fields if no direct status found
  if (!statusFound) {
    const selectStatusKey = Object.keys(properties).find(key => 
      key.includes('status') && properties[key].type === 'select'
    );
    
    if (selectStatusKey && properties[selectStatusKey].select) {
      const statusField = properties[selectStatusKey];
      statusName = statusField.select.name;
      statusColor = statusField.select.color;
      statusFound = true;
      
      if (taskTitle) {
        console.log(`[Status Debug ${taskTitle}] Select status field '${selectStatusKey}' - Name: ${statusName}, Color: ${statusColor}`);
      }
    }
  }
  
  // Third, look for multi-select fields
  if (!statusFound) {
    const multiSelectStatusKey = Object.keys(properties).find(key => 
      key.includes('status') && properties[key].type === 'multi_select'
    );
    
    if (multiSelectStatusKey && properties[multiSelectStatusKey].multi_select?.length > 0) {
      const statusField = properties[multiSelectStatusKey];
      statusName = statusField.multi_select[0].name;
      statusColor = statusField.multi_select[0].color;
      statusFound = true;
      
      if (taskTitle) {
        console.log(`[Status Debug ${taskTitle}] Multi-select status field '${multiSelectStatusKey}' - Name: ${statusName}, Color: ${statusColor}`);
      }
    }
  }
  
  // Last resort: rollup fields (lowest priority)
  if (!statusFound) {
    const rollupStatusKey = Object.keys(properties).find(key => 
      key.includes('status') && properties[key].type === 'rollup'
    );
    
    if (rollupStatusKey && properties[rollupStatusKey].rollup?.array?.[0]?.status) {
      const statusField = properties[rollupStatusKey];
      statusName = statusField.rollup.array[0].status.name;
      statusColor = statusField.rollup.array[0].status.color;
      statusFound = true;
      
      if (taskTitle) {
        console.log(`[Status Debug ${taskTitle}] Rollup status field '${rollupStatusKey}' - Name: ${statusName}, Color: ${statusColor}, Array Length: ${statusField.rollup.array.length}`);
        // Log all available statuses in the rollup array to understand the database schema
        console.log(`[Status Schema ${taskTitle}] All rollup statuses:`, statusField.rollup.array.map((item: any) => ({
          name: item.status?.name || 'No status',
          color: item.status?.color || 'no-color'
        })));
      }
    }
  }
  
  if (!statusFound && taskTitle) {
    console.log(`[Status Debug ${taskTitle}] No status field found, using default. Available properties: ${Object.keys(properties).join(', ')}`);
  }
  
  return { statusName, statusColor };
}

function mapNotionStatusToLocal(notionStatus: string | null, isCompleted: boolean): string {
  if (isCompleted || (notionStatus && notionStatus.toLowerCase() === 'done')) {
    return 'completed';
  }
  
  if (notionStatus && notionStatus.toLowerCase() === 'in progress') {
    return 'pending';
  }
  
  return 'not_started';
}

function calculateProgress(properties: any, status: string | null, isCompleted: boolean): number {
  if (isCompleted || status?.toLowerCase() === 'done') {
    return 100;
  }
  
  // Check for Notion's Task Progress rollup field first (this is the most accurate)
  if (properties?.['Task Progress']?.rollup?.number !== undefined) {
    return Math.round(properties['Task Progress'].rollup.number * 100); // Convert 0.2 to 20%
  }
  
  // Check if there's a specific progress property in Notion
  if (properties?.Progress?.number !== undefined) {
    return properties.Progress.number;
  }
  
  if (properties?.['% Complete']?.number !== undefined) {
    return properties['% Complete'].number;
  }
  
  if (properties?.Percentage?.number !== undefined) {
    return properties.Percentage.number;
  }
  
  // Fallback to status-based calculation
  if (status?.toLowerCase() === 'in progress') {
    return 20; // Use 20% as default for in-progress instead of 50%
  }
  
  return 0;
}

function getIconForViewType(viewType: string): string {
  switch (viewType) {
    case 'tasks': return '✅';
    case 'materials': return '📦';
    case 'notes': return '📝';
    case 'payments': return '💰';
    default: return '📄';
  }
}

function getSortOrderForViewType(viewType: string): number {
  switch (viewType) {
    case 'tasks': return 1;
    case 'materials': return 2;
    case 'notes': return 3;
    case 'payments': return 4;
    default: return 99;
  }
}

