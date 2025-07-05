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

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Check for specific admin credentials
      if (email === "basiliskan@gmail.com" && password === "MATERIALS123!@#bank") {
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
        return res.status(401).json({ 
          message: "Invalid credentials" 
        });
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

      // Check if views exist for this user
      let views = await storage.getNotionViews(userEmail);
      
      // If no views found and user is not admin, check if admin has Notion config and create demo views
      if (views.length === 0 && userEmail !== "basiliskan@gmail.com") {
        console.log(`[Notion Views] No views found for ${userEmail}, checking admin config for demo...`);
        
        const adminConfig = await storage.getConfiguration('basiliskan@gmail.com');
        if (adminConfig) {
          console.log(`[Notion Views] Admin config found, creating demo view for ${userEmail}...`);
          
          // Create a demo view using admin's database but for this user
          const demoView = await storage.createNotionView({
            userEmail: userEmail,
            viewType: 'projects',
            pageId: 'direct',
            databaseId: '07ede7dbc952491784e9c5022523e2e0', // Admin's database
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
        adminConfig = await storage.getConfiguration('basiliskan@gmail.com') || 
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
      const adminConfig = await storage.getConfiguration('basiliskan@gmail.com');
      
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
