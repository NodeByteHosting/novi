import { PrismaClient } from '@prisma/client';
import { EmbedBuilder, TextChannel, User } from 'discord.js';

const prisma = new PrismaClient();

export default {
  prisma,
  async logModeration(action: string, guildId: string, moderatorId: string, targetId: string, reason?: string) {
    try {
      await (prisma as any).moderationLog.create({
        data: {
          action,
          guildId,
          moderatorId,
          targetId,
          reason: reason || null
        }
      });
    } catch (err) {
      console.error('Failed to write mod log via Prisma', err);
    }
  },
  async addWarning(guildId: string, userId: string, moderatorId: string, reason: string) {
    try {
      return await (prisma as any).warning.create({
        data: {
          guildId,
          userId,
          moderatorId,
          reason
        }
      });
    } catch (err) {
      console.error('Failed to add warning', err);
      return null;
    }
  },
  async getWarnings(guildId: string, userId: string) {
    try {
      return await (prisma as any).warning.findMany({
        where: {
          guildId,
          userId
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (err) {
      console.error('Failed to fetch warnings', err);
      return [];
    }
  },
  async getModLogs(guildId: string, userId: string) {
    try {
      return await (prisma as any).moderationLog.findMany({
        where: {
          guildId,
          targetId: userId
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (err) {
      console.error('Failed to fetch moderation logs', err);
      return [];
    }
  },
  async sendModLog(channel: TextChannel | null, action: string, moderator: User, target: User, reason: string) {
    if (!channel || !('send' in channel)) return;

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
      .setFooter({ text: `ID: ${target.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

    try {
      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to send mod log', err);
    }
  },
  async sendDM(user: User, action: string, guildName: string, reason: string, moderator?: User) {
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
      return true;
    } catch (err) {
      console.error(`Failed to DM user ${user.tag}`, err);
      return false;
    }
  }
};
