import { Client, GuildChannel, EmbedBuilder, TextChannel, ChannelType } from 'discord.js';

export default async (client: Client, channel: GuildChannel) => {
  const logsChannelId = process.env.LOGS_CHANNEL_ID;
  if (!logsChannelId) return;

  const logsChannel = channel.guild?.channels.cache.get(logsChannelId) as TextChannel;
  if (!logsChannel || !('send' in logsChannel)) return;

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
    .setFooter({ text: `ID: ${channel.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

  try {
    await logsChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Failed to log channel deletion', err);
  }
};
