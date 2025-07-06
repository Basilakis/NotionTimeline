import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface Request {
  id: string;
  userEmail: string;
  message: string;
  timestamp: string;
  status: 'open' | 'resolved';
  createdAt: string;
  updatedAt: string;
}

export interface Reply {
  id: string;
  requestId: string;
  message: string;
  timestamp: string;
  isAdmin: boolean;
  senderEmail: string;
  createdAt: string;
}

export interface UserLog {
  id: string;
  userEmail: string;
  action: string;
  details: string;
  timestamp: string;
  type: 'login' | 'email' | 'sms' | 'activity' | 'notification' | 'request';
  metadata?: Record<string, any>;
}

export class RequestDatabase {
  private requestsFile = path.join(process.cwd(), 'server', 'requests-db.json');
  private repliesFile = path.join(process.cwd(), 'server', 'replies-db.json');
  private logsFile = path.join(process.cwd(), 'server', 'user-logs-db.json');

  // Requests methods
  private async readRequests(): Promise<Request[]> {
    try {
      const data = await fs.readFile(this.requestsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private async writeRequests(requests: Request[]): Promise<void> {
    await fs.writeFile(this.requestsFile, JSON.stringify(requests, null, 2));
  }

  async getAllRequests(): Promise<Request[]> {
    return this.readRequests();
  }

  async getRequestsByUser(userEmail: string): Promise<Request[]> {
    const requests = await this.readRequests();
    return requests.filter(request => request.userEmail === userEmail);
  }

  async createRequest(requestData: { userEmail: string; message: string }): Promise<Request> {
    const requests = await this.readRequests();
    const now = new Date().toISOString();
    
    const newRequest: Request = {
      id: uuidv4(),
      userEmail: requestData.userEmail,
      message: requestData.message,
      timestamp: now,
      status: 'open',
      createdAt: now,
      updatedAt: now
    };

    requests.push(newRequest);
    await this.writeRequests(requests);
    
    // Log the request creation
    await this.logUserAction(requestData.userEmail, 'Request Created', `Created request: "${requestData.message.substring(0, 50)}..."`, 'request');
    
    return newRequest;
  }

  async updateRequestStatus(requestId: string, status: 'open' | 'resolved'): Promise<Request | null> {
    const requests = await this.readRequests();
    const requestIndex = requests.findIndex(r => r.id === requestId);
    
    if (requestIndex === -1) return null;
    
    requests[requestIndex].status = status;
    requests[requestIndex].updatedAt = new Date().toISOString();
    
    await this.writeRequests(requests);
    return requests[requestIndex];
  }

  // Replies methods
  private async readReplies(): Promise<Reply[]> {
    try {
      const data = await fs.readFile(this.repliesFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private async writeReplies(replies: Reply[]): Promise<void> {
    await fs.writeFile(this.repliesFile, JSON.stringify(replies, null, 2));
  }

  async getRepliesByRequest(requestId: string): Promise<Reply[]> {
    const replies = await this.readReplies();
    return replies.filter(reply => reply.requestId === requestId);
  }

  async createReply(replyData: { requestId: string; message: string; isAdmin: boolean; senderEmail: string }): Promise<Reply> {
    const replies = await this.readReplies();
    const now = new Date().toISOString();
    
    const newReply: Reply = {
      id: uuidv4(),
      requestId: replyData.requestId,
      message: replyData.message,
      timestamp: now,
      isAdmin: replyData.isAdmin,
      senderEmail: replyData.senderEmail,
      createdAt: now
    };

    replies.push(newReply);
    await this.writeReplies(replies);
    
    // Log the reply
    const actionType = replyData.isAdmin ? 'Admin Reply' : 'User Reply';
    await this.logUserAction(replyData.senderEmail, actionType, `Replied to request: "${replyData.message.substring(0, 50)}..."`, 'request');
    
    return newReply;
  }

  // Get requests with replies for admin view
  async getRequestsWithReplies(userEmail?: string): Promise<(Request & { replies: Reply[] })[]> {
    const requests = userEmail ? await this.getRequestsByUser(userEmail) : await this.getAllRequests();
    const allReplies = await this.readReplies();
    
    return requests.map(request => ({
      ...request,
      replies: allReplies.filter(reply => reply.requestId === request.id)
    }));
  }

  // User logs methods
  private async readLogs(): Promise<UserLog[]> {
    try {
      const data = await fs.readFile(this.logsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private async writeLogs(logs: UserLog[]): Promise<void> {
    await fs.writeFile(this.logsFile, JSON.stringify(logs, null, 2));
  }

  async getUserLogs(userEmail: string): Promise<UserLog[]> {
    const logs = await this.readLogs();
    return logs
      .filter(log => log.userEmail === userEmail)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async logUserAction(
    userEmail: string, 
    action: string, 
    details: string, 
    type: UserLog['type'], 
    metadata?: Record<string, any>
  ): Promise<UserLog> {
    const logs = await this.readLogs();
    const now = new Date().toISOString();
    
    const newLog: UserLog = {
      id: uuidv4(),
      userEmail,
      action,
      details,
      timestamp: now,
      type,
      metadata
    };

    logs.push(newLog);
    await this.writeLogs(logs);
    
    return newLog;
  }

  async logEmailSent(userEmail: string, recipient: string, subject: string): Promise<UserLog> {
    return this.logUserAction(
      userEmail,
      'Email Sent',
      `Sent email to ${recipient}: "${subject}"`,
      'email',
      { recipient, subject }
    );
  }

  async logSMSSent(userEmail: string, recipient: string, message: string): Promise<UserLog> {
    return this.logUserAction(
      userEmail,
      'SMS Sent',
      `Sent SMS to ${recipient}: "${message.substring(0, 50)}..."`,
      'sms',
      { recipient, messageLength: message.length }
    );
  }

  async logUserLogin(userEmail: string): Promise<UserLog> {
    return this.logUserAction(
      userEmail,
      'User Login',
      'User logged into the system',
      'login'
    );
  }

  async logNotificationSent(userEmail: string, type: 'email' | 'sms', message: string): Promise<UserLog> {
    return this.logUserAction(
      userEmail,
      `${type.toUpperCase()} Notification`,
      `Admin sent ${type} notification: "${message.substring(0, 50)}..."`,
      'notification',
      { notificationType: type, messageLength: message.length }
    );
  }
}

export const requestDB = new RequestDatabase();