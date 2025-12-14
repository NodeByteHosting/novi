import { Client, VoiceState, EmbedBuilder, TextChannel } from 'discord.js';

export default async (client: Client, oldState: VoiceState, newState: VoiceState) => {
  const logsChannelId = process.env.LOGS_CHANNEL_ID;
  if (!logsChannelId) return;

  const logsChannel = newState.guild?.channels.cache.get(logsChannelId) as TextChannel;
  if (!logsChannel || !('send' in logsChannel)) return;

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

    try {
      await logsChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to log voice join', err);
    }
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

    try {
      await logsChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to log voice leave', err);
    }
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

    try {
      await logsChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to log voice switch', err);
    }
  }
};
