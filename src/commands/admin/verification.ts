import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import db from '../../lib/db';
import { logger } from '../../lib/logger';

export const data = new SlashCommandBuilder()
  .setName('verification')
  .setDescription('Configure the verification system for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup')
      .setDescription('Enable verification with a source guild and required roles')
      .addStringOption(option =>
        option
          .setName('source_guild')
          .setDescription('The public guild ID to check for required roles')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('role_ids')
          .setDescription('Comma-separated role IDs (users need at least ONE to join) - e.g. 123,456,789')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('disable')
      .setDescription('Disable the verification system')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Show current verification configuration')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  if (subcommand === 'setup') {
    try {
      await interaction.deferReply();

      const sourceGuildId = interaction.options.getString('source_guild', true);
      const roleIdsStr = interaction.options.getString('role_ids', true);

      // Validate source guild ID format
      if (!/^\d{15,21}$/.test(sourceGuildId)) {
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF5555)
              .setTitle('Invalid Guild ID')
              .setDescription('Please provide a valid Discord guild ID (15-21 digits)')
          ]
        });
      }

      // Parse and validate role IDs
      const roleIds = roleIdsStr
        .split(',')
        .map(id => id.trim())
        .filter(id => /^\d{15,21}$/.test(id));

      if (roleIds.length === 0) {
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF5555)
              .setTitle('Invalid Role IDs')
              .setDescription('Please provide at least one valid role ID separated by commas')
          ]
        });
      }

      // Try to verify the source guild exists
      const sourceGuild = interaction.client.guilds.cache.get(sourceGuildId);
      if (!sourceGuild) {
        logger.warn('Source guild not in bot cache', {
          context: 'VerificationCommand',
          sourceGuildId,
          guildId
        });
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF5555)
              .setTitle('Source Guild Not Found')
              .setDescription('The bot does not have the source guild cached. Make sure the bot is in both guilds.')
          ]
        });
      }

      // Update verification settings
      const config = await db.setVerification(guildId, sourceGuildId, roleIds);

      if (!config) {
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF5555)
              .setTitle('Setup Failed')
              .setDescription('Failed to save verification settings. Please try again.')
          ]
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle('✅ Verification Enabled')
        .addFields(
          { name: 'Source Guild', value: sourceGuildId, inline: true },
          { name: 'Required Roles', value: `${roleIds.length} role(s)`, inline: true },
          { name: 'Role IDs', value: roleIds.join(', '), inline: false },
          { 
            name: 'How It Works', 
            value: '• Users must be members of the source guild\n• Users must have **at least ONE** of the required roles\n• Bots are always allowed to join\n• This only applies when joining this server', 
            inline: false 
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      logger.info('Verification system configured', {
        context: 'VerificationCommand',
        guildId,
        sourceGuildId,
        roleCount: roleIds.length
      });
    } catch (err) {
      logger.error('Error in verification setup', {
        context: 'VerificationCommand',
        error: err,
        guildId
      });

      if (!interaction.replied) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF5555)
              .setTitle('Error')
              .setDescription('An error occurred while configuring verification.')
          ],
          flags: [64]
        });
      }
    }
  } else if (subcommand === 'disable') {
    try {
      await interaction.deferReply();

      const config = await db.disableVerification(guildId);

      if (!config) {
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF5555)
              .setTitle('Disable Failed')
              .setDescription('Failed to disable verification. Please try again.')
          ]
        });
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00AA00)
            .setTitle('✅ Verification Disabled')
            .setDescription('The verification system has been disabled for this server.')
        ]
      });

      logger.info('Verification system disabled', {
        context: 'VerificationCommand',
        guildId
      });
    } catch (err) {
      logger.error('Error disabling verification', {
        context: 'VerificationCommand',
        error: err,
        guildId
      });

      if (!interaction.replied) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF5555)
              .setTitle('Error')
              .setDescription('An error occurred while disabling verification.')
          ],
          flags: [64]
        });
      }
    }
  } else if (subcommand === 'status') {
    try {
      const config = await db.getGuildConfig(guildId);

      if (!config?.verificationEnabled || !config?.verificationSourceGuildId) {
        return await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x3256d9)
              .setTitle('Verification Status')
              .setDescription('Verification is currently **disabled** for this server.')
          ],
          flags: [64]
        });
      }

      const requiredRoles = await db.getVerificationRoles(guildId);

      const embed = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle('Verification Status')
        .addFields(
          { name: 'Status', value: '🟢 Enabled', inline: true },
          { name: 'Source Guild', value: config.verificationSourceGuildId, inline: true },
          { name: 'Required Roles', value: requiredRoles && requiredRoles.length > 0 
            ? requiredRoles.join('\n')
            : 'None configured', inline: false },
          {
            name: 'Behavior',
            value: `• Users need **at least 1** of the ${requiredRoles?.length || 0} required role(s)\n• Bots are always allowed\n• Non-members are kicked immediately`,
            inline: false
          }
        );

      await interaction.reply({ embeds: [embed], flags: [64] });
    } catch (err) {
      logger.error('Error checking verification status', {
        context: 'VerificationCommand',
        error: err,
        guildId
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF5555)
            .setTitle('Error')
            .setDescription('An error occurred while checking verification status.')
        ],
        flags: [64]
      });
    }
  }
}
