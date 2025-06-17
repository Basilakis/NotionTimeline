import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export interface Reminder {
  id: string;
  userId: string;
  message: string;
  reminderDate: string;
  reminderType: 'email' | 'sms';
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
  updatedAt: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'reminders-db.json');

export class ReminderDatabase {
  private async readReminders(): Promise<Reminder[]> {
    try {
      const data = await fs.readFile(DB_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private async writeReminders(reminders: Reminder[]): Promise<void> {
    await fs.writeFile(DB_FILE, JSON.stringify(reminders, null, 2));
  }

  async getAllReminders(): Promise<Reminder[]> {
    return await this.readReminders();
  }

  async getRemindersByUserId(userId: string): Promise<Reminder[]> {
    const reminders = await this.readReminders();
    return reminders.filter(reminder => reminder.userId === userId);
  }

  async createReminder(reminderData: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Reminder> {
    const reminders = await this.readReminders();
    const now = new Date().toISOString();
    
    const newReminder: Reminder = {
      ...reminderData,
      id: `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    reminders.push(newReminder);
    await this.writeReminders(reminders);
    return newReminder;
  }

  async updateReminder(id: string, reminderData: Partial<Omit<Reminder, 'id' | 'createdAt'>>): Promise<Reminder | null> {
    const reminders = await this.readReminders();
    const reminderIndex = reminders.findIndex(reminder => reminder.id === id);
    
    if (reminderIndex === -1) {
      return null;
    }

    reminders[reminderIndex] = {
      ...reminders[reminderIndex],
      ...reminderData,
      updatedAt: new Date().toISOString()
    };

    await this.writeReminders(reminders);
    return reminders[reminderIndex];
  }

  async deleteReminder(id: string): Promise<boolean> {
    const reminders = await this.readReminders();
    const initialLength = reminders.length;
    const filteredReminders = reminders.filter(reminder => reminder.id !== id);
    
    if (filteredReminders.length === initialLength) {
      return false;
    }

    await this.writeReminders(filteredReminders);
    return true;
  }

  async getPendingReminders(): Promise<Reminder[]> {
    const reminders = await this.readReminders();
    const now = new Date();
    
    return reminders.filter(reminder => 
      reminder.status === 'pending' && 
      new Date(reminder.reminderDate) <= now
    );
  }
}

export const reminderDB = new ReminderDatabase();