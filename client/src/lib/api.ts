import { apiRequest } from "./queryClient";
import type { Task, Configuration } from "@shared/schema";

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  notStarted: number;
}

export const api = {
  // Task operations
  async getTasks(status?: string): Promise<Task[]> {
    const url = status ? `/api/tasks?status=${status}` : '/api/tasks';
    const response = await apiRequest('GET', url);
    return response.json();
  },

  async getTask(id: number): Promise<Task> {
    const response = await apiRequest('GET', `/api/tasks/${id}`);
    return response.json();
  },

  async syncTasks(customerId?: string): Promise<{ message: string; tasks: Task[] }> {
    const headers: Record<string, string> = {};
    if (customerId) {
      headers['x-customer-id'] = customerId;
    }
    
    const response = await fetch('/api/tasks/sync', {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to sync tasks');
    }
    
    return response.json();
  },

  async getTaskStats(): Promise<TaskStats> {
    const response = await apiRequest('GET', '/api/tasks/stats');
    return response.json();
  },

  // Configuration operations
  async getConfiguration(customerId: string): Promise<Configuration> {
    const response = await apiRequest('GET', `/api/config/${customerId}`);
    return response.json();
  },

  async createConfiguration(config: Omit<Configuration, 'id' | 'createdAt' | 'updatedAt'>): Promise<Configuration> {
    const response = await apiRequest('POST', '/api/config', config);
    return response.json();
  },

  async updateConfiguration(
    customerId: string, 
    config: Partial<Omit<Configuration, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>>
  ): Promise<Configuration> {
    const response = await apiRequest('PUT', `/api/config/${customerId}`, config);
    return response.json();
  },
};
