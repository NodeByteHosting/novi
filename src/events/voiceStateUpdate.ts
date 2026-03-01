import { Client, VoiceState, EmbedBuilder, TextChannel } from 'discord.js';
import db from '../lib/db';
import { logger } from '../lib/logger';

export default async (client: Client, oldState: VoiceState, newState: VoiceState) => {
  try {
    const config = await db.getGuildConfig(newState.guild.id);
    const logsChannelId = config?.logsChannelId;
    if (!logsChannelId) return;

    const logsChannel = newState.guild?.channels.cache.get(logsChannelId) as TextChannel;
    if (!logsChannel) {
      logger.warn('Logs channel not found in cache', {
        context: 'VoiceStateUpdate',
        logsChannelId,
        guildId: newState.guild.id
      });
      return;
    }

    const member = newState.member;
    if (!member) return;

    // User joined a voice channel
    if (!oldState.channel && newState.channel) {
      const embed = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle('User joined voice channel')
        .setDescription(
          `**User:** ${member.user.toString()} (@${member.user.username})\n` +
          `**User ID:** ${member.user.id}\n` +
          `**Channel:** ${newState.channel.toString()}`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `ID: ${member.user.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

      await db.sendLogMessage(logsChannel, embed, 'VoiceJoin');
    }

    // User left a voice channel
    if (oldState.channel && !newState.channel) {
      const embed = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle('User left voice channel')
        .setDescription(
          `**User:** ${member.user.toString()} (@${member.user.username})\n` +
          `**User ID:** ${member.user.id}\n` +
          `**Channel:** ${oldState.channel.toString()}`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `ID: ${member.user.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

      await db.sendLogMessage(logsChannel, embed, 'VoiceLeave');
    }

    // User switched voice channels
    if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
      const embed = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle('User switched voice channel')
        .setDescription(
          `**User:** ${member.user.toString()} (@${member.user.username})\n` +
          `**User ID:** ${member.user.id}\n` +
          `**From:** ${oldState.channel.toString()}\n` +
          `**To:** ${newState.channel.toString()}`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `ID: ${member.user.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

      await db.sendLogMessage(logsChannel, embed, 'VoiceSwitch');
    }
  } catch (err) {
    logger.error('Error in voiceStateUpdate event handler', {
      context: 'VoiceStateUpdate',
      error: err,
      guildId: newState.guild.id,
      userId: newState.member?.id
    });
  }
};
