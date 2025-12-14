import { Client, GuildChannel, EmbedBuilder, TextChannel } from 'discord.js';

export default async (client: Client, oldChannel: GuildChannel, newChannel: GuildChannel) => {
  const logsChannelId = process.env.LOGS_CHANNEL_ID;
  if (!logsChannelId) return;

  const logsChannel = newChannel.guild?.channels.cache.get(logsChannelId) as TextChannel;
  if (!logsChannel || !('send' in logsChannel)) return;

  const changes: string[] = [];

  // Check for name change
  if (oldChannel.name !== newChannel.name) {
    changes.push(`**Name:** ${oldChannel.name} → ${newChannel.name}`);
  }

  // Check for topic change (text channels)
  if ('topic' in oldChannel && 'topic' in newChannel) {
    if ((oldChannel as any).topic !== (newChannel as any).topic) {
      const oldTopic = (oldChannel as any).topic || 'None';
      const newTopic = (newChannel as any).topic || 'None';
      changes.push(`**Topic:** ${oldTopic} → ${newTopic}`);
    }
  }

  // Check for nsfw change
  if ('nsfw' in oldChannel && 'nsfw' in newChannel) {
    if ((oldChannel as any).nsfw !== (newChannel as any).nsfw) {
      changes.push(`**NSFW:** ${(oldChannel as any).nsfw ? 'Yes' : 'No'} → ${(newChannel as any).nsfw ? 'Yes' : 'No'}`);
    }
  }

  // Check for slowmode change
  if ('rateLimitPerUser' in oldChannel && 'rateLimitPerUser' in newChannel) {
    if ((oldChannel as any).rateLimitPerUser !== (newChannel as any).rateLimitPerUser) {
      changes.push(`**Slowmode:** ${(oldChannel as any).rateLimitPerUser}s → ${(newChannel as any).rateLimitPerUser}s`);
    }
  }

  // If no changes detected, don't log
  if (changes.length === 0) return;

  const embed = new EmbedBuilder()
    .setColor(0x3256d9)
    .setTitle('✏️ Channel Updated')
    .addFields(
      { name: 'Channel', value: newChannel.toString(), inline: true },
      { name: 'Channel ID', value: newChannel.id, inline: true },
      { name: 'Changes', value: changes.join('\n'), inline: false }
    )
    .setTimestamp()
    .setFooter({ text: `ID: ${newChannel.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

  try {
    await logsChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Failed to log channel update', err);
  }
};
