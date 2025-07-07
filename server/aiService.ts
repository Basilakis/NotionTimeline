import OpenAI from "openai";
import { Client } from "@notionhq/client";
import { discoverWorkspacePages, getFilteredDatabaseRecords, getTasks } from "./notion";

class CrewAIAgent {
  private openai: OpenAI | null = null;

  constructor() {
    console.log('[CrewAI] Initializing CrewAI agent...');
    this.initializeOpenAI();
  }

  private async initializeOpenAI() {
    try {
      const { storage } = await import('./storage');
      const storedKey = await storage.getApiSetting('openaiApiKey');
      const apiKey = storedKey || process.env.OPENAI_API_KEY;
      
      if (apiKey) {
        this.openai = new OpenAI({ 
          apiKey: apiKey 
        });
        console.log('[CrewAI] OpenAI initialized successfully');
      } else {
        console.log('[CrewAI] No OpenAI API key available');
      }
    } catch (error) {
      console.log('[CrewAI] Could not access storage, using environment variable only');
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({ 
          apiKey: process.env.OPENAI_API_KEY 
        });
        console.log('[CrewAI] OpenAI initialized with environment key');
      }
    }
  }

  async analyzeAndRespond(userEmail: string, question: string, context: UserNotionContext): Promise<string> {
    try {
      console.log(`[CrewAI] Analyzing question: ${question.slice(0, 100)}...`);
      console.log(`[CrewAI] Context: ${context.tasks.length} tasks, ${context.projects.length} projects`);
      
      // If OpenAI is available, use AI-powered responses with real data
      if (this.openai) {
        return await this.generateAIResponse(question, context);
      } else {
        // Fallback to intelligent rule-based responses using real data
        return this.generateIntelligentResponse(question, context);
      }
      
    } catch (error) {
      console.error('[CrewAI] Error in analysis:', error);
      // Fallback to rule-based response if OpenAI fails
      return this.generateIntelligentResponse(question, context);
    }
  }

  private async generateAIResponse(question: string, context: UserNotionContext): Promise<string> {
    const contextSummary = this.createDetailedContextSummary(context);
    
    const prompt = `You are an AI assistant helping analyze a user's Notion workspace. Use the REAL data provided below to answer their question accurately.

REAL WORKSPACE DATA:
${contextSummary}

USER QUESTION: ${question}

INSTRUCTIONS:
- Use ONLY the real data provided above
- Be specific and mention actual task names, statuses, and projects 
- If asking about tasks "In Progress", list the actual task names with that status
- If asking about projects, mention the real project names
- Provide actionable insights based on the actual data
- Keep responses concise and helpful

Answer the user's question using their real Notion data:`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        temperature: 0.7
      });

      return response.choices[0].message.content || "I couldn't generate a response at this time.";
    } catch (error) {
      console.error('[CrewAI] OpenAI API error:', error);
      throw error;
    }
  }

  private createDetailedContextSummary(context: UserNotionContext): string {
    let summary = "=== REAL NOTION WORKSPACE DATA ===\n\n";
    
    // Tasks section
    if (context.tasks.length > 0) {
      summary += `TASKS (${context.tasks.length} total):\n`;
      context.tasks.forEach((task, index) => {
        summary += `${index + 1}. "${task.title}" - Status: ${task.status} - Project: ${task.projectName || 'Unknown'}\n`;
      });
      summary += "\n";
    } else {
      summary += "TASKS: No tasks found\n\n";
    }
    
    // Projects section
    if (context.projects.length > 0) {
      summary += `PROJECTS (${context.projects.length} total):\n`;
      context.projects.forEach((project, index) => {
        summary += `${index + 1}. "${project.title || project.name}"\n`;
      });
      summary += "\n";
    } else {
      summary += "PROJECTS: No projects found\n\n";
    }
    
    return summary;
  }

  private generateIntelligentResponse(question: string, context: UserNotionContext): string {
    const lowerQuestion = question.toLowerCase();
    
    console.log(`[CrewAI Fallback] Using real task data - ${context.tasks.length} tasks available`);
    
    // Status-specific questions
    if (lowerQuestion.includes('in progress') || lowerQuestion.includes('progress')) {
      const inProgressTasks = context.tasks.filter(task => 
        task.status && task.status.toLowerCase().includes('progress')
      );
      
      if (inProgressTasks.length > 0) {
        let response = `You have ${inProgressTasks.length} task(s) currently In Progress:\n\n`;
        inProgressTasks.forEach((task, index) => {
          response += `${index + 1}. "${task.title}" - Project: ${task.projectName || 'Unknown'}\n`;
        });
        return response;
      } else {
        return "You don't have any tasks currently In Progress. All tasks are either Not Started or Done.";
      }
    }
    
    // Task-related questions
    if (lowerQuestion.includes('task') || lowerQuestion.includes('todo') || lowerQuestion.includes('assignment')) {
      return this.analyzeRealTaskData(question, context.tasks);
    }
    
    // Project-related questions
    if (lowerQuestion.includes('project') || lowerQuestion.includes('deadline') || lowerQuestion.includes('milestone')) {
      return this.analyzeRealProjectData(question, context.projects);
    }
    
    // Overview questions
    if (lowerQuestion.includes('overview') || lowerQuestion.includes('summary') || lowerQuestion.includes('status')) {
      return this.generateRealWorkspaceOverview(context);
    }
    
    // General response with real data
    return this.generateRealContextualResponse(question, context);
  }

  private analyzeRealTaskData(question: string, tasks: any[]): string {
    if (tasks.length === 0) {
      return "I don't see any tasks in your workspace. You can create tasks in your Notion databases to track your work.";
    }

    // Group tasks by status
    const statusGroups = tasks.reduce((acc, task) => {
      const status = task.status || 'Unknown';
      if (!acc[status]) acc[status] = [];
      acc[status].push(task);
      return acc;
    }, {});

    let response = `Your Notion workspace has ${tasks.length} tasks:\n\n`;
    
    Object.entries(statusGroups).forEach(([status, statusTasks]) => {
      response += `**${status}** (${statusTasks.length} tasks):\n`;
      statusTasks.forEach((task, index) => {
        response += `  ${index + 1}. "${task.title}" - ${task.projectName || 'Unknown Project'}\n`;
      });
      response += '\n';
    });

    // Add insights based on question
    const lowerQuestion = question.toLowerCase();
    if (lowerQuestion.includes('priority') || lowerQuestion.includes('urgent')) {
      const highPriorityTasks = tasks.filter(t => t.priority && t.priority.toLowerCase().includes('high'));
      if (highPriorityTasks.length > 0) {
        response += `\n📌 High Priority Tasks:\n`;
        highPriorityTasks.forEach((task, index) => {
          response += `  ${index + 1}. "${task.title}"\n`;
        });
      }
    }

    if (lowerQuestion.includes('recent') || lowerQuestion.includes('latest')) {
      // Show most recently updated tasks
      const recentTasks = tasks
        .filter(t => t.lastEditedTime)
        .sort((a, b) => new Date(b.lastEditedTime).getTime() - new Date(a.lastEditedTime).getTime())
        .slice(0, 3);
      
      if (recentTasks.length > 0) {
        response += `\n🕒 Recently Updated Tasks:\n`;
        recentTasks.forEach((task, index) => {
          response += `  ${index + 1}. "${task.title}" - ${task.status}\n`;
        });
      }
    }

    return response;
  }

  private analyzeRealProjectData(question: string, projects: any[]): string {
    if (projects.length === 0) {
      return "I don't see any projects in your workspace yet.";
    }

    let response = `Your workspace has ${projects.length} projects:\n\n`;
    projects.forEach((project, index) => {
      response += `${index + 1}. "${project.title || project.name}"\n`;
    });

    return response;
  }

  private generateRealWorkspaceOverview(context: UserNotionContext): string {
    let overview = "=== Your Notion Workspace Overview ===\n\n";
    
    if (context.tasks.length > 0) {
      const statusGroups = context.tasks.reduce((acc, task) => {
        const status = task.status || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      
      overview += `📋 Tasks: ${context.tasks.length} total\n`;
      Object.entries(statusGroups).forEach(([status, count]) => {
        overview += `  • ${status}: ${count}\n`;
      });
    }
    
    if (context.projects.length > 0) {
      overview += `\n📁 Projects: ${context.projects.length} active\n`;
    }
    
    return overview;
  }

  private generateRealContextualResponse(question: string, context: UserNotionContext): string {
    const hasData = context.tasks.length > 0 || context.projects.length > 0;
    
    if (!hasData) {
      return "I can help you analyze your Notion workspace once you have some projects and tasks set up. Would you like guidance on organizing your workspace?";
    }
    
    return `Based on your workspace with ${context.tasks.length} tasks and ${context.projects.length} projects, I can help you with:\n\n• Task management and prioritization\n• Project status tracking\n• Workflow optimization\n• Data organization insights\n\nWhat specific aspect would you like to explore?`;
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
      
      // Gather user context with real data
      const context = await this.gatherUserContext(userEmail);
      
      console.log(`[AI Service] Context gathered - ${context.tasks.length} tasks, ${context.projects.length} projects`);
      
      // Use CrewAI with real Notion data
      return await this.crewAgent.analyzeAndRespond(userEmail, question, context);

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