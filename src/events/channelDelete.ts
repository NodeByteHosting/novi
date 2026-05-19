import { Client, GuildChannel, EmbedBuilder, TextChannel, ChannelType } from 'discord.js';
import db from '../lib/db';
import { logger } from '../lib/logger';

export default async (client: Client, channel: GuildChannel) => {
  try {
    const config = await db.getGuildConfig(channel.guild.id);
    const logsChannelId = config?.logsChannelId;
    if (!logsChannelId) return;

    const logsChannel = channel.guild?.channels.cache.get(logsChannelId) as TextChannel;
    if (!logsChannel) {
      logger.warn('Logs channel not found in cache', {
        context: 'ChannelDelete',
        logsChannelId,
        guildId: channel.guild.id
      });
      return;
    }

    const channelTypes: Record<number, string> = {
      [ChannelType.GuildText]: 'Text Channel',
      [ChannelType.GuildVoice]: 'Voice Channel',
      [ChannelType.GuildCategory]: 'Category',
      [ChannelType.GuildAnnouncement]: 'Announcement Channel',
      [ChannelType.GuildStageVoice]: 'Stage Channel',
      [ChannelType.GuildForum]: 'Forum Channel'
    };

    const embed = new EmbedBuilder()
      .setColor(0x3256d9)
      .setTitle('🗑️ Channel Deleted')
      .addFields(
        { name: 'Channel Name', value: channel.name, inline: true },
        { name: 'Type', value: channelTypes[channel.type] || 'Unknown', inline: true },
        { name: 'Channel ID', value: channel.id, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `ID: ${channel.id} | \u00a9Copyright 2024 - 2026 NodeByte LTD` });

    await db.sendLogMessage(logsChannel, embed, 'ChannelDelete');
  } catch (err) {
    logger.error('Error in channelDelete event handler', {
      context: 'ChannelDelete',
      error: err,
      channelId: channel.id,
      guildId: channel.guild.id
    });
  }
};
