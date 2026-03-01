import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import db from '../../lib/db';

export const data = new SlashCommandBuilder()
  .setName('setuptickets')
  .setDescription('Setup the ticket system message')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addBooleanOption((opt) =>
    opt
      .setName('disable_notifications')
      .setDescription('Disable support role notifications for tickets (useful for testing)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: '❌ You lack permission to use this command.', flags: [64] });
  }

  const guildId = interaction.guildId;
  const disableNotifications = interaction.options.getBoolean('disable_notifications', false) || false;

  if (!guildId) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', flags: [64] });
  }

  try {
    const config = await db.getOrCreateGuildConfig(guildId);
    const ticketChannelId = config?.ticketChannelId;

    if (!ticketChannelId) {
      return interaction.reply({ 
        content: '❌ Ticket channel is not configured. Use `/config set` to configure it.', 
        flags: [64] 
      });
    }

    const ticketChannel = interaction.guild?.channels.cache.get(ticketChannelId) as TextChannel;
    if (!ticketChannel || !ticketChannel.isTextBased()) {
      return interaction.reply({ 
        content: '❌ Ticket channel not found or is not a text channel.', 
        flags: [64] 
      });
    }

    // Update the config with notification setting
    if (disableNotifications !== config.disableSupportNotifications) {
      await db.updateGuildConfig(guildId, { disableSupportNotifications: disableNotifications });
    }

    // Create the embed for the ticket message
    const embed = new EmbedBuilder()
      .setColor(0x3256d9)
      .setTitle('🎫 Support Ticket System')
      .setDescription('Click the button below to create a support ticket.\n\nOur support team will assist you as soon as possible.\n\n**📌 Notes:**\n- Do not provide sensitive information in public channels\n- Billing and Account Support must be handled through our website\n- Please be descriptive about your issue')
      .setThumbnail(interaction.client.user?.displayAvatarURL() || '')
      .setTimestamp()
      .setFooter({ text: `© Copyright 2024 - 2026 NodeByte LTD${disableNotifications ? ' [Notifications Disabled]' : ''}` });

    // Create the button
    const createButton = new ButtonBuilder()
      .setCustomId('ticket_create')
      .setLabel('Create Ticket')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(createButton);

    // Check if we have an existing message to update
    const existingMessageId = config?.ticketMessageId;
    let ticketMessageId: string | null = null;

    if (existingMessageId) {
      try {
        const existingMessage = await ticketChannel.messages.fetch(existingMessageId);
        // Edit the existing message
        await existingMessage.edit({ embeds: [embed], components: [row] });
        ticketMessageId = existingMessageId;
        await interaction.reply({ 
          content: `✅ Updated ticket message in ${ticketChannel.toString()}!${disableNotifications ? '\n⚠️ Support notifications are **disabled** for testing.' : ''}`, 
          flags: [64] 
        });
      } catch (fetchErr) {
        // Message doesn't exist or can't be fetched, create a new one
        const newMessage = await ticketChannel.send({ embeds: [embed], components: [row] });
        ticketMessageId = newMessage.id;
        await interaction.reply({ 
          content: `✅ Ticket message posted to ${ticketChannel.toString()}!${disableNotifications ? '\n⚠️ Support notifications are **disabled** for testing.' : ''}`, 
          flags: [64] 
        });
      }
    } else {
      // Send the message
      const newMessage = await ticketChannel.send({ embeds: [embed], components: [row] });
      ticketMessageId = newMessage.id;
      await interaction.reply({ 
        content: `✅ Ticket message posted to ${ticketChannel.toString()}!${disableNotifications ? '\n⚠️ Support notifications are **disabled** for testing.' : ''}`, 
        flags: [64] 
      });
    }

    // Update the config with the message ID and notification setting
    await db.updateGuildConfig(guildId, { ticketMessageId, disableSupportNotifications: disableNotifications });
  } catch (err) {
    console.error('Failed to setup tickets', err);
    await interaction.reply({ 
      content: '❌ Failed to post ticket message. Please check the bot permissions.', 
      flags: [64] 
    });
  }
}
