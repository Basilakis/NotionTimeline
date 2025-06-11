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
  status: text("status").notNull(), // "completed", "pending", "not_started"
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
  databaseName: text("database_name").notNull().default("Tasks"),
  theme: text("theme").default("default"),
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertConfiguration = z.infer<typeof insertConfigurationSchema>;
export type Configuration = typeof configurations.$inferSelect;
