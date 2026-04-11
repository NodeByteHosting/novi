import { PrismaClient, ModerationLog, Warning, Ticket, GuildConfig, AppConfig, ServiceConfig } from '@prisma/client';
import { EmbedBuilder, TextChannel, User, Collection } from 'discord.js';
import { logger } from './logger';

const prisma = new PrismaClient();

/**
 * In-memory cache for GuildConfig with TTL
 * Reduces repeated database queries for frequently accessed configuration
 */
const configCache = new Collection<string, { config: GuildConfig | null; expiresAt: number }>();
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Helper to invalidate config cache for a guild
 */
function invalidateConfigCache(guildId: string): void {
  configCache.delete(guildId);
}

/**
 * Helper to get cached config or fetch from database
 */
async function getCachedGuildConfig(guildId: string): Promise<GuildConfig | null> {
  const cached = configCache.get(guildId);
  
  if (cached && Date.now() < cached.expiresAt) {
    logger.debug(`Config cache hit for guild ${guildId}`);
    return cached.config;
  }

  const result = await prisma.guildConfig.findUnique({
    where: { guildId }
  });

  configCache.set(guildId, {
    config: result,
    expiresAt: Date.now() + CONFIG_CACHE_TTL
  });

  return result;
}

export default {
  prisma,
  async logModeration(action: string, guildId: string, moderatorId: string, targetId: string, reason?: string): Promise<ModerationLog | null> {
    try {
      const result = await prisma.moderationLog.create({
        data: {
          action,
          guildId,
          moderatorId,
          targetId,
          reason: reason || null
        }
      });
      logger.dbOperation(`logModeration(${action})`, true);
      return result;
    } catch (err) {
      logger.dbOperation(`logModeration(${action})`, false, err);
      logger.error('Failed to write mod log', {
        context: 'Database',
        error: err,
        action,
        guildId
      });
      return null;
    }
  },
  async addWarning(guildId: string, userId: string, moderatorId: string, reason: string): Promise<Warning | null> {
    try {
      const result = await prisma.warning.create({
        data: {
          guildId,
          userId,
          moderatorId,
          reason
        }
      });
      logger.dbOperation('addWarning', true);
      return result;
    } catch (err) {
      logger.dbOperation('addWarning', false, err);
      logger.error('Failed to add warning', {
        context: 'Database',
        error: err,
        userId,
        guildId
      });
      return null;
    }
  },
  async getWarnings(guildId: string, userId: string): Promise<Warning[]> {
    try {
      const result = await prisma.warning.findMany({
        where: {
          guildId,
          userId
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      logger.debug('Retrieved warnings', {
        context: 'Database',
        userId,
        guildId,
        count: result.length
      });
      return result;
    } catch (err) {
      logger.dbOperation('getWarnings', false, err);
      logger.error('Failed to fetch warnings', {
        context: 'Database',
        error: err,
        userId,
        guildId
      });
      return [];
    }
  },
  async getModLogs(guildId: string, userId: string): Promise<ModerationLog[]> {
    try {
      const result = await prisma.moderationLog.findMany({
        where: {
          guildId,
          targetId: userId
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      logger.debug('Retrieved mod logs', {
        context: 'Database',
        userId,
        guildId,
        count: result.length
      });
      return result;
    } catch (err) {
      logger.dbOperation('getModLogs', false, err);
      logger.error('Failed to fetch moderation logs', {
        context: 'Database',
        error: err,
        userId,
        guildId
      });
      return [];
    }
  },
  async sendModLog(channel: TextChannel | null, action: string, moderator: User, target: User, reason: string): Promise<void> {
    if (!channel || !('send' in channel)) {
      logger.warn('Mod log channel not available', {
        context: 'Database',
        action,
        targetId: target.id
      });
      return;
    }

    const colors: Record<string, number> = {
      ban: 0xFF0000,
      kick: 0xFF6B00,
      warn: 0xFFFF00,
      unban: 0x00FF00
    };

    const embed = new EmbedBuilder()
      .setColor(0x3256d9)
      .setTitle(`${action.charAt(0).toUpperCase() + action.slice(1)} | ${target.tag}`)
      .addFields(
        { name: 'User', value: `${target.toString()} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${moderator.toString()}`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: `ID: ${target.id} | \u00a9Copyright 2024 - 2026 NodeByte LTD` });

    try {
      await channel.send({ embeds: [embed] });
      logger.debug('Sent mod log', {
        context: 'Database',
        action
      });
    } catch (err) {
      logger.error('Failed to send mod log to channel', {
        context: 'Database',
        error: err,
        action,
        channelId: channel.id
      });
    }
  },
  async sendDM(user: User, action: string, guildName: string, reason: string, moderator?: User): Promise<boolean> {
    const embed = new EmbedBuilder()
      .setColor(0x3256d9)
      .setTitle(`You have been ${action}`)
      .setDescription(`**Server:** ${guildName}\n**Reason:** ${reason}`)
      .setTimestamp();

    if (moderator) {
      embed.addFields({ name: 'Moderator', value: moderator.tag, inline: true });
    }

    try {
      await user.send({ embeds: [embed] });
      logger.debug('DM sent successfully', {
        context: 'Database',
        userId: user.id,
        action
      });
      return true;
    } catch (err) {
      logger.warn(`Failed to DM user ${user.tag}`, {
        context: 'Database',
        error: err,
        userId: user.id,
        action
      });
      return false;
    }
  },
  async createTicket(guildId: string, threadId: string, userId: string, category: string, createMsg?: string | null): Promise<Ticket | null> {
    try {
      const result = await prisma.ticket.create({
        data: {
          guildId,
          threadId,
          userId,
          category,
          createMsg: createMsg || null,
          status: 'open'
        }
      });
      logger.debug('Ticket created', {
        context: 'Database',
        userId,
        guildId,
        category
      });
      return result;
    } catch (err) {
      logger.error('Failed to create ticket', {
        context: 'Database',
        error: err,
        userId,
        guildId,
        category
      });
      return null;
    }
  },
  async getTicket(threadId: string): Promise<Ticket | null> {
    try {
      const result = await prisma.ticket.findUnique({
        where: { threadId }
      });
      if (result) {
        logger.debug('Ticket retrieved', {
          context: 'Database',
          threadId,
          status: result.status
        });
      }
      return result;
    } catch (err) {
      logger.error('Failed to get ticket', {
        context: 'Database',
        error: err,
        threadId
      });
      return null;
    }
  },
  async claimTicket(threadId: string, claimedBy: string): Promise<Ticket | null> {
    try {
      const result = await prisma.ticket.update({
        where: { threadId },
        data: {
          claimedBy,
          status: 'claimed'
        }
      });
      logger.debug('Ticket claimed', {
        context: 'Database',
        threadId,
        claimedBy
      });
      return result;
    } catch (err) {
      logger.error('Failed to claim ticket', {
        context: 'Database',
        error: err,
        threadId,
        claimedBy
      });
      return null;
    }
  },
  async unclaimTicket(threadId: string): Promise<Ticket | null> {
    try {
      const result = await prisma.ticket.update({
        where: { threadId },
        data: {
          claimedBy: null,
          status: 'open'
        }
      });
      logger.debug('Ticket unclaimed', {
        context: 'Database',
        threadId
      });
      return result;
    } catch (err) {
      logger.error('Failed to unclaim ticket', {
        context: 'Database',
        error: err,
        threadId
      });
      return null;
    }
  },
  async closeTicket(threadId: string, closedBy: string, closeMsg: string): Promise<Ticket | null> {
    try {
      const result = await prisma.ticket.update({
        where: { threadId },
        data: {
          status: 'closed',
          closedBy,
          closedAt: new Date(),
          closeMsg
        }
      });
      logger.debug('Ticket closed', {
        context: 'Database',
        threadId,
        closedBy
      });
      return result;
    } catch (err) {
      logger.error('Failed to close ticket', {
        context: 'Database',
        error: err,
        threadId,
        closedBy
      });
      return null;
    }
  },
  async getGuildConfig(guildId: string): Promise<GuildConfig | null> {
    try {
      return await getCachedGuildConfig(guildId);
    } catch (err) {
      logger.error('Failed to get guild config', {
        context: 'Database',
        error: err,
        guildId
      });
      return null;
    }
  },
  async getOrCreateGuildConfig(guildId: string): Promise<GuildConfig | null> {
    try {
      const result = await prisma.guildConfig.upsert({
        where: { guildId },
        update: {},
        create: { guildId }
      });
      // Invalidate cache after creating/updating
      invalidateConfigCache(guildId);
      logger.debug('Guild config created or retrieved', {
        context: 'Database',
        guildId
      });
      return result;
    } catch (err) {
      logger.error('Failed to get or create guild config', {
        context: 'Database',
        error: err,
        guildId
      });
      return null;
    }
  },
  async updateGuildConfig(guildId: string, data: Record<string, string | null | boolean>): Promise<GuildConfig | null> {
    try {
      const result = await prisma.guildConfig.upsert({
        where: { guildId },
        update: data,
        create: { guildId, ...data }
      });
      // Invalidate cache after updating
      invalidateConfigCache(guildId);
      logger.debug('Guild config updated', {
        context: 'Database',
        guildId
      });
      return result;
    } catch (err) {
      logger.error('Failed to update guild config', {
        context: 'Database',
        error: err,
        guildId
      });
      return null;
    }
  },
  async getChannelId(guildId: string, channelType: string): Promise<string | null> {
    try {
      const config = await this.getGuildConfig(guildId);
      if (!config) {
        logger.warn('Guild config not found', {
          context: 'Database',
          guildId,
          channelType
        });
        return null;
      }

      // Create a Collection for efficient O(1) lookup
      const channelMap = new Collection<string, string | null>([
        ['logs', config.logsChannelId],
        ['ticket', config.ticketChannelId],
        ['ticketLog', config.ticketLogChannelId]
      ]);

      return channelMap.get(channelType) || null;
    } catch (err) {
      logger.error('Failed to get channel ID', {
        context: 'Database',
        error: err,
        guildId,
        channelType
      });
      return null;
    }
  },
  async getRoleId(guildId: string, roleType: string): Promise<string | null> {
    try {
      const config = await this.getGuildConfig(guildId);
      if (!config) {
        logger.warn('Guild config not found', {
          context: 'Database',
          guildId,
          roleType
        });
        return null;
      }

      // Use Collection for O(1) lookups with partition capability
      const roleMap = new Collection<string, string | null>([
        ['support', config.supportRoleId],
        ['member', config.memberRoleId]
      ]);

      // Partition to separate found and not found roles
      const [found] = roleMap.partition((roleId) => roleId === roleMap.get(roleType));
      return found.first() ?? null;
    } catch (err) {
      logger.error('Failed to get role ID', {
        context: 'Database',
        error: err,
        guildId,
        roleType
      });
      return null;
    }
  },
  async sendLogMessage(channel: TextChannel | null, embed: any, context: string = 'LogMessage'): Promise<boolean> {
    if (!channel) {
      logger.warn(`Log channel not available`, { context });
      return false;
    }

    try {
      // Check if bot can send messages in this channel
      if (!channel.permissionsFor(channel.client.user!)?.has('SendMessages')) {
        logger.warn(`Bot missing SendMessages permission in log channel`, {
          context,
          channelId: channel.id,
          guildId: channel.guild.id
        });
        return false;
      }

      await channel.send({ embeds: [embed] });
      logger.debug(`Log message sent to channel`, {
        context,
        channelId: channel.id
      });
      return true;
    } catch (err) {
      logger.error(`Failed to send log message to channel`, {
        context,
        error: err,
        channelId: channel.id
      });
      return false;
    }
  },
  async createTranscript(guildId: string, ticketId: string, threadId: string, userId: string, category: string, slug: string, htmlContent: string): Promise<any | null> {
    try {
      const result = await prisma.transcript.create({
        data: {
          guildId,
          ticketId,
          threadId,
          userId,
          category,
          slug,
          htmlContent
        }
      });
      logger.debug('Transcript created', {
        context: 'Database',
        slug,
        ticketId
      });
      return result;
    } catch (err) {
      logger.error('Failed to create transcript', {
        context: 'Database',
        error: err,
        ticketId
      });
      return null;
    }
  },
  async getTranscriptBySlug(slug: string): Promise<any | null> {
    try {
      const result = await prisma.transcript.findUnique({
        where: { slug }
      });
      return result;
    } catch (err) {
      logger.error('Failed to fetch transcript by slug', {
        context: 'Database',
        error: err,
        slug
      });
      return null;
    }
  },
  async deleteTranscript(slug: string): Promise<boolean> {
    try {
      await prisma.transcript.delete({
        where: { slug }
      });
      logger.debug('Transcript deleted', {
        context: 'Database',
        slug
      });
      return true;
    } catch (err) {
      logger.error('Failed to delete transcript', {
        context: 'Database',
        error: err,
        slug
      });
      return false;
    }
  },
  async setVerification(guildId: string, sourceGuildId: string, roleIds: string[]): Promise<GuildConfig | null> {
    try {
      const result = await this.updateGuildConfig(guildId, {
        verificationEnabled: true,
        verificationSourceGuildId: sourceGuildId,
        verificationRoleIds: JSON.stringify(roleIds)
      });
      return result;
    } catch (err) {
      logger.error('Failed to set verification', {
        context: 'Database',
        error: err,
        guildId
      });
      return null;
    }
  },
  async disableVerification(guildId: string): Promise<GuildConfig | null> {
    try {
      const result = await this.updateGuildConfig(guildId, {
        verificationEnabled: false,
        verificationSourceGuildId: null,
        verificationRoleIds: null
      });
      return result;
    } catch (err) {
      logger.error('Failed to disable verification', {
        context: 'Database',
        error: err,
        guildId
      });
      return null;
    }
  },
  async getVerificationRoles(guildId: string): Promise<string[] | null> {
    try {
      const config = await this.getGuildConfig(guildId);
      if (!config?.verificationRoleIds) return null;
      return JSON.parse(config.verificationRoleIds);
    } catch (err) {
      logger.error('Failed to get verification roles', {
        context: 'Database',
        error: err,
        guildId
      });
      return null;
    }
  },
  async setSupportRoles(guildId: string, roleIds: string[]): Promise<GuildConfig | null> {
    try {
      const result = await this.updateGuildConfig(guildId, {
        supportRoleIds: JSON.stringify(roleIds)
      });
      return result;
    } catch (err) {
      logger.error('Failed to set support roles', {
        context: 'Database',
        error: err,
        guildId
      });
      return null;
    }
  },
  async getSupportRoles(guildId: string): Promise<string[] | null> {
    try {
      const config = await this.getGuildConfig(guildId);
      if (!config?.supportRoleIds) return null;
      return JSON.parse(config.supportRoleIds);
    } catch (err) {
      logger.error('Failed to get support roles', {
        context: 'Database',
        error: err,
        guildId
      });
      return null;
    }
  },
  async setModRolePermissions(guildId: string, permissions: Record<string, string[]>): Promise<GuildConfig | null> {
    try {
      const result = await this.updateGuildConfig(guildId, {
        modRolePermissions: JSON.stringify(permissions)
      });
      return result;
    } catch (err) {
      logger.error('Failed to set mod role permissions', {
        context: 'Database',
        error: err,
        guildId
      });
      return null;
    }
  },
  async getModRolePermissions(guildId: string): Promise<Record<string, string[]> | null> {
    try {
      const config = await this.getGuildConfig(guildId);
      if (!config?.modRolePermissions) return null;
      return JSON.parse(config.modRolePermissions);
    } catch (err) {
      logger.error('Failed to get mod role permissions', {
        context: 'Database',
        error: err,
        guildId
      });
      return null;
    }
  },

  // Level system methods
  async getLevelConfig(guildId: string) {
    try {
      const config = await prisma.levelConfig.findUnique({ where: { guildId } });
      return config;
    } catch (err) {
      logger.error('Failed to get level config', {
        context: 'Database',
        error: err,
        guildId
      });
      return null;
    }
  },

  async setupLevelSystem(guildId: string, maxLevel: number, levelRoleIds: string[]) {
    try {
      const result = await prisma.levelConfig.upsert({
        where: { guildId },
        update: {
          enabled: true,
          maxLevel,
          levelRoleIds: JSON.stringify(levelRoleIds)
        },
        create: {
          guildId,
          enabled: true,
          maxLevel,
          levelRoleIds: JSON.stringify(levelRoleIds)
        }
      });
      return result;
    } catch (err) {
      logger.error('Failed to setup level system', {
        context: 'Database',
        error: err,
        guildId
      });
      return null;
    }
  },

  async disableLevelSystem(guildId: string) {
    try {
      const result = await prisma.levelConfig.update({
        where: { guildId },
        data: { enabled: false }
      });
      return result;
    } catch (err) {
      logger.error('Failed to disable level system', {
        context: 'Database',
        error: err,
        guildId
      });
      return null;
    }
  },

  async getUserLevel(guildId: string, userId: string) {
    try {
      let userLevel = await prisma.userLevel.findUnique({
        where: { guildId_userId: { guildId, userId } }
      });
      
      if (!userLevel) {
        userLevel = await prisma.userLevel.create({
          data: { guildId, userId, level: 0, activityPoints: 0 }
        });
      }
      
      return userLevel;
    } catch (err) {
      logger.error('Failed to get user level', {
        context: 'Database',
        error: err,
        guildId,
        userId
      });
      return null;
    }
  },

  async addActivityPoints(guildId: string, userId: string, points: number, type: 'message' | 'reaction') {
    try {
      const userLevel = await this.getUserLevel(guildId, userId);
      if (!userLevel) return null;

      const updateData: Record<string, any> = {
        activityPoints: { increment: points },
        lastActiveAt: new Date()
      };

      if (type === 'message') {
        updateData.messageCount = { increment: 1 };
      } else if (type === 'reaction') {
        updateData.reactionCount = { increment: 1 };
      }

      const result = await prisma.userLevel.update({
        where: { guildId_userId: { guildId, userId } },
        data: updateData
      });

      return result;
    } catch (err) {
      logger.error('Failed to add activity points', {
        context: 'Database',
        error: err,
        guildId,
        userId,
        points
      });
      return null;
    }
  },

  calculateLevelThreshold(level: number, baseThreshold: number, exponentFactor: number): number {
    // Calculate exponential threshold: baseThreshold * (exponentFactor ^ (level - 1))
    return Math.floor(baseThreshold * Math.pow(exponentFactor, level - 1));
  },

  async calculateUserLevel(guildId: string, userId: string): Promise<number> {
    try {
      const userLevel = await this.getUserLevel(guildId, userId);
      const config = await this.getLevelConfig(guildId);

      if (!userLevel || !config || !config.enabled) return 0;

      let level = 0;
      for (let i = 1; i <= config.maxLevel; i++) {
        const threshold = this.calculateLevelThreshold(i, config.baseThreshold, config.exponentFactor);
        if (userLevel.activityPoints >= threshold) {
          level = i;
        } else {
          break;
        }
      }

      return level;
    } catch (err) {
      logger.error('Failed to calculate user level', {
        context: 'Database',
        error: err,
        guildId,
        userId
      });
      return 0;
    }
  },

  async applyDecay(guildId: string) {
    try {
      const config = await this.getLevelConfig(guildId);
      if (!config || !config.enabled) return;

      const now = new Date();
      const inactiveThreshold = new Date(now.getTime() - config.inactivityDays * 24 * 60 * 60 * 1000);

      // Get inactive users
      const inactiveUsers = await prisma.userLevel.findMany({
        where: {
          guildId,
          lastActiveAt: { lt: inactiveThreshold }
        }
      });

      // Apply decay
      for (const user of inactiveUsers) {
        const decayPoints = Math.max(0, Math.floor(user.activityPoints * config.decayRate));
        await prisma.userLevel.update({
          where: { guildId_userId: { guildId, userId: user.userId } },
          data: {
            activityPoints: { decrement: decayPoints }
          }
        });
      }

      logger.debug('Applied level decay', {
        context: 'Database',
        guildId,
        affectedUsers: inactiveUsers.length
      });
    } catch (err) {
      logger.error('Failed to apply decay', {
        context: 'Database',
        error: err,
        guildId
      });
    }
  },

  // App Config methods (global app settings)
  async getAppConfig() {
    try {
      let config = await prisma.appConfig.findUnique({
        where: { id: 1 }
      });
      
      if (!config) {
        config = await prisma.appConfig.create({
          data: { id: 1 }
        });
      }
      
      return config;
    } catch (err) {
      logger.error('Failed to get app config', {
        context: 'Database',
        error: err
      });
      return null;
    }
  },

  async getGuildIds(): Promise<string[]> {
    try {
      const config = await this.getAppConfig();
      if (!config?.guildIds) return [];
      return JSON.parse(config.guildIds);
    } catch (err) {
      logger.error('Failed to parse guild IDs', {
        context: 'Database',
        error: err
      });
      return [];
    }
  },

  async setGuildIds(guildIds: string[]): Promise<boolean> {
    try {
      await prisma.appConfig.upsert({
        where: { id: 1 },
        update: { guildIds: JSON.stringify(guildIds) },
        create: { id: 1, guildIds: JSON.stringify(guildIds) }
      });
      logger.debug('Guild IDs updated', {
        context: 'Database',
        count: guildIds.length
      });
      return true;
    } catch (err) {
      logger.error('Failed to set guild IDs', {
        context: 'Database',
        error: err
      });
      return false;
    }
  },

  async getDevIds(): Promise<string[]> {
    try {
      const config = await this.getAppConfig();
      if (!config?.devIds) return [];
      return JSON.parse(config.devIds);
    } catch (err) {
      logger.error('Failed to parse dev IDs', {
        context: 'Database',
        error: err
      });
      return [];
    }
  },

  async setDevIds(devIds: string[]): Promise<boolean> {
    try {
      await prisma.appConfig.upsert({
        where: { id: 1 },
        update: { devIds: JSON.stringify(devIds) },
        create: { id: 1, devIds: JSON.stringify(devIds) }
      });
      logger.debug('Dev IDs updated', {
        context: 'Database',
        count: devIds.length
      });
      return true;
    } catch (err) {
      logger.error('Failed to set dev IDs', {
        context: 'Database',
        error: err
      });
      return false;
    }
  },

  // Service Config methods (services monitoring)
  async getServiceConfig() {
    try {
      let config = await prisma.serviceConfig.findUnique({
        where: { id: 1 }
      });
      
      if (!config) {
        config = await prisma.serviceConfig.create({
          data: { id: 1 }
        });
      }
      
      return config;
    } catch (err) {
      logger.error('Failed to get service config', {
        context: 'Database',
        error: err
      });
      return null;
    }
  },

  async getServicesConfig(): Promise<{
    vpsServers: Array<{ name: string; ip: string }>;
    gameServers: Array<{ name: string; ip: string }>;
    clientServices: Array<{ name: string; ip: string }>;
    webServices: Array<{ name: string; url: string }>;
  }> {
    try {
      const config = await this.getServiceConfig();
      return {
        vpsServers: config?.vpsServers ? JSON.parse(config.vpsServers) : [],
        gameServers: config?.gameServers ? JSON.parse(config.gameServers) : [],
        clientServices: config?.clientServices ? JSON.parse(config.clientServices) : [],
        webServices: config?.webServices ? JSON.parse(config.webServices) : []
      };
    } catch (err) {
      logger.error('Failed to parse services config', {
        context: 'Database',
        error: err
      });
      return {
        vpsServers: [],
        gameServers: [],
        clientServices: [],
        webServices: []
      };
    }
  },

  async updateServicesConfig(
    vpsServers: Array<{ name: string; ip: string }>,
    gameServers: Array<{ name: string; ip: string }>,
    clientServices: Array<{ name: string; ip: string }>,
    webServices: Array<{ name: string; url: string }>
  ): Promise<boolean> {
    try {
      await prisma.serviceConfig.upsert({
        where: { id: 1 },
        update: {
          vpsServers: JSON.stringify(vpsServers),
          gameServers: JSON.stringify(gameServers),
          clientServices: JSON.stringify(clientServices),
          webServices: JSON.stringify(webServices)
        },
        create: {
          id: 1,
          vpsServers: JSON.stringify(vpsServers),
          gameServers: JSON.stringify(gameServers),
          clientServices: JSON.stringify(clientServices),
          webServices: JSON.stringify(webServices)
        }
      });
      logger.debug('Services config updated', {
        context: 'Database'
      });
      return true;
    } catch (err) {
      logger.error('Failed to update services config', {
        context: 'Database',
        error: err
      });
      return false;
    }
  }
};
