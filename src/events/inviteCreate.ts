import { Client, Invite, EmbedBuilder, TextChannel } from 'discord.js';
import db from '../lib/db';
import { logger } from '../lib/logger';

export default async (client: Client, invite: Invite) => {
  try {
    const guild = client.guilds.cache.get(invite.guild?.id || '');
    if (!guild) return;

    const config = await db.getGuildConfig(guild.id);
    const logsChannelId = config?.logsChannelId;
    if (!logsChannelId) return;

    const logsChannel = guild.channels.cache.get(logsChannelId) as TextChannel;
    if (!logsChannel) {
      logger.warn('Logs channel not found in cache', {
        context: 'InviteCreate',
        logsChannelId,
        guildId: guild.id
      });
      return;
    }

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
      .setFooter({ text: `Invite: ${invite.code} | \u00a9Copyright 2024 - 2026 NodeByte LTD` });

    await db.sendLogMessage(logsChannel, embed, 'InviteCreate');
  } catch (err) {
    logger.error('Error in inviteCreate event handler', {
      context: 'InviteCreate',
      error: err,
      inviteCode: invite.code,
      guildId: invite.guild?.id
    });
  }
};
