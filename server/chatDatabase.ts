import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  chatId: string;
  userEmail: string;
  message: string;
  response?: string;
  type: 'ai' | 'request';
  timestamp: string;
  isFromUser: boolean;
  createdAt: string;
}

export interface Chat {
  id: string;
  userEmail: string;
  title: string;
  type: 'ai' | 'request';
  lastMessage: string;
  lastActivity: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export class ChatDatabase {
  private chatsFile = path.join(process.cwd(), 'server', 'chats-db.json');
  private messagesFile = path.join(process.cwd(), 'server', 'chat-messages-db.json');

  // Chat methods
  private async readChats(): Promise<Chat[]> {
    try {
      const data = await fs.readFile(this.chatsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private async writeChats(chats: Chat[]): Promise<void> {
    await fs.writeFile(this.chatsFile, JSON.stringify(chats, null, 2));
  }

  async getUserChats(userEmail: string): Promise<Chat[]> {
    const chats = await this.readChats();
    return chats
      .filter(chat => chat.userEmail === userEmail)
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
  }

  async createChat(userEmail: string, type: 'ai' | 'request', firstMessage: string): Promise<Chat> {
    const chats = await this.readChats();
    const now = new Date().toISOString();
    
    // Generate a title from the first message (first 50 characters)
    const title = firstMessage.length > 50 
      ? firstMessage.substring(0, 47) + '...' 
      : firstMessage;
    
    const newChat: Chat = {
      id: uuidv4(),
      userEmail,
      title,
      type,
      lastMessage: firstMessage,
      lastActivity: now,
      messageCount: 1,
      createdAt: now,
      updatedAt: now
    };

    chats.push(newChat);
    await this.writeChats(chats);
    
    return newChat;
  }

  async updateChatActivity(chatId: string, lastMessage: string): Promise<Chat | null> {
    const chats = await this.readChats();
    const chatIndex = chats.findIndex(chat => chat.id === chatId);
    
    if (chatIndex === -1) return null;
    
    const now = new Date().toISOString();
    chats[chatIndex].lastMessage = lastMessage;
    chats[chatIndex].lastActivity = now;
    chats[chatIndex].updatedAt = now;
    chats[chatIndex].messageCount += 1;
    
    await this.writeChats(chats);
    return chats[chatIndex];
  }

  async getChat(chatId: string): Promise<Chat | null> {
    const chats = await this.readChats();
    return chats.find(chat => chat.id === chatId) || null;
  }

  async deleteChat(chatId: string): Promise<boolean> {
    const chats = await this.readChats();
    const initialLength = chats.length;
    const filteredChats = chats.filter(chat => chat.id !== chatId);
    
    if (filteredChats.length === initialLength) return false;
    
    await this.writeChats(filteredChats);
    
    // Also delete all messages for this chat
    await this.deleteChatMessages(chatId);
    
    return true;
  }

  // Message methods
  private async readMessages(): Promise<ChatMessage[]> {
    try {
      const data = await fs.readFile(this.messagesFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private async writeMessages(messages: ChatMessage[]): Promise<void> {
    await fs.writeFile(this.messagesFile, JSON.stringify(messages, null, 2));
  }

  async getChatMessages(chatId: string): Promise<ChatMessage[]> {
    const messages = await this.readMessages();
    return messages
      .filter(message => message.chatId === chatId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async createMessage(
    chatId: string, 
    userEmail: string, 
    message: string, 
    type: 'ai' | 'request',
    isFromUser: boolean = true,
    response?: string
  ): Promise<ChatMessage> {
    const messages = await this.readMessages();
    const now = new Date().toISOString();
    
    const newMessage: ChatMessage = {
      id: uuidv4(),
      chatId,
      userEmail,
      message,
      response,
      type,
      timestamp: now,
      isFromUser,
      createdAt: now
    };

    messages.push(newMessage);
    await this.writeMessages(messages);
    
    // Update chat activity
    await this.updateChatActivity(chatId, isFromUser ? message : (response || message));
    
    return newMessage;
  }

  async updateMessageResponse(messageId: string, response: string): Promise<ChatMessage | null> {
    const messages = await this.readMessages();
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex === -1) return null;
    
    messages[messageIndex].response = response;
    await this.writeMessages(messages);
    
    return messages[messageIndex];
  }

  private async deleteChatMessages(chatId: string): Promise<void> {
    const messages = await this.readMessages();
    const filteredMessages = messages.filter(message => message.chatId !== chatId);
    await this.writeMessages(filteredMessages);
  }

  // Utility methods
  async getAllUserMessages(userEmail: string): Promise<ChatMessage[]> {
    const messages = await this.readMessages();
    return messages
      .filter(message => message.userEmail === userEmail)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async searchUserChats(userEmail: string, query: string): Promise<Chat[]> {
    const chats = await this.getUserChats(userEmail);
    return chats.filter(chat => 
      chat.title.toLowerCase().includes(query.toLowerCase()) ||
      chat.lastMessage.toLowerCase().includes(query.toLowerCase())
    );
  }
}

export const chatDB = new ChatDatabase();