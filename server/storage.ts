import { type User, type InsertUser, type Slot, type InsertSlot, type PingUsage, type InsertPingUsage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByDiscordId(discordId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Slot methods
  getSlot(id: string): Promise<Slot | undefined>;
  getSlotByUserId(userId: string): Promise<Slot | undefined>;
  getSlotByDiscordUserId(discordUserId: string): Promise<Slot | undefined>;
  getAllActiveSlots(): Promise<Slot[]>;
  getExpiredSlots(): Promise<Slot[]>;
  createSlot(slot: InsertSlot): Promise<Slot>;
  updateSlot(id: string, updates: Partial<Slot>): Promise<Slot | undefined>;
  deleteSlot(id: string): Promise<boolean>;
  
  // Ping usage methods
  getPingUsage(slotId: string, since: Date): Promise<PingUsage[]>;
  createPingUsage(usage: InsertPingUsage): Promise<PingUsage>;
  
  // Analytics methods
  getSlotStats(): Promise<{
    totalSlots: number;
    activeSlots: number;
    expiringSoon: number;
    todayPings: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private slots: Map<string, Slot>;
  private pingUsage: Map<string, PingUsage>;

  constructor() {
    this.users = new Map();
    this.slots = new Map();
    this.pingUsage = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByDiscordId(discordId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.discordId === discordId);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Slot methods
  async getSlot(id: string): Promise<Slot | undefined> {
    return this.slots.get(id);
  }

  async getSlotByUserId(userId: string): Promise<Slot | undefined> {
    return Array.from(this.slots.values()).find(slot => slot.userId === userId && slot.isActive);
  }

  async getSlotByDiscordUserId(discordUserId: string): Promise<Slot | undefined> {
    return Array.from(this.slots.values()).find(slot => slot.discordUserId === discordUserId && slot.isActive);
  }

  async getAllActiveSlots(): Promise<Slot[]> {
    return Array.from(this.slots.values()).filter(slot => slot.isActive);
  }

  async getExpiredSlots(): Promise<Slot[]> {
    const now = new Date();
    return Array.from(this.slots.values()).filter(slot => 
      slot.isActive && slot.expiresAt && slot.expiresAt < now
    );
  }

  async createSlot(insertSlot: InsertSlot): Promise<Slot> {
    const id = randomUUID();
    const slot: Slot = { 
      ...insertSlot, 
      id,
      createdAt: new Date()
    };
    this.slots.set(id, slot);
    return slot;
  }

  async updateSlot(id: string, updates: Partial<Slot>): Promise<Slot | undefined> {
    const slot = this.slots.get(id);
    if (!slot) return undefined;
    
    const updatedSlot = { ...slot, ...updates };
    this.slots.set(id, updatedSlot);
    return updatedSlot;
  }

  async deleteSlot(id: string): Promise<boolean> {
    return this.slots.delete(id);
  }

  // Ping usage methods
  async getPingUsage(slotId: string, since: Date): Promise<PingUsage[]> {
    return Array.from(this.pingUsage.values()).filter(usage => 
      usage.slotId === slotId && usage.usedAt && usage.usedAt >= since
    );
  }

  async createPingUsage(insertUsage: InsertPingUsage): Promise<PingUsage> {
    const id = randomUUID();
    const usage: PingUsage = { 
      ...insertUsage, 
      id,
      usedAt: new Date()
    };
    this.pingUsage.set(id, usage);
    return usage;
  }

  // Analytics methods
  async getSlotStats(): Promise<{
    totalSlots: number;
    activeSlots: number;
    expiringSoon: number;
    todayPings: number;
  }> {
    const activeSlots = await this.getAllActiveSlots();
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const expiringSoon = activeSlots.filter(slot => 
      slot.expiresAt && slot.expiresAt <= tomorrow
    ).length;
    
    const todayPings = Array.from(this.pingUsage.values()).filter(usage =>
      usage.usedAt && usage.usedAt >= today
    ).length;

    return {
      totalSlots: this.slots.size,
      activeSlots: activeSlots.length,
      expiringSoon,
      todayPings,
    };
  }
}

export const storage = new MemStorage();
