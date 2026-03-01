import { Client, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import db from '../lib/db';
import { logger } from '../lib/logger';

export default async (client: Client, oldMember: GuildMember, newMember: GuildMember) => {
  try {
    const config = await db.getGuildConfig(newMember.guild.id);
    const logsChannelId = config?.logsChannelId;
    if (!logsChannelId) return;

    const logsChannel = newMember.guild?.channels.cache.get(logsChannelId) as TextChannel;
    if (!logsChannel) {
      logger.warn('Logs channel not found in cache', {
        context: 'GuildMemberUpdate',
        logsChannelId,
        guildId: newMember.guild.id
      });
      return;
    }

    // Get role differences
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const addedRoles = newRoles.filter(role => !oldRoles.has(role.id) && role.id !== newMember.guild.id);
    const removedRoles = oldRoles.filter(role => !newRoles.has(role.id) && role.id !== newMember.guild.id);

    // Log added roles
    if (addedRoles.size > 0) {
      const roleList = addedRoles.map(role => role.toString()).join(', ');
      
      logger.info(`Role added to ${newMember.user.tag}: ${addedRoles.map(r => r.name).join(', ')}`, {
        context: 'GuildMemberUpdate',
        userId: newMember.user.id,
        roles: addedRoles.map(r => r.id)
      });
      
      const embed = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle('✅ Role Added')
        .setDescription(
          `**Member:** ${newMember.user.toString()} (@${newMember.user.username})\n` +
          `**User ID:** ${newMember.user.id}\n` +
          `**Roles Added:** ${roleList}`
        )
        .setThumbnail(newMember.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `ID: ${newMember.user.id} | \u00a9Copyright 2024 - 2026 NodeByte LTD` });

      await db.sendLogMessage(logsChannel, embed, 'RoleAdded');
    }

    // Log removed roles
    if (removedRoles.size > 0) {
      const roleList = removedRoles.map(role => role.toString()).join(', ');
      
      logger.info(`Role removed from ${newMember.user.tag}: ${removedRoles.map(r => r.name).join(', ')}`, {
        context: 'GuildMemberUpdate',
        userId: newMember.user.id,
        roles: removedRoles.map(r => r.id)
      });
      
      const embed = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle('❌ Role Removed')
        .setDescription(
          `**Member:** ${newMember.user.toString()} (@${newMember.user.username})\n` +
          `**User ID:** ${newMember.user.id}\n` +
          `**Roles Removed:** ${roleList}`
        )
        .setThumbnail(newMember.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `ID: ${newMember.user.id} | \u00a9Copyright 2024 - 2026 NodeByte LTD` });

      await db.sendLogMessage(logsChannel, embed, 'RoleRemoved');
    }

    // Check for server boost changes
    const wasBooster = oldMember.premiumSince !== null;
    const isBooster = newMember.premiumSince !== null;

    // User started boosting
    if (!wasBooster && isBooster) {
      const boostCount = newMember.guild.premiumSubscriptionCount || 0;
      const boostTier = newMember.guild.premiumTier;
      
      logger.info(`${newMember.user.tag} started boosting the server`, {
        context: 'GuildMemberUpdate',
        userId: newMember.user.id,
        boostCount,
        boostTier
      });
      
      const embed = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle('💎 Server Boosted')
        .setDescription(
          `**Member:** ${newMember.user.toString()} (@${newMember.user.username})\n` +
          `**User ID:** ${newMember.user.id}\n` +
          `**Total boosts:** ${boostCount}\n` +
          `**Boost tier:** Level ${boostTier}`
        )
        .setThumbnail(newMember.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `ID: ${newMember.user.id} | \u00a9Copyright 2024 - 2026 NodeByte LTD` });

      await db.sendLogMessage(logsChannel, embed, 'ServerBoost');
    }

    // User stopped boosting
    if (wasBooster && !isBooster) {
      const boostCount = newMember.guild.premiumSubscriptionCount || 0;
      const boostTier = newMember.guild.premiumTier;
      
      logger.info(`${newMember.user.tag} stopped boosting the server`, {
        context: 'GuildMemberUpdate',
        userId: newMember.user.id,
        boostCount,
        boostTier
      });
      
      const embed = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle('💔 Boost Removed')
        .setDescription(
          `**Member:** ${newMember.user.toString()} (@${newMember.user.username})\n` +
          `**User ID:** ${newMember.user.id}\n` +
          `**Total boosts:** ${boostCount}\n` +
          `**Boost tier:** Level ${boostTier}`
        )
        .setThumbnail(newMember.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `ID: ${newMember.user.id} | \u00a9Copyright 2024 - 2026 NodeByte LTD` });

      await db.sendLogMessage(logsChannel, embed, 'BoostRemoved');
    }
  } catch (err) {
    logger.error('Error in guildMemberUpdate event handler', {
      context: 'GuildMemberUpdate',
      error: err,
      userId: newMember.user.id,
      guildId: newMember.guild.id
    });
  }
};
