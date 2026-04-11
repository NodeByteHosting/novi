import { Client, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import db from '../lib/db';
import { logger } from '../lib/logger';

export default async (client: Client, member: GuildMember) => {
  try {
    const config = await db.getGuildConfig(member.guild.id);
    const welcomeChannelId = config?.welcomeChannelId;
    const logsChannelId = config?.logsChannelId;
    const memberRoleId = config?.memberRoleId;

    // ──── Verification System: Check if user meets requirements from source guild ────
    if (config?.verificationEnabled && config?.verificationSourceGuildId) {
      try {
        // Skip verification for bots - allow bots to join both servers
        if (member.user.bot) {
          logger.debug('Bot detected, skipping verification check', {
            context: 'GuildMemberAdd',
            userId: member.user.id,
            guildId: member.guild.id
          });
        } else {
          const sourceGuild = client.guilds.cache.get(config.verificationSourceGuildId);
          if (!sourceGuild) {
            logger.warn('Verification source guild not found', {
              context: 'GuildMemberAdd',
              sourceGuildId: config.verificationSourceGuildId,
              currentGuildId: member.guild.id
            });
            await member.kick('Verification source guild not configured properly');
            return;
          }

          // Try to fetch the member from the source guild
          let sourceMember = sourceGuild.members.cache.get(member.user.id);
          if (!sourceMember) {
            try {
              sourceMember = await sourceGuild.members.fetch(member.user.id);
            } catch (fetchErr) {
              // User is not in the source guild
              logger.debug('User not in source guild, kicking', {
                context: 'GuildMemberAdd',
                userId: member.user.id,
                sourceGuildId: config.verificationSourceGuildId,
                currentGuildId: member.guild.id
              });
              await member.kick('You must be a member of the verification server with required roles');
              return;
            }
          }

          // Get required role IDs
          const requiredRoles = await db.getVerificationRoles(member.guild.id);
          if (!requiredRoles || requiredRoles.length === 0) {
            logger.warn('No required roles configured for verification', {
              context: 'GuildMemberAdd',
              guildId: member.guild.id
            });
            return;
          }

          // Check if user has at least one of the required roles (supports multiple staff roles)
          const hasRequiredRole = requiredRoles.some(roleId => sourceMember!.roles.cache.has(roleId));
          if (!hasRequiredRole) {
            logger.debug('User lacks required roles, kicking', {
              context: 'GuildMemberAdd',
              userId: member.user.id,
              sourceGuildId: config.verificationSourceGuildId,
              currentGuildId: member.guild.id,
              requiredRoles
            });
            await member.kick('You do not have the required roles in the verification server');
            return;
          }

          logger.debug('User passed verification check', {
            context: 'GuildMemberAdd',
            userId: member.user.id,
            sourceGuildId: config.verificationSourceGuildId,
            currentGuildId: member.guild.id
          });
        }
      } catch (verifyErr) {
        logger.error('Error during verification check', {
          context: 'GuildMemberAdd',
          error: verifyErr,
          userId: member.user.id,
          guildId: member.guild.id
        });
        await member.kick('Error during verification process').catch(() => null);
        return;
      }
    }

    // Auto-assign appropriate role based on whether member is a bot or user
    const botRoleId = config?.botRoleId;
    const roleToAssign = member.user.bot ? botRoleId : memberRoleId;
    
    if (roleToAssign) {
      try {
        await member.roles.add(roleToAssign);
        const roleType = member.user.bot ? 'bot' : 'member';
        logger.info(`Assigned ${roleType} role to ${member.user.tag}`, {
          context: 'GuildMemberAdd',
          userId: member.user.id,
          roleId: roleToAssign,
          isBot: member.user.bot
        });
      } catch (err) {
        logger.error(`Failed to assign role to ${member.user.tag}`, {
          context: 'GuildMemberAdd',
          error: err,
          userId: member.user.id,
          roleId: roleToAssign,
          isBot: member.user.bot
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
