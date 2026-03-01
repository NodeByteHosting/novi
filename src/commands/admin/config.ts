import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ActionRowBuilder } from 'discord.js';
import db from '../../lib/db';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Manage guild configuration')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('get')
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
          .setMinLength(3)
          .setMaxLength(32)
          .setRequired(true)
          .addChoices(
            { name: 'Logs Channel', value: 'logsChannelId' },
            { name: 'Ticket Channel', value: 'ticketChannelId' },
            { name: 'Ticket Log Channel', value: 'ticketLogChannelId' },
            { name: 'Support Role', value: 'supportRoleId' },
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
          .setMinLength(3)
          .setMaxLength(32)
          .setRequired(true)
          .addChoices(
            { name: 'Logs Channel', value: 'logsChannelId' },
            { name: 'Ticket Channel', value: 'ticketChannelId' },
            { name: 'Ticket Log Channel', value: 'ticketLogChannelId' },
            { name: 'Support Role', value: 'supportRoleId' },
            { name: 'Member Role', value: 'memberRoleId' },
            { name: 'Bot Role', value: 'botRoleId' }
          )
      )
  );

const fieldLabels: Record<string, string> = {
  logsChannelId: 'Logs Channel',
  ticketChannelId: 'Ticket Channel',
  ticketLogChannelId: 'Ticket Log Channel',
  supportRoleId: 'Support Role',
  memberRoleId: 'Member Role',
  botRoleId: 'Bot Role'
};

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: '❌ You lack permission to use this command.', flags: [64] });
  }

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (!guildId) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', flags: [64] });
  }

  try {
    if (subcommand === 'get') {
      const config = await db.getOrCreateGuildConfig(guildId);
      if (!config) {
        return interaction.reply({ content: '❌ Failed to load guild configuration.', flags: [64] });
      }

      const embed = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle('⚙️ Guild Configuration')
        .setDescription('Current server configuration settings')
        .addFields(
          {
            name: fieldLabels.logsChannelId,
            value: config.logsChannelId ? `<#${config.logsChannelId}>` : 'Not set',
            inline: true
          },
          {
            name: fieldLabels.ticketChannelId,
            value: config.ticketChannelId ? `<#${config.ticketChannelId}>` : 'Not set',
            inline: true
          },
          {
            name: fieldLabels.ticketLogChannelId,
            value: config.ticketLogChannelId ? `<#${config.ticketLogChannelId}>` : 'Not set',
            inline: true
          },
          {
            name: fieldLabels.supportRoleId,
            value: config.supportRoleId ? `<@&${config.supportRoleId}>` : 'Not set',
            inline: true
          },
          {
            name: fieldLabels.memberRoleId,
            value: config.memberRoleId ? `<@&${config.memberRoleId}>` : 'Not set',
            inline: true
          }
        )
        .setTimestamp()
        .setFooter({ text: '© Copyright 2024 - 2025 NodeByte LTD' });

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'set') {
      const key = interaction.options.getString('key', true);
      const channel = interaction.options.getChannel('channel', false);
      const role = interaction.options.getRole('role', false);

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

      const displayValue = key.includes('Channel') 
        ? `<#${value}>`
        : `<@&${value}>`;

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
  } catch (err) {
    console.error('Failed to handle config command', err);
    await interaction.reply({ content: '❌ Failed to update configuration.', flags: [64] });
  }
}
