import { Client, GatewayIntentBits, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import { storage } from './storage';
import { shopTypes, type ShopType } from '@shared/schema';

class DiscordBot {
  private client: Client;
  private checkExpirationInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.once('ready', () => {
      console.log(`Discord bot logged in as ${this.client.user?.tag}`);
      this.registerCommands();
      this.startExpirationChecker();
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      try {
        await this.handleSlashCommand(interaction);
      } catch (error) {
        console.error('Error handling slash command:', error);
        const reply = { content: 'An error occurred while processing the command.', ephemeral: true };
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
    });

    // Monitor @everyone and @here usage
    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      // Check for @everyone or @here mentions
      if (message.content.includes('@everyone') || message.content.includes('@here')) {
        await this.handleEveryonePing(message);
      }
    });
  }

  private async registerCommands() {
    const commands = [
      new SlashCommandBuilder()
        .setName('slotadd')
        .setDescription('Add a new slot for a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to give the slot to')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('shoptype')
            .setDescription('The type of shop slot')
            .setRequired(true)
            .addChoices(
              { name: 'Level 1 - 1 Week, 1 Ping/72h', value: 'level1' },
              { name: 'Level 2 - 2 Week, 1 Ping/48h', value: 'level2' },
              { name: 'Level 3 - 1 Month, 1 Ping/24h', value: 'level3' },
              { name: 'Level 4 - Lifetime, 1 Ping/24h', value: 'level4' },
              { name: 'Partnered - Lifetime, 2 Ping/24h', value: 'partnered' }
            ))
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to give the user access to')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

      new SlashCommandBuilder()
        .setName('slotremove')
        .setDescription('Remove a slot from a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to remove the slot from')
            .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

      new SlashCommandBuilder()
        .setName('slotinfo')
        .setDescription('Get information about a user\'s slot')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to check')
            .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    ];

    if (!this.client.application) return;

    try {
      await this.client.application.commands.set(commands);
      console.log('Successfully registered slash commands');
    } catch (error) {
      console.error('Error registering slash commands:', error);
    }
  }

  private async handleSlashCommand(interaction: ChatInputCommandInteraction) {
    const { commandName } = interaction;

    switch (commandName) {
      case 'slotadd':
        await this.handleSlotAdd(interaction);
        break;
      case 'slotremove':
        await this.handleSlotRemove(interaction);
        break;
      case 'slotinfo':
        await this.handleSlotInfo(interaction);
        break;
    }
  }

  private async handleSlotAdd(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user', true);
    const shopType = interaction.options.getString('shoptype', true) as ShopType;
    const channel = interaction.options.getChannel('channel', true);

    if (!interaction.guild) {
      await interaction.editReply('This command can only be used in a server.');
      return;
    }

    try {
      // Check if user already has an active slot
      const existingSlot = await storage.getSlotByDiscordUserId(user.id);
      if (existingSlot) {
        await interaction.editReply(`${user.username} already has an active slot.`);
        return;
      }

      // Get or create user in storage
      let storageUser = await storage.getUserByDiscordId(user.id);
      if (!storageUser) {
        storageUser = await storage.createUser({
          discordId: user.id,
          username: user.username,
          avatar: user.displayAvatarURL(),
        });
      }

      // Use existing role from environment variable
      const slotRoleId = process.env.SLOT_ROLE_ID;
      if (!slotRoleId) {
        await interaction.editReply('❌ Slot role not configured. Please contact an administrator.');
        return;
      }
      
      const slotRole = await interaction.guild.roles.fetch(slotRoleId);
      if (!slotRole) {
        await interaction.editReply('❌ Configured slot role not found. Please check the role ID.');
        return;
      }

      // Add the shared slot role to user
      const member = await interaction.guild.members.fetch(user.id);
      await member.roles.add(slotRole);

      // Give channel permissions directly to the user (not the shared role)
      // This ensures only this specific user can access their channel
      await channel.permissionOverwrites.create(user, {
        SendMessages: true,
        ViewChannel: true,
      });

      // Rename channel with emoji and line
      const originalChannelName = channel.name;
      const newChannelName = `🛒│${user.username.toLowerCase()}-slot`;
      await channel.setName(newChannelName);

      // Calculate expiration
      const shopConfig = shopTypes[shopType];
      const expiresAt = shopConfig.duration ? new Date(Date.now() + shopConfig.duration) : null;

      // Create slot in storage
      await storage.createSlot({
        userId: storageUser.id,
        discordUserId: user.id,
        username: user.username,
        shopType,
        channelId: channel.id,
        originalChannelName,
        roleId: slotRole.id,
        expiresAt,
        isActive: true,
      });

      const expirationText = expiresAt 
        ? `Expires: <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`
        : 'Lifetime slot';

      await interaction.editReply(
        `✅ Successfully created ${shopConfig.name} slot for ${user.username}!\n` +
        `📅 ${expirationText}\n` +
        `📊 Ping limit: ${shopConfig.pingsPerCooldown} per ${shopConfig.pingCooldown / (60 * 60 * 1000)} hours\n` +
        `📢 Channel renamed to: ${newChannelName}`
      );

    } catch (error) {
      console.error('Error creating slot:', error);
      await interaction.editReply('Failed to create slot. Please check bot permissions.');
    }
  }

  private async handleSlotRemove(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user', true);

    if (!interaction.guild) {
      await interaction.editReply('This command can only be used in a server.');
      return;
    }

    try {
      const slot = await storage.getSlotByDiscordUserId(user.id);
      if (!slot) {
        await interaction.editReply(`${user.username} doesn't have an active slot.`);
        return;
      }

      await this.revokeSlotPermissions(interaction.guild.id, slot);
      await storage.updateSlot(slot.id, { isActive: false });

      await interaction.editReply(`✅ Successfully removed slot for ${user.username}.`);
    } catch (error) {
      console.error('Error removing slot:', error);
      await interaction.editReply('Failed to remove slot.');
    }
  }

  private async handleSlotInfo(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    
    try {
      const slot = await storage.getSlotByDiscordUserId(targetUser.id);
      if (!slot) {
        await interaction.reply({
          content: `${targetUser.username} doesn't have an active slot.`,
          ephemeral: true
        });
        return;
      }

      const shopConfig = shopTypes[slot.shopType as ShopType];
      const now = new Date();
      const cooldownStart = new Date(now.getTime() - shopConfig.pingCooldown);
      const recentPings = await storage.getPingUsage(slot.id, cooldownStart);

      const expirationText = slot.expiresAt 
        ? `<t:${Math.floor(slot.expiresAt.getTime() / 1000)}:R>`
        : 'Never (Lifetime)';

      await interaction.reply({
        content: 
          `📊 **Slot Information for ${targetUser.username}**\n` +
          `🏷️ Type: ${shopConfig.name}\n` +
          `📅 Expires: ${expirationText}\n` +
          `📢 Pings used: ${recentPings.length}/${shopConfig.pingsPerCooldown}\n` +
          `⏰ Next ping available: ${recentPings.length >= shopConfig.pingsPerCooldown ? 'Rate limited' : 'Available now'}`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Error getting slot info:', error);
      await interaction.reply({
        content: 'Failed to get slot information.',
        ephemeral: true
      });
    }
  }

  private async handleEveryonePing(message: any) {
    try {
      const slot = await storage.getSlotByDiscordUserId(message.author.id);
      if (!slot || !slot.isActive) return;

      const shopConfig = shopTypes[slot.shopType as ShopType];
      const now = new Date();
      const cooldownStart = new Date(now.getTime() - shopConfig.pingCooldown);
      const recentPings = await storage.getPingUsage(slot.id, cooldownStart);

      if (recentPings.length >= shopConfig.pingsPerCooldown) {
        await message.delete();
        
        // REVOKE ALL PERMISSIONS - User has abused ping privileges
        await this.revokeSlotPermissions(message.guild?.id || '', slot);
        await storage.updateSlot(slot.id, { isActive: false });
        
        await message.author.send(
          `🚫 **SLOT REVOKED** - You exceeded your ping limit!\n` +
          `You used @everyone/@here too many times (${shopConfig.pingsPerCooldown} limit per ${shopConfig.pingCooldown / (60 * 60 * 1000)} hours).\n` +
          `Your shop role and channel access have been permanently removed.`
        ).catch(() => {
          // User has DMs disabled, send in channel
          message.channel.send(
            `🚫 **${message.author} - SLOT REVOKED** for exceeding ping limits! Shop access permanently removed.`
          );
        });
        
        console.log(`Slot revoked for user ${slot.username} due to ping abuse`);
        return;
      }

      // Record ping usage
      await storage.createPingUsage({
        slotId: slot.id,
        discordUserId: message.author.id,
        messageId: message.id,
        channelId: message.channel.id,
      });

    } catch (error) {
      console.error('Error handling @everyone ping:', error);
    }
  }

  private async revokeSlotPermissions(guildId: string, slot: any) {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      
      // Remove shared slot role from user (don't delete the role since it's shared)
      if (slot.roleId) {
        try {
          const role = await guild.roles.fetch(slot.roleId);
          if (role) {
            const member = await guild.members.fetch(slot.discordUserId);
            await member.roles.remove(role);
            // Note: Don't delete the shared role as other users may still have slots
          }
        } catch (error) {
          console.error('Error removing role from user:', error);
        }
      }

      // Remove user-specific channel permissions
      try {
        const channel = await guild.channels.fetch(slot.channelId);
        if (channel && channel.type === ChannelType.GuildText) {
          // Remove the user's permission overrides from this channel
          await channel.permissionOverwrites.delete(slot.discordUserId);
          // Restore original channel name
          await channel.setName(slot.originalChannelName);
        }
      } catch (error) {
        console.error('Error removing channel permissions or restoring channel name:', error);
      }

    } catch (error) {
      console.error('Error revoking slot permissions:', error);
    }
  }

  private startExpirationChecker() {
    // Check for expired slots every 5 minutes
    this.checkExpirationInterval = setInterval(async () => {
      try {
        const expiredSlots = await storage.getExpiredSlots();
        
        for (const slot of expiredSlots) {
          await this.revokeSlotPermissions(process.env.GUILD_ID || '', slot);
          await storage.updateSlot(slot.id, { isActive: false });
          console.log(`Expired slot for user ${slot.username}`);
        }
      } catch (error) {
        console.error('Error checking slot expiration:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  async start() {
    const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
    if (!token) {
      throw new Error('DISCORD_BOT_TOKEN environment variable is required');
    }

    await this.client.login(token);
  }

  async stop() {
    if (this.checkExpirationInterval) {
      clearInterval(this.checkExpirationInterval);
    }
    await this.client.destroy();
  }
}

export const discordBot = new DiscordBot();
