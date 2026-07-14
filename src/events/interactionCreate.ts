import { Client, Interaction, EmbedBuilder, TextChannel, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder, Message, ModalBuilder, TextInputBuilder, TextInputStyle, ThreadChannel, PermissionsBitField, ChatInputCommandInteraction, StringSelectMenuInteraction, ButtonInteraction, ModalSubmitInteraction, GuildMember, Collection, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelSelectMenuInteraction } from 'discord.js';
import db from '../lib/db';
import { logger } from '../lib/logger';
import { ExtendedClient } from '../types';
import { performTicketClose } from '../lib/ticketClose';
import {
  addAssignedOnlineMembersToThread,
  buildTicketCreateMessage,
  buildTicketModal,
  getTicketCategoryEmoji,
  getTicketHandlerRoleIds,
  getTicketCategoryOptions,
  hasAnyTicketHandlerRole,
  removeOtherAssignedMembersFromThread,
} from '../lib/tickets';

type SupportedInteraction = ChatInputCommandInteraction | StringSelectMenuInteraction | ChannelSelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction;

// Stores pending announcement data between modal submit and channel select
const pendingAnnouncements = new Map<string, { type: string; title: string; content: string }>();

function isSupportedInteraction(interaction: Interaction): interaction is SupportedInteraction {
  return interaction.isChatInputCommand() || 
         interaction.isStringSelectMenu() || 
         interaction.isChannelSelectMenu() ||
         interaction.isButton() || 
         interaction.isModalSubmit();
}

export default async (client: ExtendedClient, interaction: Interaction) => {
  if (!isSupportedInteraction(interaction)) return;

  try {
    if (interaction.isChatInputCommand()) {
      try {
        const cmd = client.commands?.get(interaction.commandName);
        if (!cmd) {
          logger.warn('Command not found', {
            context: 'CommandHandler',
            userId: interaction.user.id,
            commandName: interaction.commandName
          });
          return interaction.reply({ content: 'Command not found', flags: [64] });
        }
        
        logger.debug(`Executing command: ${interaction.commandName}`, {
          context: 'CommandHandler',
          userId: interaction.user.id
        });
        
        await cmd.execute(interaction);
        logger.commandExecuted(interaction.commandName, interaction.user.id, true);
      } catch (err) {
        logger.interactionError('Error executing command', interaction, err);
        logger.commandExecuted(interaction.commandName, interaction.user.id, false);
        
        if (!interaction.replied) {
          try {
            await interaction.reply({
              content: '❌ An error occurred while executing this command.',
              flags: [64]
            });
          } catch (replyErr) {
            logger.error('Failed to send command error reply', {
              context: 'CommandHandler',
              error: replyErr
            });
          }
        }
      }
    }
    
    if (interaction.isChannelSelectMenu()) {
      try {
        if (interaction.customId.startsWith('changelog_channel_select_')) {
          try {
            const selectedChannelId = interaction.values[0];
            const customIdParts = interaction.customId.split('_');
            const type = customIdParts[3]; // 'changelog' or 'announcement'

            const guild = interaction.guild;
            if (!guild) {
              return interaction.reply({ content: '❌ Guild not found.', flags: [64] });
            }

            const channel = guild.channels.cache.get(selectedChannelId) as TextChannel;
            if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
              return interaction.reply({
                content: '❌ Selected channel is not a valid text or announcement channel.',
                flags: [64]
              });
            }

            // Retrieve pending announcement data stored at modal submit time
            const pending = pendingAnnouncements.get(interaction.user.id);
            pendingAnnouncements.delete(interaction.user.id);

            const title = pending?.title || 'Announcement';
            const content = pending?.content || 'No content provided';
            const resolvedType = pending?.type || type;

            // Send as plain unembedded message with full markdown support
            const icon = resolvedType === 'changelog' ? '📝' : '📢';
            const formattedMessage = `${icon} **${title}**\n\n${content}\n\n---\n*Posted by ${interaction.user.username} • <t:${Math.floor(Date.now() / 1000)}:f>*`;

            try {
              const sentMessage = await channel.send({ content: formattedMessage });

              const announcement = await db.createAnnouncement(
                guild.id,
                selectedChannelId,
                interaction.user.id,
                resolvedType,
                title,
                content,
                0
              );

              if (announcement) {
                await db.updateAnnouncementMessageId(announcement.id, sentMessage.id);
              }

              await interaction.reply({
                content: `✅ ${resolvedType === 'changelog' ? 'Changelog' : 'Announcement'} posted successfully to ${channel.toString()}!`,
                flags: [64]
              });

              logger.debug('Changelog/Announcement sent successfully', {
                context: 'ChangelogModalHandler',
                userId: interaction.user.id,
                type: resolvedType,
                channelId: selectedChannelId,
                announcementId: announcement?.id
              });
            } catch (sendErr) {
              logger.error('Failed to send announcement to channel', {
                context: 'ChangelogModalHandler',
                error: sendErr,
                channelId: selectedChannelId
              });
              await interaction.reply({
                content: '❌ Failed to post announcement. Ensure the bot has permission to send messages in that channel.',
                flags: [64]
              });
            }
          } catch (err) {
            logger.interactionError('Error processing channel selection for changelog', interaction, err);
            if (!interaction.replied) {
              await interaction.reply({
                content: '❌ An error occurred while posting your announcement.',
                flags: [64]
              });
            }
          }
        }
      } catch (err) {
        logger.interactionError('Error in channel select menu handler', interaction, err);
      }
    }

    if (interaction.isStringSelectMenu()) {
      try {
        if (interaction.customId === 'rr_select_1') {
          const values = interaction.values;
          const guild = interaction.guild;
          if (!guild) {
            logger.warn('Guild not found in interaction', {
              context: 'SelectMenuHandler',
              userId: interaction.user.id,
              customId: interaction.customId
            });
            return;
          }

          // Use Collection for O(1) lookups with partition capability
          const roleMapping = new Collection<string, string>([
            ['updates', '1057752910240419910'],
            ['status', '1057753007388901407'],
            ['notified', '1057740476280741998'],
            ['applications', '1241870908042252338'],
            ['minecraft_alerts', '1340728734533156994'],
            ['vps_alerts', '1436464615545638972']
          ]);

          // Extract all role IDs and get selected role IDs efficiently using Map
          const allRoleIds = roleMapping.map((id) => id);
          const selectedRoleIds = values.map((v) => roleMapping.get(v)).filter(Boolean) as string[];

          try {
            const member = interaction.member as any;
            
            // Use partition for efficient split: roles to add vs roles already owned
            const [rolesToAdd] = new Collection(selectedRoleIds.map((id) => [id, id]))
              .partition((roleId) => !member.roles.cache.has(roleId));

            // Add selected roles efficiently using batch operation
            for (const roleId of rolesToAdd.values()) {
              try {
                await member.roles.add(roleId).catch(() => null);
              } catch (roleErr) {
                logger.warn('Failed to add role to member', {
                  context: 'SelectMenuHandler',
                  error: roleErr,
                  userId: interaction.user.id,
                  roleId,
                  guildId: guild.id
                });
              }
            }

            // Build current roles list efficiently using filter and map
            const currentRoles = allRoleIds
              .filter((roleId) => member.roles.cache.has(roleId) || selectedRoleIds.includes(roleId))
              .map((roleId) => {
                const roleName = roleMapping.findKey((id) => id === roleId);
                return roleName ? roleName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';
              })
              .filter(Boolean)
              .join(', ');

            if (rolesToAdd.size > 0) {
              await interaction.reply({ 
                content: `✅ Roles added! You now have: ${currentRoles || 'no roles'}`, 
                flags: [64] 
              });
            } else {
              await interaction.reply({ 
                content: `ℹ️ You already have these roles. Your current roles: ${currentRoles || 'none'}`, 
                flags: [64] 
              });
            }
          } catch (err) {
            logger.interactionError('Error handling role selection', interaction, err);
            if (!interaction.replied) {
              await interaction.reply({ content: '❌ Failed to update roles.', flags: [64] });
            }
          }
        }
      } catch (err) {
        logger.interactionError('Error in select menu handler', interaction, err);
      }
    }
    
    if (interaction.isStringSelectMenu()) {
      try {
        // Handle category selection
        if (interaction.customId === 'ticket_category_select') {
          try {
            const category = interaction.values[0];
            const modal = buildTicketModal(category);

            await interaction.showModal(modal);
          } catch (err) {
            logger.interactionError('Error showing ticket modal', interaction, err);
            if (!interaction.replied) {
              try {
                await interaction.reply({
                  content: '❌ Failed to open ticket form.',
                  flags: [64]
                });
              } catch (replyErr) {
                logger.error('Failed to send modal error reply', {
                  context: 'SelectMenuHandler',
                  error: replyErr
                });
              }
            }
          }
          return;
        }
      } catch (err) {
        logger.interactionError('Error in select menu handler', interaction, err);
      }
    }

    if (interaction.isButton()) {
      try {
        // Handle new thread-based ticket creation
        if (interaction.customId === 'ticket_create') {
          try {
            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId('ticket_category_select')
              .setPlaceholder('Select a ticket category')
              .addOptions(getTicketCategoryOptions());

            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

            await interaction.reply({ components: [row], flags: [64] });
          } catch (err) {
            logger.interactionError('Error showing ticket category select', interaction, err);
            if (!interaction.replied) {
              try {
                await interaction.reply({
                  content: '❌ Failed to open ticket creation form.',
                  flags: [64]
                });
              } catch (replyErr) {
                logger.error('Failed to send select error reply', {
                  context: 'ButtonHandler',
                  error: replyErr
                });
              }
            }
          }
          return;
        }

        // Handle ticket button interactions
        if (interaction.customId === 'ticket_claim') {
          try {
            const ticketThread = interaction.channel as ThreadChannel;
            if (!ticketThread?.isThread()) {
              logger.warn('Button used outside thread context', {
                context: 'ButtonHandler',
                userId: interaction.user.id,
                customId: interaction.customId,
                channelId: interaction.channelId
              });
              return;
            }

            const ticket = await db.getTicket(ticketThread.id);
            if (!ticket) {
              logger.warn('Ticket not found in database', {
                context: 'ButtonHandler',
                threadId: ticketThread.id,
                userId: interaction.user.id
              });
              return interaction.reply({ content: '❌ Ticket not found.', flags: [64] });
            }

            const allowedRoleIds = await getTicketHandlerRoleIds(ticketThread.guild?.id || '', ticket.category);
            const member = interaction.member as GuildMember;
            if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator) && !hasAnyTicketHandlerRole(member, allowedRoleIds)) {
              return interaction.reply({ 
                content: '❌ Only the assigned team can claim this ticket.', 
                flags: [64] 
              });
            }

            if (ticket.claimedBy) {
              return interaction.reply({ 
                content: `❌ This ticket is already claimed by <@${ticket.claimedBy}>`, 
                flags: [64] 
              });
            }

            try {
              await db.claimTicket(ticketThread.id, interaction.user.id);

              const embed = new EmbedBuilder()
                .setColor(0x3256d9)
                .setDescription(`✋ Ticket claimed by ${interaction.user.toString()}`)
                .setTimestamp();

              await interaction.reply({ embeds: [embed] });

              // Update thread name to show claimed status
              const newName = `ticket-${ticket.category}-claimed`;
              await ticketThread.setName(newName).catch((err) => {
                logger.warn('Failed to update thread name', {
                  context: 'ButtonHandler',
                  error: err,
                  threadId: ticketThread.id
                });
              });

              // Remove other support staff from thread (only claimer stays)
              try {
                if (allowedRoleIds.length > 0 && ticketThread.guild) {
                  await removeOtherAssignedMembersFromThread(
                    ticketThread.guild,
                    ticketThread,
                    ticket.category,
                    interaction.user.id
                  );
                }
              } catch (memberErr) {
                logger.warn('Failed to manage ticket members after claim', {
                  context: 'ButtonHandler',
                  error: memberErr,
                  threadId: ticketThread.id
                });
              }
            } catch (err) {
              logger.interactionError('Error claiming ticket', interaction, err);
              if (!interaction.replied) {
                await interaction.reply({ content: '❌ Failed to claim ticket.', flags: [64] });
              }
            }
          } catch (err) {
            logger.interactionError('Error in ticket_claim handler', interaction, err);
          }
          return;
        }

        if (interaction.customId === 'ticket_unclaim') {
          try {
            const ticketThread = interaction.channel as ThreadChannel;
            if (!ticketThread?.isThread()) {
              logger.warn('Button used outside thread context', {
                context: 'ButtonHandler',
                userId: interaction.user.id,
                customId: interaction.customId,
                channelId: interaction.channelId
              });
              return;
            }

            const ticket = await db.getTicket(ticketThread.id);
            if (!ticket) {
              logger.warn('Ticket not found in database', {
                context: 'ButtonHandler',
                threadId: ticketThread.id,
                userId: interaction.user.id
              });
              return interaction.reply({ content: '❌ Ticket not found.', flags: [64] });
            }

            if (!ticket.claimedBy) {
              return interaction.reply({ content: '❌ This ticket is not claimed.', flags: [64] });
            }

            if (ticket.claimedBy !== interaction.user.id && !interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
              return interaction.reply({ 
                content: '❌ Only the person who claimed this ticket can unclaim it.', 
                flags: [64] 
              });
            }

            try {
              await db.unclaimTicket(ticketThread.id);

              const embed = new EmbedBuilder()
                .setColor(0x3256d9)
                .setDescription(`🔓 Ticket unclaimed by ${interaction.user.toString()}`)
                .setTimestamp();

              await interaction.reply({ embeds: [embed] });

              // Update thread name to remove claimed status
              const updatedTicket = await db.getTicket(ticketThread.id);
              const newName = `ticket-${updatedTicket?.category || 'support'}`;
              await ticketThread.setName(newName).catch((err) => {
                logger.warn('Failed to update thread name', {
                  context: 'ButtonHandler',
                  error: err,
                  threadId: ticketThread.id
                });
              });

              // Re-add online support staff members to thread
              try {
                if (ticketThread.guild) {
                  await addAssignedOnlineMembersToThread(ticketThread.guild, ticketThread, ticket.category);
                }
              } catch (memberErr) {
                logger.warn('Failed to manage ticket members after unclaim', {
                  context: 'ButtonHandler',
                  error: memberErr,
                  threadId: ticketThread.id
                });
              }
            } catch (err) {
              logger.interactionError('Error unclaiming ticket', interaction, err);
              if (!interaction.replied) {
                await interaction.reply({ content: '❌ Failed to unclaim ticket.', flags: [64] });
              }
            }
          } catch (err) {
            logger.interactionError('Error in ticket_unclaim handler', interaction, err);
          }
          return;
        }

        if (interaction.customId === 'ticket_close') {
          try {
            const ticketThread = interaction.channel as ThreadChannel;
            if (!ticketThread?.isThread()) {
              logger.warn('Button used outside thread context', {
                context: 'ButtonHandler',
                userId: interaction.user.id,
                customId: interaction.customId,
                channelId: interaction.channelId
              });
              return;
            }

            // Show modal for close reason
            const modal = new ModalBuilder()
              .setCustomId('ticket_close_modal')
              .setTitle('Close Ticket');

            const reasonInput = new TextInputBuilder()
              .setCustomId('close_reason')
              .setLabel('Reason for closing')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Enter the reason for closing this ticket...')
              .setRequired(true)
              .setMinLength(5)
              .setMaxLength(500);

            const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
            modal.addComponents(actionRow);

            await interaction.showModal(modal);
          } catch (err) {
            logger.interactionError('Error showing ticket close modal', interaction, err);
            if (!interaction.replied) {
              try {
                await interaction.reply({
                  content: '❌ Failed to open close form.',
                  flags: [64]
                });
              } catch (replyErr) {
                logger.error('Failed to send modal error reply', {
                  context: 'ButtonHandler',
                  error: replyErr
                });
              }
            }
          }
          return;
        }
      } catch (err) {
        logger.interactionError('Error in button handler', interaction, err);
      }
    }

    if (interaction.isModalSubmit()) {
      try {
        // Handle new thread-based ticket creation with category from modal customId
        if (interaction.customId.startsWith('ticket_modal_')) {
          try {
            const category = interaction.customId.replace('ticket_modal_', '');
            const createMsg = buildTicketCreateMessage(interaction, category);
            const user = interaction.user;
            const guild = interaction.guild;

            if (!guild) {
              logger.warn('Guild not found in modal interaction', {
                context: 'ModalHandler',
                userId: user.id
              });
              return;
            }

            const validCategories = ['general', 'tech', 'game', 'vps', 'billing', 'bug', 'feature', 'sales'];
            if (!validCategories.includes(category)) {
              return interaction.reply({ 
                content: `❌ Invalid category.`, 
                flags: [64] 
              });
            }

            try {
              await interaction.deferReply({ flags: [64] });

              const config = await db.getOrCreateGuildConfig(guild.id);
              const ticketChannelId = config?.ticketChannelId;

              if (!ticketChannelId) {
                logger.warn('Ticket channel not configured', {
                  context: 'ModalHandler',
                  guildId: guild.id,
                  userId: user.id
                });
                return interaction.editReply({ 
                  content: '❌ Ticket channel is not configured. Please contact an administrator to use `/config set`.' 
                });
              }

              const ticketChannel = guild.channels.cache.get(ticketChannelId) as TextChannel;
              if (!ticketChannel || !ticketChannel.isTextBased()) {
                logger.error('Ticket channel not found or not text-based', {
                  context: 'ModalHandler',
                  guildId: guild.id,
                  channelId: ticketChannelId
                });
                return interaction.editReply({ 
                  content: '❌ Ticket channel not found or is not a text channel.' 
                });
              }

              // Create thread in the ticket channel
              const threadName = `ticket-${category}-${user.username}-${Date.now()}`.substring(0, 100);
              let thread: ThreadChannel;
              
              try {
                thread = await ticketChannel.threads.create({
                  name: threadName,
                  autoArchiveDuration: 60,
                  type: ChannelType.PrivateThread,
                  reason: `Support ticket created by ${user.tag}`
                });
              } catch (threadErr) {
                logger.error('Failed to create thread', {
                  context: 'ModalHandler',
                  error: threadErr,
                  guildId: guild.id,
                  userId: user.id,
                  category
                });
                return interaction.editReply({ 
                  content: '❌ Failed to create ticket thread. Please try again later.' 
                });
              }

              // Add ticket creator and support roles to thread
              try {
                // Add the ticket creator
                await thread.members.add(user.id);

                // Grant the ticket creator SendMessagesInThreads on the parent channel
                // so they can continue sending messages in the private thread
                try {
                  await ticketChannel.permissionOverwrites.create(user.id, {
                    SendMessagesInThreads: true,
                    ViewChannel: true,
                  }, { reason: `Ticket thread created for ${user.tag}` });
                } catch (permErr) {
                  logger.warn('Failed to set permission override for ticket creator', {
                    context: 'ModalHandler',
                    error: permErr,
                    threadId: thread.id,
                    userId: user.id
                  });
                }

                // Add online members from the team assigned to this ticket category
                await addAssignedOnlineMembersToThread(guild, thread, category);
              } catch (memberErr) {
                logger.warn('Failed to add members to thread', {
                  context: 'ModalHandler',
                  error: memberErr,
                  threadId: thread.id,
                  userId: user.id
                });
              }

              // Create ticket info embed
              const ticketEmbed = new EmbedBuilder()
                .setColor(0x3256d9)
                .setTitle(`${getTicketCategoryEmoji(category)} ${category.charAt(0).toUpperCase() + category.slice(1)} Support`)
                .setDescription(createMsg)
                .addFields(
                  { name: 'Created by:', value: user.toString(), inline: true },
                  { name: 'Status:', value: '🟢 Open', inline: true },
                  { name: 'Category:', value: category, inline: true }
                )
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: `Ticket ID: ${thread.id} | © Copyright 2024 - 2026 NodeByte LTD` });

              // Create control buttons
              const claimButton = new ButtonBuilder()
                .setCustomId('ticket_claim')
                .setLabel('Claim')
                .setEmoji('✋')
                .setStyle(ButtonStyle.Success);

              const unclaimButton = new ButtonBuilder()
                .setCustomId('ticket_unclaim')
                .setLabel('Unclaim')
                .setEmoji('🔓')
                .setStyle(ButtonStyle.Secondary);

              const closeButton = new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Close')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger);

              const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claimButton, unclaimButton, closeButton);

              // Send message to thread
              try {
                await thread.send({ content: `${user.toString()}, your support ticket has been created. Our support staff will review your issue shortly.`, embeds: [ticketEmbed], components: [row] });
              } catch (sendErr) {
                logger.error('Failed to send initial messages to ticket thread', {
                  context: 'ModalHandler',
                  error: sendErr,
                  threadId: thread.id
                });
              }

              // Save ticket to database
              try {
                await db.createTicket(guild.id, thread.id, user.id, category, createMsg);
              } catch (dbErr) {
                logger.error('Failed to save ticket to database', {
                  context: 'ModalHandler',
                  error: dbErr,
                  threadId: thread.id,
                  guildId: guild.id
                });
              }

              logger.info('Ticket created successfully', {
                context: 'ModalHandler',
                threadId: thread.id,
                userId: user.id,
                guildId: guild.id,
                category
              });

              // Send ticket creation notification to logs channel with support role pings
              try {
                const ticketLogsChannelId = config?.ticketLogChannelId;
                if (ticketLogsChannelId) {
                  const logsChannel = guild.channels.cache.get(ticketLogsChannelId) as TextChannel;
                  if (logsChannel && 'send' in logsChannel) {
                    const handlerRoleIds = await getTicketHandlerRoleIds(guild.id, category);
                    const pingText = (handlerRoleIds.length > 0 && !config?.disableSupportNotifications)
                      ? handlerRoleIds.map(roleId => `<@&${roleId}>`).join(' ')
                      : '';

                    const ticketCreatedEmbed = new EmbedBuilder()
                      .setColor(0x3256d9)
                      .setTitle('🎫 Ticket Created')
                      .addFields(
                        { name: 'Category', value: category, inline: true },
                        { name: 'Created By', value: user.toString(), inline: true },
                        { name: 'Thread', value: thread.toString(), inline: true },
                        { name: 'Thread ID', value: thread.id, inline: false }
                      )
                      .setThumbnail(user.displayAvatarURL())
                      .setTimestamp();

                    try {
                      await logsChannel.send({ content: pingText, embeds: [ticketCreatedEmbed] });
                    } catch (logSendErr) {
                      logger.warn('Failed to send ticket creation log', {
                        context: 'ModalHandler',
                        error: logSendErr,
                        logsChannelId: ticketLogsChannelId
                      });
                    }
                  }
                }
              } catch (logsErr) {
                logger.warn('Error sending ticket creation log', {
                  context: 'ModalHandler',
                  error: logsErr
                });
              }

              await interaction.editReply({ 
                content: `✅ Your ticket has been created! Please check ${thread.toString()} for assistance.` 
              });

              // Send DM confirmation
              try {
                const dmEmbed = new EmbedBuilder()
                  .setColor(0x3256d9)
                  .setTitle('🎫 Ticket Created')
                  .setDescription(`Your **${category}** support ticket has been created!`)
                  .addFields(
                    { name: 'Category:', value: category, inline: true },
                    { name: 'Status:', value: '🟢 Open', inline: true },
                    { name: 'Ticket Channel:', value: thread.toString(), inline: false }
                  )
                  .setTimestamp();

                await user.send({ embeds: [dmEmbed] });
              } catch (dmErr) {
                logger.warn('Could not send DM to user', {
                  context: 'ModalHandler',
                  error: dmErr,
                  userId: user.id
                });
              }
            } catch (err) {
              logger.interactionError('Error creating ticket', interaction, err);
              try {
                await interaction.editReply({ 
                  content: '❌ Failed to create ticket. Please try again later or contact an administrator.' 
                });
              } catch (editErr) {
                logger.error('Failed to send error reply', {
                  context: 'ModalHandler',
                  error: editErr
                });
              }
            }
          } catch (err) {
            logger.interactionError('Error in ticket creation modal', interaction, err);
          }
          return;
        }

        if (interaction.customId === 'ticket_close_modal') {
          try {
            const ticketThread = interaction.channel as ThreadChannel;
            if (!ticketThread?.isThread()) {
              logger.warn('Modal used outside thread context', {
                context: 'ModalHandler',
                userId: interaction.user.id,
                customId: interaction.customId,
                channelId: interaction.channelId
              });
              return;
            }

            const closeReason = interaction.fields.getTextInputValue('close_reason');

            try {
              await interaction.reply({ content: '🔒 Closing ticket and generating transcript...', flags: [64] });
            } catch (replyErr) {
              logger.error('Failed to send closing message', { context: 'ModalHandler', error: replyErr });
            }

            const result = await performTicketClose(ticketThread, interaction.user, closeReason, interaction.client);

            if (!result.success) {
              await interaction.followUp({ content: result.error ?? '❌ Failed to close ticket.', flags: [64] }).catch(() => null);
            }
          } catch (err) {
            logger.interactionError('Error in ticket close modal handler', interaction, err);
            await interaction.followUp({ content: '❌ An error occurred while closing the ticket.', flags: [64] }).catch(() => null);
          }
          return;
        }

      // Handle changelog/announcement creation modal submission
      if (interaction.customId.startsWith('changelog_') && interaction.customId.includes('_step1_')) {
        try {
          const parts = interaction.customId.split('_');
          const type = parts[1]; // 'changelog' or 'announcement'
          const userId = parts[3]; // User ID from customId
          
          if (interaction.user.id !== userId) {
            return interaction.reply({
              content: '❌ You are not authorized to submit this form.',
              flags: [64]
            });
          }

          const title = interaction.fields.getTextInputValue('changelog_title');
          const content = interaction.fields.getTextInputValue('changelog_content');
          const guild = interaction.guild;

          if (!guild) {
            logger.warn('Guild not found in modal interaction', {
              context: 'ChangelogModalHandler',
              userId: interaction.user.id
            });
            return interaction.reply({ content: '❌ Guild not found.', flags: [64] });
          }

          // Store pending data so the channel select handler can retrieve it reliably
          pendingAnnouncements.set(interaction.user.id, { type, title, content });

          const ChannelSelect = new ChannelSelectMenuBuilder()
            .setCustomId(`changelog_channel_select_${type}_${Date.now()}`)
            .setPlaceholder('Select channel to send announcement')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

          const row = new ActionRowBuilder<any>().addComponents(ChannelSelect);

          const icon = type === 'changelog' ? '📝' : '📢';
          const previewContent = content.length > 500 ? content.substring(0, 500) + '...' : content;

          await interaction.reply({
            content: `**${type === 'changelog' ? 'Changelog' : 'Announcement'} Preview:**\n\n${icon} **${title}**\n\n${previewContent}\n\n---\nSelect a channel to post this:`,
            components: [row],
            flags: [64]
          });

          logger.debug('Changelog modal submitted, waiting for channel selection', {
            context: 'ChangelogModalHandler',
            userId: interaction.user.id,
            type
          });
        } catch (err) {
          logger.interactionError('Error processing changelog modal', interaction, err);
          if (!interaction.replied) {
            try {
              await interaction.reply({
                content: '❌ An error occurred while processing your announcement.',
                flags: [64]
              });
            } catch (replyErr) {
              logger.error('Failed to send error reply', {
                context: 'ChangelogModalHandler',
                error: replyErr
              });
            }
          }
        }
        return;
      }
      } catch (err) {
        logger.interactionError('Error in modal submit handler', interaction, err);
      }
    }
  } catch (err) {
    logger.interactionError('Uncaught error in interaction handler', interaction, err);
    if (interaction.isRepliable()) {
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ An unexpected error occurred.', flags: [64] });
        } else if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({ content: '❌ An unexpected error occurred.' });
        } else {
          await interaction.followUp({ content: '❌ An unexpected error occurred.', flags: [64] });
        }
      } catch (replyErr) {
        logger.error('Failed to send final error reply', {
          context: 'InteractionHandler',
          error: replyErr
        });
      }
    }
  }
};
