import { users, tasks, configurations, type User, type InsertUser, type Task, type InsertTask, type Configuration, type InsertConfiguration } from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(email: string): Promise<User | undefined>;

  // Task methods
  getTasks(userEmail?: string): Promise<Task[]>;
  getTasksByStatus(status: string, userEmail?: string): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  getTaskByNotionId(notionId: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  upsertTaskByNotionId(task: InsertTask): Promise<Task>;

  // Configuration methods
  getConfiguration(userEmail: string): Promise<Configuration | undefined>;
  createConfiguration(config: InsertConfiguration): Promise<Configuration>;
  updateConfiguration(userEmail: string, config: Partial<InsertConfiguration>): Promise<Configuration | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private tasks: Map<number, Task>;
  private configurations: Map<string, Configuration>;
  private currentUserId: number;
  private currentTaskId: number;
  private currentConfigId: number;

  constructor() {
    this.users = new Map();
    this.tasks = new Map();
    this.configurations = new Map();
    this.currentUserId = 1;
    this.currentTaskId = 1;
    this.currentConfigId = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id,
      name: insertUser.name || null,
      createdAt: now,
      lastLoginAt: null
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserLastLogin(email: string): Promise<User | undefined> {
    const user = await this.getUserByEmail(email);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      lastLoginAt: new Date()
    };
    this.users.set(user.id, updatedUser);
    return updatedUser;
  }

  // Task methods
  async getTasks(userEmail?: string): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());
    if (userEmail) {
      // In real implementation, tasks would be filtered by user
      // For now, return all tasks as this is in-memory storage
    }
    return tasks.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async getTasksByStatus(status: string, userEmail?: string): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values()).filter(task => task.status === status);
    if (userEmail) {
      // In real implementation, tasks would be filtered by user
      // For now, return all tasks as this is in-memory storage
    }
    return tasks.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async getTask(id: number): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getTaskByNotionId(notionId: string): Promise<Task | undefined> {
    return Array.from(this.tasks.values()).find(task => task.notionId === notionId);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = this.currentTaskId++;
    const now = new Date();
    const task: Task = { 
      id,
      notionId: insertTask.notionId,
      title: insertTask.title,
      description: insertTask.description || null,
      status: insertTask.status,
      assignee: insertTask.assignee || null,
      dueDate: insertTask.dueDate || null,
      completedAt: insertTask.completedAt || null,
      priority: insertTask.priority || null,
      section: insertTask.section || null,
      progress: insertTask.progress || null,
      estimatedHours: insertTask.estimatedHours || null,
      notionUrl: insertTask.notionUrl || null,
      createdAt: now,
      updatedAt: now
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: number, taskUpdate: Partial<InsertTask>): Promise<Task | undefined> {
    const existingTask = this.tasks.get(id);
    if (!existingTask) return undefined;

    const updatedTask: Task = {
      ...existingTask,
      ...taskUpdate,
      updatedAt: new Date()
    };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: number): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async upsertTaskByNotionId(insertTask: InsertTask): Promise<Task> {
    const existingTask = await this.getTaskByNotionId(insertTask.notionId);
    
    if (existingTask) {
      const updated = await this.updateTask(existingTask.id, insertTask);
      return updated!;
    } else {
      return await this.createTask(insertTask);
    }
  }

  // Configuration methods
  async getConfiguration(userEmail: string): Promise<Configuration | undefined> {
    return this.configurations.get(userEmail);
  }

  async createConfiguration(insertConfig: InsertConfiguration): Promise<Configuration> {
    const id = this.currentConfigId++;
    const now = new Date();
    const config: Configuration = {
      id,
      userEmail: insertConfig.userEmail,
      notionPageUrl: insertConfig.notionPageUrl,
      notionSecret: insertConfig.notionSecret,
      databaseName: insertConfig.databaseName || "Tasks",
      theme: insertConfig.theme || null,
      createdAt: now,
      updatedAt: now
    };
    this.configurations.set(insertConfig.userEmail, config);
    return config;
  }

  async updateConfiguration(userEmail: string, configUpdate: Partial<InsertConfiguration>): Promise<Configuration | undefined> {
    const existingConfig = this.configurations.get(userEmail);
    if (!existingConfig) return undefined;

    const updatedConfig: Configuration = {
      ...existingConfig,
      ...configUpdate,
      updatedAt: new Date()
    };
    this.configurations.set(userEmail, updatedConfig);
    return updatedConfig;
  }
}

export const storage = new MemStorage();
