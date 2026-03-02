import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField, TextChannel, User } from 'discord.js';
import db from '../../lib/db';
import { logger } from '../../lib/logger';
import { hasModPermission } from '../../lib/modPermissions';

export const data = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Manage user timeouts (mutes)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Timeout a user')
      .addUserOption((o) => o.setName('target').setDescription('User to timeout').setRequired(true))
      .addIntegerOption((o) =>
        o
          .setName('duration')
          .setDescription('Duration in minutes (1-40320 = ~28 days)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(40320)
      )
      .addStringOption((o) =>
        o.setName('reason').setDescription('Reason').setMinLength(1).setMaxLength(100).setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Remove a timeout from a user')
      .addUserOption((o) => o.setName('target').setDescription('User to remove timeout from').setRequired(true))
      .addStringOption((o) =>
        o.setName('reason').setDescription('Reason for removal').setMinLength(1).setMaxLength(100).setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('check')
      .setDescription('Check if a user is timed out')
      .addUserOption((o) => o.setName('target').setDescription('User to check').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const hasDiscordPerm = interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers);
  const hasModPerm = await hasModPermission(interaction.member as any, 'timeout');

  if (!hasDiscordPerm && !hasModPerm)
    return interaction.reply({ content: '❌ You lack permission to moderate members.', flags: [64] });

  const subcommand = interaction.options.getSubcommand();
  const target = interaction.options.getUser('target', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';

  // Validation checks
  if (target.id === interaction.user.id)
    return interaction.reply({ content: '❌ You cannot timeout yourself.', flags: [64] });

  if (target.id === interaction.client.user?.id)
    return interaction.reply({ content: '❌ I cannot timeout myself.', flags: [64] });

  if (target.bot)
    return interaction.reply({ content: '❌ You cannot timeout bots.', flags: [64] });

  const member = await interaction.guild?.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ Member not found in guild.', flags: [64] });

  // Check role hierarchy
  if (member.roles.highest.position >= (interaction.member as any).roles.highest.position)
    return interaction.reply({ content: '❌ You cannot timeout someone with an equal or higher role.', flags: [64] });

  try {
    if (subcommand === 'add') {
      const duration = interaction.options.getInteger('duration', true);

      // Check if user is already timed out
      if (member.communicationDisabledUntil) {
        const remainingTime = Math.ceil(
          (member.communicationDisabledUntil.getTime() - Date.now()) / 1000 / 60
        );
        return interaction.reply({
          content: `⏱️ **${target.tag}** is already timed out for **${remainingTime}** more minutes.`,
          flags: [64]
        });
      }

      // Apply timeout
      await member.timeout(duration * 60 * 1000, `${interaction.user.tag}: ${reason}`);

      // Log to database
      await db.logModeration('timeout', interaction.guild!.id, interaction.user.id, target.id, reason);

      // Send to mod logs channel
      const config = await db.getGuildConfig(interaction.guildId!);
      const logsChannelId = config?.logsChannelId;
      const logsChannel = interaction.guild?.channels.cache.get(logsChannelId!) as TextChannel;

      if (logsChannel) {
        const embed = {
          color: 0xFF9900,
          title: '⏱️ User Timed Out',
          description: `**User:** ${target.toString()} (@${target.username})\n**Moderator:** ${interaction.user.toString()} (@${interaction.user.username})\n**Duration:** ${duration} minutes\n**Reason:** ${reason}`,
          thumbnail: { url: target.displayAvatarURL() },
          timestamp: new Date().toISOString(),
          footer: { text: `User ID: ${target.id} | © Copyright 2024 - 2026 NodeByte LTD` }
        };
        await db.sendLogMessage(logsChannel, embed, 'TimeoutApplied');
      }

      // Send DM to user
      const dmSent = await db.sendDM(
        target,
        'timedout',
        interaction.guild?.name || 'Unknown Server',
        `${duration} minute timeout: ${reason}`,
        interaction.user
      );

      await interaction.reply({
        content: `⏱️ Timed out **${target.tag}** for **${duration}** minute(s) — ${reason}${
          !dmSent ? '\n⚠️ Could not DM user.' : ''
        }`
      });

      logger.info(`User timed out for ${duration} minutes`, {
        context: 'TimeoutCommand',
        userId: target.id,
        guildId: interaction.guildId || undefined,
        moderatorId: interaction.user.id,
        duration
      });
    } else if (subcommand === 'remove') {
      // Check if user is timed out
      if (!member.communicationDisabledUntil) {
        return interaction.reply({
          content: `ℹ️ **${target.tag}** is not currently timed out.`,
          flags: [64]
        });
      }

      // Remove timeout
      await member.timeout(null, `${interaction.user.tag}: ${reason}`);

      // Log to database
      await db.logModeration('untimeout', interaction.guild!.id, interaction.user.id, target.id, reason);

      // Send to mod logs channel
      const config = await db.getGuildConfig(interaction.guildId!);
      const logsChannelId = config?.logsChannelId;
      const logsChannel = interaction.guild?.channels.cache.get(logsChannelId!) as TextChannel;

      if (logsChannel) {
        const embed = {
          color: 0x00AA00,
          title: '✅ Timeout Removed',
          description: `**User:** ${target.toString()} (@${target.username})\n**Moderator:** ${interaction.user.toString()} (@${interaction.user.username})\n**Reason:** ${reason}`,
          thumbnail: { url: target.displayAvatarURL() },
          timestamp: new Date().toISOString(),
          footer: { text: `User ID: ${target.id} | © Copyright 2024 - 2026 NodeByte LTD` }
        };
        await db.sendLogMessage(logsChannel, embed, 'TimeoutRemoved');
      }

      // Send DM to user
      const dmSent = await db.sendDM(
        target,
        'untimeout',
        interaction.guild?.name || 'Unknown Server',
        `Timeout removed: ${reason}`,
        interaction.user
      );

      await interaction.reply({
        content: `✅ Removed timeout from **${target.tag}** — ${reason}${!dmSent ? '\n⚠️ Could not DM user.' : ''}`
      });

      logger.info(`User timeout removed`, {
        context: 'TimeoutCommand',
        userId: target.id,
        guildId: interaction.guildId || undefined,
        moderatorId: interaction.user.id
      });
    } else if (subcommand === 'check') {
      if (!member.communicationDisabledUntil) {
        return interaction.reply({
          content: `ℹ️ **${target.tag}** is not currently timed out.`
        });
      }

      const remainingMs = member.communicationDisabledUntil.getTime() - Date.now();
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      const remainingHours = Math.ceil(remainingSeconds / 3600);
      const remainingDays = Math.ceil(remainingSeconds / 86400);

      let timeString = '';
      if (remainingDays >= 1) {
        timeString = `${remainingDays} day(s)`;
      } else if (remainingHours >= 1) {
        timeString = `${remainingHours} hour(s)`;
      } else if (remainingMinutes >= 1) {
        timeString = `${remainingMinutes} minute(s)`;
      } else {
        timeString = `${remainingSeconds} second(s)`;
      }

      const embed = {
        color: 0xFF9900,
        title: '⏱️ User Timeout Status',
        description: `**User:** ${target.toString()} (@${target.username})\n**Timed out until:** <t:${Math.floor(member.communicationDisabledUntil.getTime() / 1000)}:R>\n**Remaining:** ${timeString}`,
        thumbnail: { url: target.displayAvatarURL() },
        timestamp: new Date().toISOString(),
        footer: { text: `User ID: ${target.id} | © Copyright 2024 - 2026 NodeByte LTD` }
      };

      await interaction.reply({
        embeds: [embed]
      });

      logger.debug(`Timeout status checked`, {
        context: 'TimeoutCommand',
        userId: target.id,
        guildId: interaction.guildId || undefined,
        remainingMs
      });
    }
  } catch (err) {
    logger.error('Error in timeout command', {
      context: 'TimeoutCommand',
      error: err,
      subcommand,
      userId: target.id,
      guildId: interaction.guildId || 'unknown'
    });
    await interaction.reply({
      content: '❌ Failed to execute timeout command. Check my permissions and role hierarchy.',
      flags: ['SuppressEmbeds']
    });
  }
}
