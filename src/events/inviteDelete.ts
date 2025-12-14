import { Client, Invite, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

export default async (client: Client, invite: Invite) => {
  const logsChannelId = process.env.LOGS_CHANNEL_ID;
  if (!logsChannelId) return;

  const logsChannel = client.channels.cache.get(logsChannelId);
  if (!logsChannel || !('send' in logsChannel)) return;

  const embed = new EmbedBuilder()
    .setColor(0x3256d9)
    .setTitle('🔗 Invite Deleted')
    .addFields(
      { name: 'Code:', value: invite.code || 'Unknown', inline: true },
      { name: 'Channel:', value: invite.channel?.toString() || 'Unknown', inline: true },
      { name: 'Inviter:', value: invite.inviter?.toString() || 'Unknown', inline: true },
      { name: 'Uses:', value: `${invite.uses || 0}`, inline: true },
      { name: 'Max Uses:', value: invite.maxUses ? `${invite.maxUses}` : 'Unlimited', inline: true },
      { name: 'Created At:', value: invite.createdAt ? `<t:${Math.floor(invite.createdAt.getTime() / 1000)}:R>` : 'Unknown', inline: true }
    )
    .setTimestamp()
    .setFooter({ text: '\u00a9Copyright 2024 - 2025 NodeByte LTD' });

  await logsChannel.send({ embeds: [embed] }).catch(console.error);
};
