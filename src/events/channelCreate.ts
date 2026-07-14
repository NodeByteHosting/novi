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
        context: 'ChannelCreate',
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
      .setTitle('📁 Channel Created')
      .addFields(
        { name: 'Channel', value: channel.toString(), inline: true },
        { name: 'Type', value: channelTypes[channel.type] || 'Unknown', inline: true },
        { name: 'Channel ID', value: channel.id, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `ID: ${channel.id} | \u00a9Copyright 2024 - 2026 NodeByte LTD` });

    await db.sendLogMessage(logsChannel, embed, 'ChannelCreate');
  } catch (err) {
    logger.error('Error in channelCreate event handler', {
      context: 'ChannelCreate',
      error: err,
      channelId: channel.id,
      guildId: channel.guild.id
    });
  }
};
