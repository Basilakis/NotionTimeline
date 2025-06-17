import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export interface CRMUser {
  id: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  createdAt: string;
  updatedAt: string;
  notionId?: string;
  lastSync?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'users-db.json');

export class UserDatabase {
  private async readUsers(): Promise<CRMUser[]> {
    try {
      const data = await fs.readFile(DB_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist, return empty array
      return [];
    }
  }

  private async writeUsers(users: CRMUser[]): Promise<void> {
    await fs.writeFile(DB_FILE, JSON.stringify(users, null, 2));
  }

  async getAllUsers(): Promise<CRMUser[]> {
    return await this.readUsers();
  }

  async getUserByEmail(email: string): Promise<CRMUser | undefined> {
    const users = await this.readUsers();
    return users.find(user => user.userEmail === email);
  }

  async getUserById(id: string): Promise<CRMUser | undefined> {
    const users = await this.readUsers();
    return users.find(user => user.id === id);
  }

  async createUser(userData: Omit<CRMUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<CRMUser> {
    const users = await this.readUsers();
    const now = new Date().toISOString();
    
    const newUser: CRMUser = {
      ...userData,
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now
    };

    users.push(newUser);
    await this.writeUsers(users);
    return newUser;
  }

  async updateUser(id: string, userData: Partial<Omit<CRMUser, 'id' | 'createdAt'>>): Promise<CRMUser | null> {
    const users = await this.readUsers();
    const userIndex = users.findIndex(user => user.id === id);
    
    if (userIndex === -1) {
      return null;
    }

    users[userIndex] = {
      ...users[userIndex],
      ...userData,
      updatedAt: new Date().toISOString()
    };

    await this.writeUsers(users);
    return users[userIndex];
  }

  async upsertUser(userData: Omit<CRMUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<CRMUser> {
    const existingUser = await this.getUserByEmail(userData.userEmail);
    
    if (existingUser) {
      const updated = await this.updateUser(existingUser.id, {
        userName: userData.userName,
        userPhone: userData.userPhone,
        notionId: userData.notionId,
        lastSync: new Date().toISOString()
      });
      return updated!;
    } else {
      return await this.createUser(userData);
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    const users = await this.readUsers();
    const initialLength = users.length;
    const filteredUsers = users.filter(user => user.id !== id);
    
    if (filteredUsers.length === initialLength) {
      return false;
    }

    await this.writeUsers(filteredUsers);
    return true;
  }

  async searchUsers(query: string): Promise<CRMUser[]> {
    const users = await this.readUsers();
    const lowerQuery = query.toLowerCase();
    
    return users.filter(user => 
      user.userName.toLowerCase().includes(lowerQuery) ||
      user.userEmail.toLowerCase().includes(lowerQuery) ||
      user.userPhone.includes(query)
    );
  }

  async getUsersStats(): Promise<{
    totalUsers: number;
    newUsersThisMonth: number;
    recentlyUpdated: number;
  }> {
    const users = await this.readUsers();
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      totalUsers: users.length,
      newUsersThisMonth: users.filter(user => new Date(user.createdAt) >= thisMonth).length,
      recentlyUpdated: users.filter(user => new Date(user.updatedAt) >= lastWeek).length
    };
  }
}

export const userDB = new UserDatabase();