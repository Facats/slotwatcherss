import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  avatar: text("avatar"),
});

export const slots = pgTable("slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  discordUserId: text("discord_user_id").notNull(),
  username: text("username").notNull(),
  shopType: text("shop_type").notNull(), // level1, level2, level3, level4, partnered
  channelId: text("channel_id").notNull(),
  originalChannelName: text("original_channel_name").notNull(),
  roleId: text("role_id"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pingUsage = pgTable("ping_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slotId: text("slot_id").notNull(),
  discordUserId: text("discord_user_id").notNull(),
  usedAt: timestamp("used_at").defaultNow(),
  messageId: text("message_id"),
  channelId: text("channel_id"),
});

export const shopTypes = {
  level1: {
    name: "Level 1",
    duration: 7 * 24 * 60 * 60 * 1000, // 1 week in ms
    pingCooldown: 72 * 60 * 60 * 1000, // 72 hours in ms
    pingsPerCooldown: 1,
  },
  level2: {
    name: "Level 2", 
    duration: 14 * 24 * 60 * 60 * 1000, // 2 weeks in ms
    pingCooldown: 48 * 60 * 60 * 1000, // 48 hours in ms
    pingsPerCooldown: 1,
  },
  level3: {
    name: "Level 3",
    duration: 30 * 24 * 60 * 60 * 1000, // 1 month in ms
    pingCooldown: 24 * 60 * 60 * 1000, // 24 hours in ms
    pingsPerCooldown: 1,
  },
  level4: {
    name: "Level 4",
    duration: null, // lifetime
    pingCooldown: 24 * 60 * 60 * 1000, // 24 hours in ms
    pingsPerCooldown: 1,
  },
  partnered: {
    name: "Partnered",
    duration: null, // lifetime
    pingCooldown: 24 * 60 * 60 * 1000, // 24 hours in ms
    pingsPerCooldown: 2,
  },
} as const;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertSlotSchema = createInsertSchema(slots).omit({
  id: true,
  createdAt: true,
});

export const insertPingUsageSchema = createInsertSchema(pingUsage).omit({
  id: true,
  usedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertSlot = z.infer<typeof insertSlotSchema>;
export type Slot = typeof slots.$inferSelect;
export type InsertPingUsage = z.infer<typeof insertPingUsageSchema>;
export type PingUsage = typeof pingUsage.$inferSelect;
export type ShopType = keyof typeof shopTypes;
