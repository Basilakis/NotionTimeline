import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  notionId: text("notion_id").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull(), // Full status display
  mainStatus: text("main_status"), // Main status category (To-do, In Progress, Complete)
  subStatus: text("sub_status"), // Sub-status within main category
  statusColor: text("status_color"), // Notion color for status
  statusGroup: text("status_group"), // Status group ID
  assignee: text("assignee"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  priority: text("priority"), // "high", "medium", "low"
  section: text("section"),
  progress: integer("progress").default(0),
  estimatedHours: integer("estimated_hours"),
  notionUrl: text("notion_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const configurations = pgTable("configurations", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull().unique(),
  notionPageUrl: text("notion_page_url").notNull(),
  notionSecret: text("notion_secret").notNull(),
  workspaceName: text("workspace_name").notNull().default("My Workspace"),
  theme: text("theme").default("default"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const notionViews = pgTable("notion_views", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  viewType: text("view_type").notNull(), // "tasks", "materials", "notes", "payments"
  pageId: text("page_id").notNull(),
  databaseId: text("database_id"),
  title: text("title").notNull(),
  icon: text("icon"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Persistent API settings table
export const apiSettings = pgTable("api_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value"),
  isEncrypted: boolean("is_encrypted").default(false),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// System settings for categories like Twilio, AWS SES, etc.
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // "twilio", "aws_ses", "general"
  settingKey: text("setting_key").notNull(),
  settingValue: text("setting_value"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  name: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConfigurationSchema = createInsertSchema(configurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotionViewSchema = createInsertSchema(notionViews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApiSettingSchema = createInsertSchema(apiSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertConfiguration = z.infer<typeof insertConfigurationSchema>;
export type Configuration = typeof configurations.$inferSelect;

export type InsertNotionView = z.infer<typeof insertNotionViewSchema>;
export type NotionView = typeof notionViews.$inferSelect;

export type InsertApiSetting = z.infer<typeof insertApiSettingSchema>;
export type ApiSetting = typeof apiSettings.$inferSelect;

export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
