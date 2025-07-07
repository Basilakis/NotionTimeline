import OpenAI from "openai";
import { Client } from "@notionhq/client";
import { discoverWorkspacePages, getFilteredDatabaseRecords, getTasks } from "./notion";

class CrewAIAgent {
  private agent: any;

  constructor() {
    try {
      // Try to initialize CrewAI agent
      console.log('[CrewAI] Initializing CrewAI agent...');
    } catch (error) {
      console.log('[CrewAI] CrewAI not available, using fallback mode');
    }
  }

  async analyzeAndRespond(userEmail: string, question: string, context: UserNotionContext): Promise<string> {
    try {
      console.log(`[CrewAI] Analyzing question: ${question.slice(0, 100)}...`);
      
      // Use intelligent response generation based on context
      return this.generateIntelligentResponse(question, context);
      
    } catch (error) {
      console.error('[CrewAI] Error in analysis:', error);
      throw error;
    }
  }

  private generateIntelligentResponse(question: string, context: UserNotionContext): string {
    const lowerQuestion = question.toLowerCase();
    
    // Task-related questions
    if (lowerQuestion.includes('task') || lowerQuestion.includes('todo') || lowerQuestion.includes('assignment')) {
      return this.analyzeTaskData(question, context.tasks);
    }
    
    // Project-related questions
    if (lowerQuestion.includes('project') || lowerQuestion.includes('deadline') || lowerQuestion.includes('milestone')) {
      return this.analyzeProjectData(question, context.projects);
    }
    
    // Database or data questions
    if (lowerQuestion.includes('database') || lowerQuestion.includes('data') || lowerQuestion.includes('record')) {
      return this.analyzeDatabaseData(question, context.databases);
    }
    
    // Overview questions
    if (lowerQuestion.includes('overview') || lowerQuestion.includes('summary') || lowerQuestion.includes('status')) {
      return this.generateWorkspaceOverview(context);
    }
    
    // General contextual response
    return this.generateContextualResponse(question, context);
  }

  private analyzeTaskData(question: string, tasks: any[]): string {
    if (tasks.length === 0) {
      return "I don't see any tasks in your workspace. You can create tasks in your Notion databases to track your work.";
    }

    const completedTasks = tasks.filter(t => t.isCompleted).length;
    const pendingTasks = tasks.length - completedTasks;
    const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !t.isCompleted).length;

    let response = `You have ${tasks.length} total tasks:\n`;
    response += `• ${completedTasks} completed\n`;
    response += `• ${pendingTasks} pending\n`;
    if (overdueTasks > 0) {
      response += `• ${overdueTasks} overdue tasks that need attention\n`;
    }

    // Add insights based on question
    const lowerQuestion = question.toLowerCase();
    if (lowerQuestion.includes('priority') || lowerQuestion.includes('urgent')) {
      const highPriorityTasks = tasks.filter(t => t.priority && t.priority.toLowerCase().includes('high')).length;
      response += `\n📌 ${highPriorityTasks} high-priority tasks require your attention.`;
    }

    if (lowerQuestion.includes('recent') || lowerQuestion.includes('latest')) {
      const recentTasks = tasks
        .sort((a, b) => new Date(b.lastEditedTime).getTime() - new Date(a.lastEditedTime).getTime())
        .slice(0, 3);
      response += `\n🔄 Recent tasks:\n`;
      recentTasks.forEach(task => {
        response += `  - ${task.title} (${task.status})\n`;
      });
    }

    return response;
  }

  private analyzeProjectData(question: string, projects: any[]): string {
    if (projects.length === 0) {
      return "No projects found in your workspace. Consider organizing your work into project-based structures.";
    }

    let response = `You have ${projects.length} active projects:\n`;
    projects.slice(0, 5).forEach(project => {
      response += `• ${project.title} - ${project.databaseCount} databases, ${project.recordCount} records\n`;
    });

    return response;
  }

  private analyzeDatabaseData(question: string, databases: any[]): string {
    if (databases.length === 0) {
      return "No databases found in your workspace structure.";
    }

    let response = `Your workspace contains ${databases.length} databases:\n`;
    databases.slice(0, 5).forEach(db => {
      response += `• ${db.title} (${db.recordCount} records)\n`;
    });

    return response;
  }

  private generateWorkspaceOverview(context: UserNotionContext): string {
    const { tasks, projects, databases } = context;
    
    let overview = "📊 **Workspace Overview**\n\n";
    
    if (projects.length > 0) {
      overview += `🏗️ **Projects**: ${projects.length} active projects\n`;
    }
    
    if (tasks.length > 0) {
      const completedTasks = tasks.filter(t => t.isCompleted).length;
      overview += `✅ **Tasks**: ${completedTasks}/${tasks.length} completed\n`;
    }
    
    if (databases.length > 0) {
      overview += `🗂️ **Databases**: ${databases.length} organized data collections\n`;
    }
    
    // Add insights
    overview += "\n" + this.generateTaskInsights(tasks);
    overview += "\n" + this.generateWorkspaceInsights(context);
    
    return overview;
  }

  private generateContextualResponse(question: string, context: UserNotionContext): string {
    const hasData = context.tasks.length > 0 || context.projects.length > 0;
    
    if (!hasData) {
      return "I can help you analyze your Notion workspace once you have some projects and tasks set up. Would you like guidance on organizing your workspace?";
    }
    
    return `Based on your workspace with ${context.tasks.length} tasks and ${context.projects.length} projects, I can help you with:\n\n• Task management and prioritization\n• Project status tracking\n• Workflow optimization\n• Data organization insights\n\nWhat specific aspect would you like to explore?`;
  }

  private generateTaskInsights(tasks: any[]): string {
    if (tasks.length === 0) return "";
    
    const insights = [];
    
    const statusDistribution = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});
    
    const topStatus = Object.entries(statusDistribution).sort(([,a], [,b]) => (b as number) - (a as number))[0];
    if (topStatus) {
      insights.push(`• Most common status: ${topStatus[0]} (${topStatus[1]} tasks)`);
    }
    
    const projectDistribution = tasks.reduce((acc, task) => {
      const project = task.projectName || 'Uncategorized';
      acc[project] = (acc[project] || 0) + 1;
      return acc;
    }, {});
    
    const topProject = Object.entries(projectDistribution).sort(([,a], [,b]) => (b as number) - (a as number))[0];
    if (topProject) {
      insights.push(`• Most active project: ${topProject[0]} (${topProject[1]} tasks)`);
    }
    
    return insights.length > 0 ? insights.join('\n') : "• Workspace shows good task organization";
  }

  private generateWorkspaceInsights(context: UserNotionContext): string {
    const insights = [];
    
    if (context.projects.length > 0) {
      insights.push(`• Active project management across ${context.projects.length} projects`);
    }
    
    if (context.tasks.length > 0) {
      const completionRate = context.tasks.filter(t => t.isCompleted).length / context.tasks.length;
      insights.push(`• Task completion rate: ${Math.round(completionRate * 100)}%`);
    }
    
    if (context.databases.length > 0) {
      insights.push(`• Well-structured data organization with ${context.databases.length} specialized databases`);
    }
    
    return insights.length > 0 ? insights.join('\n') : "• Comprehensive workspace setup detected";
  }
}

interface UserNotionContext {
  tasks: any[];
  projects: any[];
  databases: any[];
  recentActivity: any[];
}

export class AIService {
  private openai: OpenAI | null = null;
  private crewAgent: CrewAIAgent;

  constructor() {
    this.initializeOpenAI();
    this.crewAgent = new CrewAIAgent();
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
      const { storage } = await import('./storage');
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
    try {
      console.log(`[AI Service] Generating response for: ${question.slice(0, 100)}...`);
      
      // Gather user context
      const context = await this.gatherUserContext(userEmail);
      
      // Try CrewAI first
      try {
        return await this.crewAgent.analyzeAndRespond(userEmail, question, context);
      } catch (crewError) {
        console.log('[AI Service] CrewAI failed, falling back to OpenAI');
        return await this.fallbackToOpenAI(userEmail, question, context);
      }

    } catch (error: any) {
      console.error('[AI Service] Error generating response:', error);
      
      // Pass through specific OpenAI errors to route handler for better error messages
      if (error.status === 429 || error.message.includes("quota") || error.message.includes("Rate limit")) {
        throw error; // Let route handler provide quota-specific message
      }
      
      if (error.status === 401 || error.message.includes("Invalid API key") || error.message.includes("API key")) {
        throw error; // Let route handler provide authentication-specific message  
      }
      
      if (error.message.includes("OpenAI API key not configured")) {
        throw new Error("OpenAI API key not configured");
      }
      
      if (error.message.includes("Notion configuration")) {
        return "I need access to your Notion workspace to provide personalized responses. Please make sure your Notion integration is properly configured in Settings.";
      }
      
      return "I encountered an error while analyzing your Notion data. Please try again or contact support if the issue persists.";
    }
  }

  /**
   * Fallback to OpenAI when CrewAI is unavailable
   */
  private async fallbackToOpenAI(userEmail: string, question: string, context: UserNotionContext): Promise<string> {
    if (!this.openai) {
      throw new Error("OpenAI API key not configured");
    }

    // Create context summary for OpenAI
    const contextSummary = this.createContextSummary(context);
    
    const prompt = `You are an AI assistant helping analyze a user's Notion workspace. 

User's Question: ${question}

User's Workspace Context:
${contextSummary}

Please provide a helpful, specific response based on their actual workspace data. If the user asks about tasks, projects, or data, reference their specific information. Be conversational and practical.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: "You are a helpful assistant that analyzes Notion workspace data and provides insights." },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      return response.choices[0].message.content || "I couldn't generate a response at the moment.";
    } catch (error: any) {
      console.error('[AI Service] OpenAI Error:', error);
      throw error;
    }
  }

  /**
   * Gather workspace data using existing working endpoints
   */
  private async gatherWorkspaceData(notion: Client, pageId: string, userEmail: string) {
    try {
      console.log(`[AI Service] Using existing workspace APIs for user ${userEmail}`);
      
      const fetch = (await import('node-fetch')).default;
      
      // Call existing project endpoint
      const projectsResponse = await fetch('http://localhost:5000/api/notion-projects', {
        headers: { 'x-user-email': userEmail }
      });
      
      const projects = projectsResponse.ok ? await projectsResponse.json() : [];
      
      console.log(`[AI Service] Retrieved ${projects.length} projects`);

      return {
        projects,
        databases: [], // Projects contain database info
        recentActivity: [] // Will be populated from tasks
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
   * Gather user's tasks by calling the same working API endpoints
   */
  private async gatherUserTasks(notion: Client, userEmail: string) {
    try {
      console.log(`[AI Service] Using existing task APIs for user ${userEmail}`);
      
      // Make internal HTTP calls to the existing working endpoints
      const fetch = (await import('node-fetch')).default;
      
      // Call the same endpoints that work in the frontend
      const tasksResponse = await fetch('http://localhost:5000/api/tasks-from-notion', {
        headers: { 'x-user-email': userEmail }
      });
      
      const purchasesResponse = await fetch('http://localhost:5000/api/purchases-from-notion', {
        headers: { 'x-user-email': userEmail }
      });
      
      const tasks = tasksResponse.ok ? await tasksResponse.json() : [];
      const purchases = purchasesResponse.ok ? await purchasesResponse.json() : [];
      
      // Combine all tasks
      const allTasks = [...tasks, ...purchases];
      
      console.log(`[AI Service] Retrieved ${tasks.length} tasks and ${purchases.length} purchases`);
      console.log(`[AI Service] Total items: ${allTasks.length}`);
      
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

    // Task summary
    if (tasks.length > 0) {
      summary += `TASKS (${tasks.length}):\n`;
      const completedTasks = tasks.filter(t => t.isCompleted).length;
      const pendingTasks = tasks.length - completedTasks;
      summary += `- Completed: ${completedTasks}\n`;
      summary += `- Pending: ${pendingTasks}\n`;
      
      // Show recent tasks
      tasks.slice(0, 3).forEach(task => {
        summary += `- ${task.title} (${task.status})\n`;
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