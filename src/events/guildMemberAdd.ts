import { Client, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import db from '../lib/db';
import { logger } from '../lib/logger';

export default async (client: Client, member: GuildMember) => {
  try {
    const config = await db.getGuildConfig(member.guild.id);
    const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
    const logsChannelId = config?.logsChannelId;
    const memberRoleId = config?.memberRoleId;

    // Auto-assign member role
    if (memberRoleId) {
      try {
        await member.roles.add(memberRoleId);
        logger.info(`Assigned member role to ${member.user.tag}`, {
          context: 'GuildMemberAdd',
          userId: member.user.id,
          roleId: memberRoleId
        });
      } catch (err) {
        logger.error(`Failed to assign member role to ${member.user.tag}`, {
          context: 'GuildMemberAdd',
          error: err,
          userId: member.user.id,
          roleId: memberRoleId
        });
      }
    }

    const welcome = member.guild.channels.cache.get(welcomeChannelId as string) as TextChannel;
    const logs = member.guild.channels.cache.get(logsChannelId as string) as TextChannel;

    // Welcome embed for general channel
    if (welcome) {
      const welcomeEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle('Welcome to the Server!')
        .setDescription(`Welcome ${member.user.toString()}! to NodeByte!.`)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() || undefined });

      await db.sendLogMessage(welcome, welcomeEmbed, 'WelcomeMessage');
    }

    // Log embed for mod channel
    if (logs) {
      const logEmbed = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle('Member joined')
        .setDescription(
          `**User:** ${member.user.toString()} (@${member.user.username})\n` +
          `**User ID:** ${member.user.id}\n` +
          `**Account created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n` +
          `**Member count:** ${member.guild.memberCount}`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `ID: ${member.user.id} | \u00a9Copyright 2024 - 2026 NodeByte LTD` });

      await db.sendLogMessage(logs, logEmbed, 'MemberJoin');
    }
  } catch (err) {
    logger.error('Error in guildMemberAdd event handler', {
      context: 'GuildMemberAdd',
      error: err,
      userId: member.user.id,
      guildId: member.guild.id
    });
  }
};
