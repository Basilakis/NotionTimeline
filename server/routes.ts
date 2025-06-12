import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTaskSchema, insertConfigurationSchema, insertUserSchema } from "@shared/schema";
import { createNotionClient, createNotionAPI, getTasks as getNotionTasks, findDatabaseByTitle, extractPageIdFromUrl, getNotionDatabases, getFilteredDatabaseRecords } from "./notion";
import { insertNotionViewSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, name } = insertUserSchema.parse(req.body);
      
      let user = await storage.getUserByEmail(email);
      if (!user) {
        user = await storage.createUser({ email, name });
      } else {
        await storage.updateUserLastLogin(email);
      }
      
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid login data",
          errors: error.errors 
        });
      }
      console.error("Error during login:", error);
      res.status(500).json({ message: "Failed to login" });
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

  // Get task by ID
  app.get("/api/tasks/:id", async (req, res) => {
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
          progress: calculateProgress(notionTask.status, notionTask.isCompleted),
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

      const views = await storage.getNotionViews(userEmail);
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
      const adminConfig = await storage.getConfiguration('admin') || 
                          await storage.getConfiguration(process.env.ADMIN_EMAIL || '');
      
      if (!adminConfig) {
        return res.status(400).json({ message: "Admin configuration not found. Please set up the workspace first." });
      }

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
          url: db.url
        }))
      });
    } catch (error) {
      console.error("Error auto-setting up workspace:", error);
      res.status(500).json({ message: "Failed to auto-setup workspace" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function mapNotionStatusToLocal(notionStatus: string | null, isCompleted: boolean): string {
  if (isCompleted || notionStatus?.toLowerCase() === 'done') {
    return 'completed';
  }
  
  if (notionStatus?.toLowerCase() === 'in progress') {
    return 'pending';
  }
  
  return 'not_started';
}

function calculateProgress(status: string | null, isCompleted: boolean): number {
  if (isCompleted || status?.toLowerCase() === 'done') {
    return 100;
  }
  
  if (status?.toLowerCase() === 'in progress') {
    return 50;
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
