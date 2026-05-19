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
        context: 'InviteDelete',
        logsChannelId,
        guildId: guild.id
      });
      return;
    }

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
      .setFooter({ text: '\u00a9Copyright 2024 - 2026 NodeByte LTD' });

    await db.sendLogMessage(logsChannel, embed, 'InviteDelete');
  } catch (err) {
    logger.error('Error in inviteDelete event handler', {
      context: 'InviteDelete',
      error: err,
      inviteCode: invite.code,
      guildId: invite.guild?.id
    });
  }
};
