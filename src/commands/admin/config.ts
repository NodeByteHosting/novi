import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField, EmbedBuilder } from 'discord.js';
import db from '../../lib/db';
import { logger } from '../../lib/logger';
import { ModPermission } from '../../lib/modPermissions';

const MOD_PERMISSIONS: ModPermission[] = ['ban', 'kick', 'warn', 'timeout', 'purge'];

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Manage guild configuration')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('view')
      .setDescription('View current guild configuration')
  )
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set a configuration value')
      .addStringOption((opt) =>
        opt
          .setName('key')
          .setDescription('Configuration key')
          .setRequired(true)
          .addChoices(
            { name: 'Logs Channel', value: 'logsChannelId' },
            { name: 'Ticket Channel', value: 'ticketChannelId' },
            { name: 'Ticket Log Channel', value: 'ticketLogChannelId' },
            { name: 'Member Role', value: 'memberRoleId' },
            { name: 'Bot Role', value: 'botRoleId' }
          )
      )
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Select a channel')
          .setRequired(false)
      )
      .addRoleOption((opt) =>
        opt
          .setName('role')
          .setDescription('Select a role')
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('reset')
      .setDescription('Reset a configuration value')
      .addStringOption((opt) =>
        opt
          .setName('key')
          .setDescription('Configuration key to reset')
          .setRequired(true)
          .addChoices(
            { name: 'Logs Channel', value: 'logsChannelId' },
            { name: 'Ticket Channel', value: 'ticketChannelId' },
            { name: 'Ticket Log Channel', value: 'ticketLogChannelId' },
            { name: 'Member Role', value: 'memberRoleId' },
            { name: 'Bot Role', value: 'botRoleId' }
          )
      )
  )
  // Support roles management
  .addSubcommand((sub) =>
    sub
      .setName('supportrole-add')
      .setDescription('Add a support role')
      .addRoleOption((opt) =>
        opt
          .setName('role')
          .setDescription('The role to add as a support role')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('supportrole-remove')
      .setDescription('Remove a support role')
      .addRoleOption((opt) =>
        opt
          .setName('role')
          .setDescription('The support role to remove')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('supportrole-list')
      .setDescription('List all support roles')
  )
  // Mod role permissions management
  .addSubcommand((sub) =>
    sub
      .setName('modperm-set')
      .setDescription('Set permissions for a mod role')
      .addRoleOption((opt) =>
        opt
          .setName('role')
          .setDescription('The role to configure')
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('permissions')
          .setDescription('Comma-separated: ban,kick,warn,timeout,purge')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('modperm-remove')
      .setDescription('Remove mod permissions from a role')
      .addRoleOption((opt) =>
        opt
          .setName('role')
          .setDescription('The role to remove permissions from')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('modperm-list')
      .setDescription('List all mod roles and their permissions')
  )
  // Level system management
  .addSubcommand((sub) =>
    sub
      .setName('level-setup')
      .setDescription('Setup the level system')
      .addIntegerOption((opt) =>
        opt
          .setName('max_level')
          .setDescription('Maximum level (default: 10)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(50)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('level-disable')
      .setDescription('Disable the level system and delete all level roles')
  )
  .addSubcommand((sub) =>
    sub
      .setName('level-status')
      .setDescription('View current level system settings')
  )
  .addSubcommand((sub) =>
    sub
      .setName('level-view')
      .setDescription('View your current level and activity points')
      .addUserOption((opt) =>
        opt
          .setName('user')
          .setDescription('View another user\'s level (optional)')
          .setRequired(false)
      )
  );

const fieldLabels: Record<string, string> = {
  logsChannelId: 'Logs Channel',
  ticketChannelId: 'Ticket Channel',
  ticketLogChannelId: 'Ticket Log Channel',
  memberRoleId: 'Member Role',
  botRoleId: 'Bot Role'
};

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  try {
    if (subcommand === 'view') {
      const config = await db.getOrCreateGuildConfig(guildId);
      if (!config) {
        return interaction.reply({ content: '❌ Failed to load guild configuration.', flags: [64] });
      }

      const supportRoles = await db.getSupportRoles(guildId) || [];
      const modPerms = await db.getModRolePermissions(guildId) || {};

      const embed = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle('⚙️ Guild Configuration')
        .addFields(
          {
            name: '📋 Channels',
            value: `**Logs:** ${config.logsChannelId ? `<#${config.logsChannelId}>` : 'Not set'}\n` +
                   `**Tickets:** ${config.ticketChannelId ? `<#${config.ticketChannelId}>` : 'Not set'}\n` +
                   `**Ticket Logs:** ${config.ticketLogChannelId ? `<#${config.ticketLogChannelId}>` : 'Not set'}`,
            inline: true
          },
          {
            name: '👥 Roles',
            value: `**Member:** ${config.memberRoleId ? `<@&${config.memberRoleId}>` : 'Not set'}\n` +
                   `**Bot:** ${config.botRoleId ? `<@&${config.botRoleId}>` : 'Not set'}`,
            inline: true
          },
          {
            name: '🎫 Support Roles',
            value: supportRoles.length > 0 ? supportRoles.map(r => `<@&${r}>`).join(', ') : 'None',
            inline: false
          },
          {
            name: '🔨 Mod Roles',
            value: Object.keys(modPerms).length > 0 
              ? Object.entries(modPerms).map(([roleId, perms]) => `<@&${roleId}>: ${perms.join(', ')}`).join('\n')
              : 'None',
            inline: false
          }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'set') {
      const key = interaction.options.getString('key', true);
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');

      let value: string | null = null;

      if (key.includes('Channel')) {
        if (!channel) {
          return interaction.reply({ content: '❌ Please provide a channel.', flags: [64] });
        }
        value = channel.id;
      } else if (key.includes('Role')) {
        if (!role) {
          return interaction.reply({ content: '❌ Please provide a role.', flags: [64] });
        }
        value = role.id;
      }

      const updateData: Record<string, string | null> = {};
      updateData[key] = value;

      await db.updateGuildConfig(guildId, updateData);

      const displayValue = key.includes('Channel') ? `<#${value}>` : `<@&${value}>`;

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Configuration Updated')
        .setDescription(`${fieldLabels[key]} has been set to ${displayValue}`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'reset') {
      const key = interaction.options.getString('key', true);

      const updateData: Record<string, null> = {};
      updateData[key] = null;

      await db.updateGuildConfig(guildId, updateData);

      const embed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle('⚠️ Configuration Reset')
        .setDescription(`${fieldLabels[key]} has been reset to Not set`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // Support roles management
    if (subcommand === 'supportrole-add') {
      const role = interaction.options.getRole('role', true);
      const currentRoles = await db.getSupportRoles(guildId) || [];

      if (currentRoles.includes(role.id)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF5555)
              .setTitle('Already Added')
              .setDescription(`${role} is already a support role`)
          ],
          flags: [64]
        });
      }

      const updated = [...currentRoles, role.id];
      await db.setSupportRoles(guildId, updated);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Support Role Added')
            .addFields(
              { name: 'Role', value: role.toString(), inline: true },
              { name: 'Total Support Roles', value: updated.length.toString(), inline: true }
            )
        ]
      });
    }

    if (subcommand === 'supportrole-remove') {
      const role = interaction.options.getRole('role', true);
      const currentRoles = await db.getSupportRoles(guildId) || [];

      if (!currentRoles.includes(role.id)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF5555)
              .setTitle('Not Found')
              .setDescription(`${role} is not a support role`)
          ],
          flags: [64]
        });
      }

      const updated = currentRoles.filter(r => r !== role.id);
      await db.setSupportRoles(guildId, updated);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Support Role Removed')
            .addFields(
              { name: 'Role', value: role.toString(), inline: true },
              { name: 'Total Support Roles', value: updated.length.toString(), inline: true }
            )
        ]
      });
    }

    if (subcommand === 'supportrole-list') {
      const roleIds = await db.getSupportRoles(guildId);

      if (!roleIds || roleIds.length === 0) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x3256d9)
              .setTitle('Support Roles')
              .setDescription('No support roles configured')
          ],
          flags: [64]
        });
      }

      const roles = roleIds.map(id => `<@&${id}>`).join('\n');

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3256d9)
            .setTitle('Support Roles')
            .setDescription(roles)
            .addFields({ name: 'Total', value: roleIds.length.toString(), inline: true })
        ],
        flags: [64]
      });
    }

    // Mod permissions management
    if (subcommand === 'modperm-set') {
      const role = interaction.options.getRole('role', true);
      const permissionsStr = interaction.options.getString('permissions', true).toLowerCase();

      const requestedPerms = permissionsStr
        .split(',')
        .map(p => p.trim())
        .filter(p => MOD_PERMISSIONS.includes(p as ModPermission));

      if (requestedPerms.length === 0) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF5555)
              .setTitle('Invalid Permissions')
              .setDescription(`Valid permissions are: ${MOD_PERMISSIONS.join(', ')}`)
          ],
          flags: [64]
        });
      }

      const currentPerms = await db.getModRolePermissions(guildId) || {};
      currentPerms[role.id] = requestedPerms;
      await db.setModRolePermissions(guildId, currentPerms);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Mod Role Updated')
            .addFields(
              { name: 'Role', value: role.toString(), inline: true },
              { name: 'Permissions', value: requestedPerms.join(', '), inline: false }
            )
        ]
      });
    }

    if (subcommand === 'modperm-remove') {
      const role = interaction.options.getRole('role', true);
      const currentPerms = await db.getModRolePermissions(guildId) || {};

      if (!currentPerms[role.id]) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF5555)
              .setTitle('Not Found')
              .setDescription(`${role} has no mod permissions configured`)
          ],
          flags: [64]
        });
      }

      delete currentPerms[role.id];
      await db.setModRolePermissions(guildId, currentPerms);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Mod Role Removed')
            .setDescription(`${role} no longer has mod permissions`)
        ]
      });
    }

    if (subcommand === 'modperm-list') {
      const perms = await db.getModRolePermissions(guildId);

      if (!perms || Object.keys(perms).length === 0) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x3256d9)
              .setTitle('Mod Roles')
              .setDescription('No mod roles configured')
          ],
          flags: [64]
        });
      }

      const fields = Object.entries(perms).map(([roleId, permissions]) => ({
        name: `<@&${roleId}>`,
        value: permissions.join(', '),
        inline: true
      }));

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3256d9)
            .setTitle('Mod Roles & Permissions')
            .addFields(...fields)
            .setDescription(`Available permissions: ${MOD_PERMISSIONS.join(', ')}`)
        ],
        flags: [64]
      });
    }

    // Level system management
    if (subcommand === 'level-setup') {
      const maxLevel = interaction.options.getInteger('max_level') || 10;
      const guild = interaction.guild;
      if (!guild) return;

      await interaction.deferReply({ flags: [64] });

      try {
        // Import levels utility
        const { createLevelRoles } = await import('../../lib/levels');

        // Create level roles
        const levelRoleIds = await createLevelRoles(guild, maxLevel);
        if (!levelRoleIds) {
          return interaction.editReply({
            content: '❌ Failed to create level roles. Check bot permissions.'
          });
        }

        // Setup in database
        await db.setupLevelSystem(guildId, maxLevel, levelRoleIds);

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x00FF00)
              .setTitle('✅ Level System Initialized')
              .addFields(
                { name: 'Max Level', value: maxLevel.toString(), inline: true },
                { name: 'Level Roles Created', value: maxLevel.toString(), inline: true },
                { name: 'Base Threshold', value: '100 activity points', inline: true }
              )
              .setDescription('The level system is now active! Users will start earning levels based on activity.')
          ]
        });
      } catch (err) {
        logger.error('Failed to setup level system', {
          context: 'ConfigCommand',
          error: err,
          guildId
        });
        return interaction.editReply({ content: '❌ Failed to setup level system.' });
      }
    }

    if (subcommand === 'level-disable') {
      await interaction.deferReply({ flags: [64] });

      try {
        const config = await db.getLevelConfig(guildId);
        if (!config || !config.enabled) {
          return interaction.editReply({
            content: '❌ Level system is not enabled.'
          });
        }

        // Delete level roles
        if (config.levelRoleIds) {
          const { deleteLevelRoles } = await import('../../lib/levels');
          const roleIds = JSON.parse(config.levelRoleIds);
          const guild = interaction.guild;
          if (guild) {
            await deleteLevelRoles(guild, roleIds);
          }
        }

        // Disable in database
        await db.disableLevelSystem(guildId);

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFFFF00)
              .setTitle('⚠️ Level System Disabled')
              .setDescription('All level roles have been deleted and the level system is now disabled.')
          ]
        });
      } catch (err) {
        logger.error('Failed to disable level system', {
          context: 'ConfigCommand',
          error: err,
          guildId
        });
        return interaction.editReply({ content: '❌ Failed to disable level system.' });
      }
    }

    if (subcommand === 'level-status') {
      const config = await db.getLevelConfig(guildId);

      if (!config || !config.enabled) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF5555)
              .setTitle('Level System Disabled')
              .setDescription('Run `/config level-setup` to enable the level system.')
          ],
          flags: [64]
        });
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3256d9)
            .setTitle('📊 Level System Status')
            .addFields(
              { name: 'Status', value: '✅ Enabled', inline: true },
              { name: 'Max Level', value: config.maxLevel.toString(), inline: true },
              { name: 'Base Threshold', value: `${config.baseThreshold} points`, inline: true },
              { name: 'Exponential Factor', value: config.exponentFactor.toString(), inline: true },
              { name: 'Decay Rate', value: `${(config.decayRate * 100).toFixed(0)}% per day`, inline: true },
              { name: 'Inactivity Threshold', value: `${config.inactivityDays} days`, inline: true }
            )
            .setDescription('Level progression is based on message activity, reactions, and time.')
        ],
        flags: [64]
      });
    }

    if (subcommand === 'level-view') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const userLevel = await db.getUserLevel(guildId, targetUser.id);
      const config = await db.getLevelConfig(guildId);

      if (!config || !config.enabled) {
        return interaction.reply({
          content: '❌ Level system is not enabled on this server.',
          flags: [64]
        });
      }

      if (!userLevel) {
        return interaction.reply({
          content: '❌ Failed to load level data.',
          flags: [64]
        });
      }

      const nextLevelThreshold = db.calculateLevelThreshold(userLevel.level + 1, config.baseThreshold, config.exponentFactor);
      const currentLevelThreshold = userLevel.level > 0 ? db.calculateLevelThreshold(userLevel.level, config.baseThreshold, config.exponentFactor) : 0;
      const progressPercent = userLevel.level === 0 ? 0 : Math.round(((userLevel.activityPoints - currentLevelThreshold) / (nextLevelThreshold - currentLevelThreshold)) * 100);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3256d9)
            .setTitle(`⭐ ${targetUser.username}'s Level`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
              { name: 'Current Level', value: `${userLevel.level}/${config.maxLevel}`, inline: true },
              { name: 'Activity Points', value: userLevel.activityPoints.toString(), inline: true },
              { name: 'Messages Sent', value: userLevel.messageCount.toString(), inline: true },
              { name: 'Reactions Given', value: userLevel.reactionCount.toString(), inline: true },
              { name: 'Progress to Next', value: `${progressPercent}%`, inline: true },
              { name: 'Next Level At', value: `${nextLevelThreshold} points`, inline: true }
            )
        ],
        flags: [64]
      });
    }
  } catch (err) {
    logger.error('Failed to handle config command', {
      context: 'ConfigCommand',
      error: err,
      guildId
    });

    await interaction.reply({ content: '❌ Failed to update configuration.', flags: [64] });
  }
}
