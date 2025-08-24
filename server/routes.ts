import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSlotSchema, shopTypes, type ShopType } from "@shared/schema";
import { discordBot } from "./discord-bot";

export async function registerRoutes(app: Express): Promise<Server> {
  // Start Discord bot
  try {
    await discordBot.start();
    console.log('Discord bot started successfully');
  } catch (error) {
    console.error('Failed to start Discord bot:', error);
  }

  // Get dashboard stats
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getSlotStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  // Get all active slots
  app.get("/api/slots", async (req, res) => {
    try {
      const slots = await storage.getAllActiveSlots();
      
      // Add ping usage data for each slot
      const slotsWithPings = await Promise.all(
        slots.map(async (slot) => {
          const shopConfig = shopTypes[slot.shopType as ShopType];
          const cooldownStart = new Date(Date.now() - shopConfig.pingCooldown);
          const recentPings = await storage.getPingUsage(slot.id, cooldownStart);
          
          return {
            ...slot,
            pingsUsed: recentPings.length,
            pingsAllowed: shopConfig.pingsPerCooldown,
            shopConfig,
          };
        })
      );
      
      res.json(slotsWithPings);
    } catch (error) {
      console.error('Error getting slots:', error);
      res.status(500).json({ message: "Failed to get slots" });
    }
  });

  // Get recent activity/ping logs
  app.get("/api/activity", async (req, res) => {
    try {
      const slots = await storage.getAllActiveSlots();
      const activities = [];
      
      // Get recent ping usage for activity feed
      for (const slot of slots.slice(0, 10)) { // Limit to recent slots
        const recentPings = await storage.getPingUsage(
          slot.id, 
          new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        );
        
        for (const ping of recentPings) {
          activities.push({
            id: ping.id,
            type: 'ping',
            username: slot.username,
            shopType: slot.shopType,
            timestamp: ping.usedAt,
            message: `${slot.username} used @everyone ping`,
          });
        }
      }
      
      // Add slot creation activities (mock for recently created slots)
      for (const slot of slots.slice(0, 5)) {
        if (slot.createdAt && slot.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
          activities.push({
            id: `slot-${slot.id}`,
            type: 'slot_created',
            username: slot.username,
            shopType: slot.shopType,
            timestamp: slot.createdAt,
            message: `New slot created for ${slot.username}`,
          });
        }
      }
      
      // Sort by timestamp descending
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      res.json(activities.slice(0, 20)); // Return last 20 activities
    } catch (error) {
      console.error('Error getting activity:', error);
      res.status(500).json({ message: "Failed to get activity" });
    }
  });

  // Create a new slot
  app.post("/api/slots", async (req, res) => {
    try {
      const validatedData = insertSlotSchema.parse(req.body);
      const slot = await storage.createSlot(validatedData);
      res.status(201).json(slot);
    } catch (error) {
      console.error('Error creating slot:', error);
      res.status(400).json({ message: "Failed to create slot" });
    }
  });

  // Update a slot
  app.patch("/api/slots/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const slot = await storage.updateSlot(id, updates);
      
      if (!slot) {
        return res.status(404).json({ message: "Slot not found" });
      }
      
      res.json(slot);
    } catch (error) {
      console.error('Error updating slot:', error);
      res.status(400).json({ message: "Failed to update slot" });
    }
  });

  // Delete a slot
  app.delete("/api/slots/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteSlot(id);
      
      if (!success) {
        return res.status(404).json({ message: "Slot not found" });
      }
      
      res.json({ message: "Slot deleted successfully" });
    } catch (error) {
      console.error('Error deleting slot:', error);
      res.status(500).json({ message: "Failed to delete slot" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
