import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../lib/logger';
import db from '../../lib/db';

export const data = new SlashCommandBuilder()
  .setName('devconfig')
  .setDescription('Manage app-level configuration (dev-only)')
  .setDMPermission(false)
  .addSubcommandGroup(group =>
    group
      .setName('guilds')
      .setDescription('Manage guild IDs')
      .addSubcommand(sub =>
        sub
          .setName('add')
          .setDescription('Add a guild ID')
          .addStringOption(option =>
            option.setName('guild_id').setDescription('Guild ID to add').setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('remove')
          .setDescription('Remove a guild ID')
          .addStringOption(option =>
            option.setName('guild_id').setDescription('Guild ID to remove').setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('list')
          .setDescription('List all guild IDs')
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('devs')
      .setDescription('Manage developer IDs')
      .addSubcommand(sub =>
        sub
          .setName('add')
          .setDescription('Add a developer ID')
          .addStringOption(option =>
            option.setName('user_id').setDescription('User ID to add as dev').setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('remove')
          .setDescription('Remove a developer ID')
          .addStringOption(option =>
            option.setName('user_id').setDescription('User ID to remove from devs').setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('list')
          .setDescription('List all developer IDs')
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('services')
      .setDescription('Manage service monitoring config')
      .addSubcommand(sub =>
        sub
          .setName('set')
          .setDescription('Set services configuration (JSON format)')
          .addStringOption(option =>
            option
              .setName('config')
              .setDescription('Services config as JSON')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('view')
          .setDescription('View current services configuration')
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // Dev-only check
  const devIds = await db.getDevIds();
  if (!devIds.includes(interaction.user.id)) {
    return interaction.reply({
      content: '❌ This command is dev-only.',
      flags: [64]
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const group = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  try {
    // ===== GUILDS =====
    if (group === 'guilds') {
      const guildIds = await db.getGuildIds();

      if (subcommand === 'add') {
        const guildId = interaction.options.getString('guild_id', true);

        if (guildIds.includes(guildId)) {
          return interaction.editReply({
            content: `❌ Guild ID \`${guildId}\` is already in the list.`
          });
        }

        guildIds.push(guildId);
        const success = await db.setGuildIds(guildIds);

        if (!success) {
          return interaction.editReply({
            content: `❌ Failed to add guild ID.`
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x3BB98E)
          .setTitle('Guild ID Added')
          .setDescription(`Guild ID: \`${guildId}\``)
          .addFields(
            { name: 'Total Guilds', value: String(guildIds.length), inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'remove') {
        const guildId = interaction.options.getString('guild_id', true);

        const index = guildIds.indexOf(guildId);
        if (index === -1) {
          return interaction.editReply({
            content: `❌ Guild ID \`${guildId}\` not found.`
          });
        }

        guildIds.splice(index, 1);
        const success = await db.setGuildIds(guildIds);

        if (!success) {
          return interaction.editReply({
            content: `❌ Failed to remove guild ID.`
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x3BB98E)
          .setTitle('Guild ID Removed')
          .setDescription(`Guild ID: \`${guildId}\``)
          .addFields(
            { name: 'Total Guilds', value: String(guildIds.length), inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'list') {
        const listGuildIds = await db.getGuildIds();

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('Configured Guild IDs')
          .setDescription(
            listGuildIds.length > 0
              ? `\`\`\`\n${listGuildIds.join('\n')}\n\`\`\``
              : 'No guilds configured'
          )
          .addFields(
            { name: 'Total', value: String(listGuildIds.length), inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    // ===== DEVS =====
    if (group === 'devs') {
      const devList = await db.getDevIds();

      if (subcommand === 'add') {
        const userId = interaction.options.getString('user_id', true);

        if (devList.includes(userId)) {
          return interaction.editReply({
            content: `❌ User \`${userId}\` is already a developer.`
          });
        }

        devList.push(userId);
        const success = await db.setDevIds(devList);

        if (!success) {
          return interaction.editReply({
            content: `❌ Failed to add developer.`
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x3BB98E)
          .setTitle('Developer Added')
          .setDescription(`User ID: \`${userId}\``)
          .addFields(
            { name: 'Total Developers', value: String(devList.length), inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'remove') {
        const userId = interaction.options.getString('user_id', true);

        const index = devList.indexOf(userId);
        if (index === -1) {
          return interaction.editReply({
            content: `❌ User \`${userId}\` is not a developer.`
          });
        }

        devList.splice(index, 1);
        const success = await db.setDevIds(devList);

        if (!success) {
          return interaction.editReply({
            content: `❌ Failed to remove developer.`
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x3BB98E)
          .setTitle('Developer Removed')
          .setDescription(`User ID: \`${userId}\``)
          .addFields(
            { name: 'Total Developers', value: String(devList.length), inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'list') {
        const currentDevList = await db.getDevIds();

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('Developers')
          .setDescription(
            currentDevList.length > 0
              ? `\`\`\`\n${currentDevList.join('\n')}\n\`\`\``
              : 'No developers configured'
          )
          .addFields(
            { name: 'Total', value: String(currentDevList.length), inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    // ===== SERVICES =====
    if (group === 'services') {
      if (subcommand === 'set') {
        const configStr = interaction.options.getString('config', true);

        let config;
        try {
          config = JSON.parse(configStr);
        } catch (err) {
          return interaction.editReply({
            content: `❌ Invalid JSON format: ${err instanceof Error ? err.message : 'Unknown error'}`
          });
        }

        // Validate structure
        const requiredKeys = ['vpsServers', 'gameServers', 'clientServices', 'webServices'];
        const hasAllKeys = requiredKeys.every(key => key in config);

        if (!hasAllKeys) {
          return interaction.editReply({
            content: `❌ Config must contain all required keys: ${requiredKeys.join(', ')}`
          });
        }

        const success = await db.updateServicesConfig(
          config.vpsServers || [],
          config.gameServers || [],
          config.clientServices || [],
          config.webServices || []
        );

        if (!success) {
          return interaction.editReply({
            content: `❌ Failed to update services config.`
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x3BB98E)
          .setTitle('Services Config Updated')
          .addFields(
            { name: 'VPS Servers', value: String(config.vpsServers?.length || 0), inline: true },
            { name: 'Game Servers', value: String(config.gameServers?.length || 0), inline: true },
            { name: 'Client Services', value: String(config.clientServices?.length || 0), inline: true },
            { name: 'Web Services', value: String(config.webServices?.length || 0), inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'view') {
        const servicesConfig = await db.getServicesConfig();

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('Current Services Configuration')
          .addFields(
            { name: 'VPS Servers', value: `\`\`\`json\n${JSON.stringify(servicesConfig.vpsServers, null, 2)}\n\`\`\`` },
            { name: 'Game Servers', value: `\`\`\`json\n${JSON.stringify(servicesConfig.gameServers, null, 2)}\n\`\`\`` },
            { name: 'Client Services', value: `\`\`\`json\n${JSON.stringify(servicesConfig.clientServices, null, 2)}\n\`\`\`` },
            { name: 'Web Services', value: `\`\`\`json\n${JSON.stringify(servicesConfig.webServices, null, 2)}\n\`\`\`` }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }
  } catch (err) {
    logger.error('Error in devconfig command', {
      context: 'DevConfigCommand',
      error: err,
      userId: interaction.user.id
    });

    return interaction.editReply({
      content: '❌ An error occurred while processing your request.'
    });
  }
}
