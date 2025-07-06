import { apiRequest } from "./queryClient";
import type { Task, Configuration } from "@shared/schema";

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  notStarted: number;
}

function getUserEmail(): string {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.email || '';
}

export const api = {
  async sendStatusChangeNotification(
    taskId: string,
    statusChange: {
      oldStatus: string;
      newStatus: string;
      userEmail: string;
      taskTitle: string;
      projectName?: string;
      assigneeEmail?: string;
      taskUrl?: string;
      dueDate?: string;
      priority?: string;
    }
  ): Promise<{ message: string; notificationSent: boolean }> {
    const response = await apiRequest('POST', `/api/tasks/${taskId}/status-change`, statusChange);
    
    if (!response.ok) {
      throw new Error(`Failed to send status change notification: ${response.statusText}`);
    }
    
    return response.json();
  },
  // Task operations
  async getTasks(status?: string): Promise<Task[]> {
    const url = status ? `/api/tasks?status=${status}` : '/api/tasks';
    const userEmail = getUserEmail();
    const headers: Record<string, string> = {};
    if (userEmail) {
      headers['x-user-email'] = userEmail;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch tasks');
    }
    
    return response.json();
  },

  async getTask(id: number): Promise<Task> {
    const response = await apiRequest('GET', `/api/tasks/${id}`);
    return response.json();
  },

  async syncTasks(): Promise<{ message: string; tasks: Task[] }> {
    const userEmail = getUserEmail();
    const headers: Record<string, string> = {};
    if (userEmail) {
      headers['x-user-email'] = userEmail;
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
    const userEmail = getUserEmail();
    const headers: Record<string, string> = {};
    if (userEmail) {
      headers['x-user-email'] = userEmail;
    }
    
    const response = await fetch('/api/tasks/stats', {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch task statistics');
    }
    
    return response.json();
  },

  // Configuration operations
  async getConfiguration(userEmail: string): Promise<Configuration> {
    const response = await apiRequest('GET', `/api/config/${encodeURIComponent(userEmail)}`);
    return response.json();
  },

  async createConfiguration(config: Omit<Configuration, 'id' | 'createdAt' | 'updatedAt'>): Promise<Configuration> {
    const response = await apiRequest('POST', '/api/config', config);
    return response.json();
  },

  async updateConfiguration(
    userEmail: string, 
    config: Partial<Omit<Configuration, 'id' | 'userEmail' | 'createdAt' | 'updatedAt'>>
  ): Promise<Configuration> {
    const response = await apiRequest('PUT', `/api/config/${encodeURIComponent(userEmail)}`, config);
    return response.json();
  },
};
