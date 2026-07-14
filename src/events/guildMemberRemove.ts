import { Client, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import db from '../lib/db';
import { logger } from '../lib/logger';

export default async (client: Client, member: GuildMember) => {
  try {
    const config = await db.getGuildConfig(member.guild.id);
    const logsChannelId = config?.logsChannelId;
    const logs = member.guild.channels.cache.get(logsChannelId as string) as TextChannel;

    if (!logs) {
      logger.warn('Logs channel not found in cache', {
        context: 'GuildMemberRemove',
        logsChannelId,
        guildId: member.guild.id
      });
      return;
    }

    // Calculate how long they were in the server
    const joinedTimestamp = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
    const accountAge = Math.floor(member.user.createdTimestamp / 1000);

    // Log embed for mod channel
    const logEmbed = new EmbedBuilder()
      .setColor(0x3256d9)
      .setTitle('👋 Member Left')
      .setDescription(
        `**User:** ${member.user.toString()} (@${member.user.username})\n` +
        `**User ID:** ${member.user.id}\n` +
        `**Account created:** <t:${accountAge}:R>\n` +
        (joinedTimestamp ? `**Joined server:** <t:${joinedTimestamp}:R>\n` : '') +
        `**Member count:** ${member.guild.memberCount}`
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: `ID: ${member.user.id} | \u00a9Copyright 2024 - 2026 NodeByte LTD` });

    // Add roles if they had any
    if (member.roles.cache.size > 1) {
      const roles = member.roles.cache
        .filter(role => role.id !== member.guild.id)
        .map(role => role.toString())
        .join(', ');
      
      if (roles) {
        logEmbed.addFields({ name: 'Roles:', value: roles, inline: false });
      }
    }

    await db.sendLogMessage(logs, logEmbed, 'MemberRemove');
  } catch (err) {
    logger.error('Error in guildMemberRemove event handler', {
      context: 'GuildMemberRemove',
      error: err,
      userId: member.user.id,
      guildId: member.guild.id
    });
  }
};
