import { users, tasks, configurations, type User, type InsertUser, type Task, type InsertTask, type Configuration, type InsertConfiguration } from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Task methods
  getTasks(): Promise<Task[]>;
  getTasksByStatus(status: string): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  getTaskByNotionId(notionId: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  upsertTaskByNotionId(task: InsertTask): Promise<Task>;

  // Configuration methods
  getConfiguration(customerId: string): Promise<Configuration | undefined>;
  createConfiguration(config: InsertConfiguration): Promise<Configuration>;
  updateConfiguration(customerId: string, config: Partial<InsertConfiguration>): Promise<Configuration | undefined>;
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

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Task methods
  async getTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values()).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async getTasksByStatus(status: string): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.status === status)
      .sort((a, b) => 
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
      ...insertTask, 
      id, 
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
  async getConfiguration(customerId: string): Promise<Configuration | undefined> {
    return this.configurations.get(customerId);
  }

  async createConfiguration(insertConfig: InsertConfiguration): Promise<Configuration> {
    const id = this.currentConfigId++;
    const now = new Date();
    const config: Configuration = {
      ...insertConfig,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.configurations.set(insertConfig.customerId, config);
    return config;
  }

  async updateConfiguration(customerId: string, configUpdate: Partial<InsertConfiguration>): Promise<Configuration | undefined> {
    const existingConfig = this.configurations.get(customerId);
    if (!existingConfig) return undefined;

    const updatedConfig: Configuration = {
      ...existingConfig,
      ...configUpdate,
      updatedAt: new Date()
    };
    this.configurations.set(customerId, updatedConfig);
    return updatedConfig;
  }
}

export const storage = new MemStorage();
