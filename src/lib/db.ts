import { PrismaClient, ModerationLog, Warning, Ticket, GuildConfig } from '@prisma/client';
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
  async createTicket(guildId: string, threadId: string, userId: string, category: string): Promise<Ticket | null> {
    try {
      const result = await prisma.ticket.create({
        data: {
          guildId,
          threadId,
          userId,
          category,
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
  async closeTicket(threadId: string, closedBy: string, closeReason: string): Promise<Ticket | null> {
    try {
      const result = await prisma.ticket.update({
        where: { threadId },
        data: {
          status: 'closed',
          closedBy,
          closedAt: new Date(),
          closeReason
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
  }
};
