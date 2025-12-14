import { Client, Invite, EmbedBuilder, TextChannel } from 'discord.js';

export default async (client: Client, invite: Invite) => {
  const logsChannelId = process.env.LOGS_CHANNEL_ID;
  if (!logsChannelId) return;

  const guild = client.guilds.cache.get(invite.guild?.id || '');
  if (!guild) return;

  const logsChannel = guild.channels.cache.get(logsChannelId) as TextChannel;
  if (!logsChannel || !('send' in logsChannel)) return;

  const embed = new EmbedBuilder()
    .setColor(0x3256d9)
    .setTitle('📨 Invite Created')
    .addFields(
      { name: 'Code', value: invite.code, inline: true },
      { name: 'Channel', value: invite.channel?.toString() || 'Unknown', inline: true },
      { name: 'Created By', value: invite.inviter?.toString() || 'Unknown', inline: true },
      { name: 'Max Uses', value: invite.maxUses ? invite.maxUses.toString() : 'Unlimited', inline: true },
      { name: 'Expires', value: invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : 'Never', inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `Invite: ${invite.code} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

  try {
    await logsChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Failed to log invite creation', err);
  }
};
