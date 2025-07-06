import { Client } from "@notionhq/client";
import OpenAI from "openai";
import { storage } from "./storage";
import { getTasks, getFilteredDatabaseRecords, discoverWorkspacePages } from "./notion";

interface UserNotionContext {
  tasks: any[];
  projects: any[];
  databases: any[];
  recentActivity: any[];
}

export class AIService {
  private openai: OpenAI | null = null;

  constructor() {
    this.initializeOpenAI();
  }

  /**
   * Initialize OpenAI client with API key from storage or environment
   */
  private async initializeOpenAI() {
    try {
      const { storage } = await import('./storage');
      const storedKey = await storage.getApiSetting('openaiApiKey');
      const apiKey = storedKey || process.env.OPENAI_API_KEY;
      
      if (apiKey) {
        this.openai = new OpenAI({ 
          apiKey: apiKey 
        });
      }
    } catch (error) {
      console.log('[AI Service] Could not access storage, using environment variable only');
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({ 
          apiKey: process.env.OPENAI_API_KEY 
        });
      }
    }
  }

  /**
   * Gather comprehensive context about the user's Notion workspace
   */
  async gatherUserContext(userEmail: string): Promise<UserNotionContext> {
    try {
      // Get user's Notion configuration
      const config = await storage.getConfiguration(userEmail);
      if (!config || !config.notionSecret || !config.notionPageUrl) {
        throw new Error("User does not have Notion configuration");
      }

      const notion = new Client({ auth: config.notionSecret });
      const pageId = this.extractPageIdFromUrl(config.notionPageUrl);

      console.log(`[AI Context] Gathering context for user ${userEmail}`);

      // Gather all user data in parallel
      const [workspaceData, userTasks] = await Promise.all([
        this.gatherWorkspaceData(notion, pageId, userEmail),
        this.gatherUserTasks(notion, userEmail)
      ]);

      return {
        tasks: userTasks,
        projects: workspaceData.projects,
        databases: workspaceData.databases,
        recentActivity: workspaceData.recentActivity
      };

    } catch (error) {
      console.error(`[AI Context] Error gathering context for ${userEmail}:`, error);
      throw error;
    }
  }

  /**
   * Generate AI response based on user's question and their Notion context
   */
  async generateResponse(userEmail: string, question: string): Promise<string> {
    // Ensure OpenAI client is initialized with latest API key
    if (!this.openai) {
      await this.initializeOpenAI();
    }
    
    if (!this.openai) {
      throw new Error("OpenAI API key not configured. Please add OPENAI_API_KEY to environment variables.");
    }

    try {
      // Gather user's Notion context
      const context = await this.gatherUserContext(userEmail);
      
      // Create a comprehensive context summary
      const contextSummary = this.createContextSummary(context);
      
      // Generate AI response with context
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that helps users manage their projects and tasks in Notion. You have access to the user's actual Notion database content and should provide helpful, specific answers based on their real data.

Context about the user's workspace:
${contextSummary}

Guidelines:
- Always reference specific tasks, projects, or data from their Notion workspace when relevant
- Provide actionable insights based on their actual project status and progress
- If they ask about specific tasks or projects, use the exact names and details from their data
- Be helpful and conversational while staying focused on their project management needs
- If you don't have enough context to answer fully, suggest they provide more specific details`
          },
          {
            role: "user",
            content: question
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      const aiResponse = response.choices[0]?.message?.content;
      
      if (!aiResponse) {
        throw new Error("No response generated from AI");
      }

      console.log(`[AI Response] Generated response for ${userEmail}: ${aiResponse.substring(0, 100)}...`);
      
      return aiResponse;

    } catch (error) {
      console.error(`[AI Response] Error generating response for ${userEmail}:`, error);
      
      if (error.message.includes("OpenAI API key")) {
        return "I need an OpenAI API key to provide AI-powered responses. Please ask an administrator to configure the OPENAI_API_KEY environment variable.";
      }
      
      if (error.message.includes("Notion configuration")) {
        return "I need access to your Notion workspace to provide personalized responses. Please make sure your Notion integration is properly configured in Settings.";
      }
      
      return "I encountered an error while analyzing your Notion data. Please try again or contact support if the issue persists.";
    }
  }

  /**
   * Gather workspace data including projects and databases
   */
  private async gatherWorkspaceData(notion: Client, pageId: string, userEmail: string) {
    try {
      // Discover workspace structure
      const workspaceData = await discoverWorkspacePages(notion, pageId, userEmail);
      
      // Extract projects and databases
      const projects = workspaceData.subPages || [];
      const databases = [];
      const recentActivity = [];

      // Collect all databases from sub-pages
      for (const project of projects) {
        if (project.databases) {
          databases.push(...project.databases);
        }
      }

      // Get recent activity from databases
      for (const database of databases.slice(0, 3)) { // Limit to prevent too much data
        try {
          const records = await getFilteredDatabaseRecords(notion, database.id, userEmail);
          recentActivity.push(...records.slice(0, 5)); // Latest 5 records per database
        } catch (error) {
          console.log(`[AI Context] Could not fetch records from database ${database.id}:`, error);
        }
      }

      return {
        projects,
        databases,
        recentActivity
      };

    } catch (error) {
      console.error(`[AI Context] Error gathering workspace data:`, error);
      return {
        projects: [],
        databases: [],
        recentActivity: []
      };
    }
  }

  /**
   * Gather user's tasks from task databases
   */
  private async gatherUserTasks(notion: Client, userEmail: string) {
    try {
      // Get user's Notion views to find task databases
      const views = await storage.getNotionViews(userEmail);
      const taskViews = views.filter(view => 
        view.viewType === 'tasks' && view.databaseId && view.isActive
      );

      const allTasks = [];

      // Gather tasks from all task databases
      for (const view of taskViews) {
        try {
          const tasks = await getTasks(notion, view.databaseId!, userEmail);
          allTasks.push(...tasks);
        } catch (error) {
          console.log(`[AI Context] Could not fetch tasks from ${view.databaseId}:`, error);
        }
      }

      return allTasks;

    } catch (error) {
      console.error(`[AI Context] Error gathering user tasks:`, error);
      return [];
    }
  }

  /**
   * Create a readable summary of the user's context
   */
  private createContextSummary(context: UserNotionContext): string {
    const { tasks, projects, databases, recentActivity } = context;

    let summary = "=== USER'S NOTION WORKSPACE CONTEXT ===\n\n";

    // Projects summary
    if (projects.length > 0) {
      summary += `PROJECTS (${projects.length}):\n`;
      projects.slice(0, 5).forEach(project => {
        summary += `- ${project.title} (${project.databaseCount} databases, ${project.recordCount} records)\n`;
      });
      summary += "\n";
    }

    // Tasks summary
    if (tasks.length > 0) {
      summary += `TASKS (${tasks.length} total):\n`;
      
      // Group by status
      const statusGroups = tasks.reduce((groups, task) => {
        const status = task.mainStatus || task.status || 'Unknown';
        if (!groups[status]) groups[status] = [];
        groups[status].push(task);
        return groups;
      }, {});

      Object.entries(statusGroups).forEach(([status, statusTasks]) => {
        summary += `- ${status}: ${statusTasks.length} tasks\n`;
        statusTasks.slice(0, 3).forEach(task => {
          summary += `  • ${task.title}${task.dueDate ? ` (due: ${task.dueDate})` : ''}\n`;
        });
      });
      summary += "\n";
    }

    // Databases summary
    if (databases.length > 0) {
      summary += `DATABASES (${databases.length}):\n`;
      databases.slice(0, 5).forEach(db => {
        summary += `- ${db.title} (${db.recordCount} records)\n`;
      });
      summary += "\n";
    }

    // Recent activity
    if (recentActivity.length > 0) {
      summary += `RECENT ACTIVITY (${recentActivity.length} items):\n`;
      recentActivity.slice(0, 5).forEach(item => {
        summary += `- ${item.title} (last edited: ${item.lastEditedTime})\n`;
      });
      summary += "\n";
    }

    if (tasks.length === 0 && projects.length === 0) {
      summary += "No specific project or task data found in the user's workspace.\n";
    }

    return summary;
  }

  /**
   * Extract page ID from Notion URL
   */
  private extractPageIdFromUrl(pageUrl: string): string {
    const match = pageUrl.match(/([a-f0-9]{32})(?:[?#]|$)/i);
    if (match && match[1]) {
      return match[1];
    }
    throw new Error("Failed to extract page ID from URL");
  }
}

export const aiService = new AIService();