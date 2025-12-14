import { Client, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';

export default async (client: Client, oldMember: GuildMember, newMember: GuildMember) => {
  const logsChannelId = process.env.LOGS_CHANNEL_ID;
  if (!logsChannelId) return;

  const logsChannel = newMember.guild?.channels.cache.get(logsChannelId) as TextChannel;
  if (!logsChannel || !('send' in logsChannel)) return;

  // Get role differences
  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  const addedRoles = newRoles.filter(role => !oldRoles.has(role.id) && role.id !== newMember.guild.id);
  const removedRoles = oldRoles.filter(role => !newRoles.has(role.id) && role.id !== newMember.guild.id);

  // Log added roles
  if (addedRoles.size > 0) {
    const roleList = addedRoles.map(role => role.toString()).join(', ');
    
    console.log(`[ROLE LOG] Role added to ${newMember.user.tag}: ${addedRoles.map(r => r.name).join(', ')}`);
    
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
      .setFooter({ text: `ID: ${newMember.user.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

    try {
      await logsChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to log role addition', err);
    }
  }

  // Log removed roles
  if (removedRoles.size > 0) {
    const roleList = removedRoles.map(role => role.toString()).join(', ');
    
    console.log(`[ROLE LOG] Role removed from ${newMember.user.tag}: ${removedRoles.map(r => r.name).join(', ')}`);
    
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
      .setFooter({ text: `ID: ${newMember.user.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

    try {
      await logsChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to log role removal', err);
    }
  }

  // Check for server boost changes
  const wasBooster = oldMember.premiumSince !== null;
  const isBooster = newMember.premiumSince !== null;

  // User started boosting
  if (!wasBooster && isBooster) {
    const boostCount = newMember.guild.premiumSubscriptionCount || 0;
    const boostTier = newMember.guild.premiumTier;
    
    console.log(`[BOOST LOG] ${newMember.user.tag} started boosting`);
    
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
      .setFooter({ text: `ID: ${newMember.user.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

    try {
      await logsChannel.send({ embeds: [embed] });
      console.log(`[ROLE LOG] Server boost log sent successfully`);
    } catch (err) {
      console.error('Failed to log server boost', err);
    }
  }

  // User stopped boosting
  if (wasBooster && !isBooster) {
    const boostCount = newMember.guild.premiumSubscriptionCount || 0;
    const boostTier = newMember.guild.premiumTier;
    
    console.log(`[BOOST LOG] ${newMember.user.tag} stopped boosting`);
    
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
      .setFooter({ text: `ID: ${newMember.user.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

    try {
      await logsChannel.send({ embeds: [embed] });
      console.log(`[BOOST LOG] Boost removal log sent successfully`);
    } catch (err) {
      console.error('Failed to log boost removal', err);
    }
  }
};
