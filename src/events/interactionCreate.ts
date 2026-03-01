import { Client, Interaction, EmbedBuilder, TextChannel, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder, Message, ModalBuilder, TextInputBuilder, TextInputStyle, ThreadChannel, PermissionsBitField, ChatInputCommandInteraction, StringSelectMenuInteraction, ButtonInteraction, ModalSubmitInteraction, GuildMember, Collection } from 'discord.js';
import db from '../lib/db';
import { logger } from '../lib/logger';
import { ExtendedClient } from '../types';
import { generateTranscriptHTML, generateTranscriptSlug } from '../lib/transcriptGenerator';
import { createTranscriptUrl } from '../lib/transcriptServer';

type SupportedInteraction = ChatInputCommandInteraction | StringSelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction;

function isSupportedInteraction(interaction: Interaction): interaction is SupportedInteraction {
  return interaction.isChatInputCommand() || 
         interaction.isStringSelectMenu() || 
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
    
    if (interaction.isButton()) {
      try {
        // Handle new thread-based ticket creation
        if (interaction.customId === 'ticket_create') {
          try {
            const modal = new ModalBuilder()
              .setCustomId('ticket_create_modal')
              .setTitle('Create a Support Ticket');

            const categoryInput = new TextInputBuilder()
              .setCustomId('ticket_category_input')
              .setLabel('Category')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('general, tech, game, or vps')
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(20);

            const descriptionInput = new TextInputBuilder()
              .setCustomId('ticket_description_input')
              .setLabel('Brief Description of Your Issue')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Please describe your issue...')
              .setRequired(true)
              .setMinLength(10)
              .setMaxLength(500);

            const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(categoryInput);
            const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
            modal.addComponents(row1, row2);

            await interaction.showModal(modal);
          } catch (err) {
            logger.interactionError('Error showing ticket creation modal', interaction, err);
            if (!interaction.replied) {
              try {
                await interaction.reply({
                  content: '❌ Failed to open ticket creation form.',
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
        // Handle new thread-based ticket creation
        if (interaction.customId === 'ticket_create_modal') {
          try {
            const category = interaction.fields.getTextInputValue('ticket_category_input').toLowerCase().trim();
            const description = interaction.fields.getTextInputValue('ticket_description_input');
            const user = interaction.user;
            const guild = interaction.guild;

            if (!guild) {
              logger.warn('Guild not found in modal interaction', {
                context: 'ModalHandler',
                userId: user.id
              });
              return;
            }

            const validCategories = ['general', 'tech', 'game', 'vps'];
            if (!validCategories.includes(category)) {
              return interaction.reply({ 
                content: `❌ Invalid category. Please use one of: ${validCategories.join(', ')}`, 
                flags: [64] 
              });
            }

            const categoryEmojis: Record<string, string> = {
              general: '📋',
              tech: '🖥️',
              game: '🎮',
              vps: '🔧'
            };

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

              // Add support role and user to thread
              try {
                await thread.members.add(user.id);
              } catch (memberErr) {
                logger.warn('Failed to add member to thread', {
                  context: 'ModalHandler',
                  error: memberErr,
                  threadId: thread.id,
                  userId: user.id
                });
              }

              // Create ticket info embed
              const ticketEmbed = new EmbedBuilder()
                .setColor(0x3256d9)
                .setTitle(`${categoryEmojis[category]} ${category.charAt(0).toUpperCase() + category.slice(1)} Support`)
                .setDescription(description)
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
                const mentionSupportRole = (!config?.disableSupportNotifications && config?.supportRoleId) 
                  ? `<@&${config.supportRoleId}> — ` 
                  : '';
                await thread.send({ content: `${mentionSupportRole}New support ticket!`, embeds: [ticketEmbed], components: [row] });
                await thread.send(`${user.toString()}, please wait for the support team to respond. They will assist you shortly!`);
              } catch (sendErr) {
                logger.error('Failed to send initial messages to ticket thread', {
                  context: 'ModalHandler',
                  error: sendErr,
                  threadId: thread.id
                });
              }

              // Save ticket to database
              try {
                await db.createTicket(guild.id, thread.id, user.id, category);
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

              // Send ticket creation notification to logs channel
              try {
                const ticketLogsChannelId = config?.ticketLogChannelId;
                if (ticketLogsChannelId) {
                  const logsChannel = guild.channels.cache.get(ticketLogsChannelId) as TextChannel;
                  if (logsChannel && 'send' in logsChannel) {
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
                      await logsChannel.send({ embeds: [ticketCreatedEmbed] });
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

          const ticket = await db.getTicket(ticketThread.id);
          if (!ticket) {
            logger.warn('Ticket not found in database for close modal', {
              context: 'ModalHandler',
              threadId: ticketThread.id,
              userId: interaction.user.id
            });
            return interaction.reply({ content: '❌ Ticket not found.', flags: [64] });
          }

          const closedBy = interaction.user;
          const closeReason = interaction.fields.getTextInputValue('close_reason');

          try {
            await interaction.reply({ content: '🔒 Closing ticket and generating transcript...', flags: [64] });
          } catch (replyErr) {
            logger.error('Failed to send closing message', {
              context: 'ModalHandler',
              error: replyErr
            });
          }

          try {
            // Get guild config
            const config = await db.getGuildConfig(ticketThread.guild!.id);
            const guild = ticketThread.guild!;
            const guildName = guild.name;

            // Generate HTML transcript
            let htmlContent = '';
            let transcriptSlug = '';
            try {
              const messages = await ticketThread.messages.fetch({ limit: 100 });
              const sortedMessages = Array.from(messages.values());

              htmlContent = await generateTranscriptHTML(
                ticketThread,
                guildName,
                ticketThread.name,
                sortedMessages,
                closedBy.tag,
                closeReason,
                ticket.category
              );

              transcriptSlug = generateTranscriptSlug();

              // Save transcript to database
              await db.createTranscript(
                guild.id,
                ticketThread.id,
                ticketThread.id,
                ticket.userId,
                ticket.category,
                transcriptSlug,
                htmlContent
              );

              logger.debug('Ticket HTML transcript generated and saved', {
                context: 'ModalHandler',
                threadId: ticketThread.id,
                slug: transcriptSlug
              });
            } catch (transcriptErr) {
              logger.error('Failed to generate HTML transcript', {
                context: 'ModalHandler',
                error: transcriptErr,
                threadId: ticketThread.id
              });
            }

            // Send transcript link to ticket logs channel
            try {
              const ticketLogsChannelId = config?.ticketLogChannelId;
              if (ticketLogsChannelId) {
                const logsChannel = ticketThread.guild?.channels.cache.get(ticketLogsChannelId) as TextChannel;
                if (logsChannel && 'send' in logsChannel) {
                  const logEmbed = new EmbedBuilder()
                    .setColor(0x3256d9)
                    .setTitle('🔒 Ticket Closed')
                    .addFields(
                      { name: 'Ticket', value: ticketThread.name, inline: true },
                      { name: 'Category', value: ticket.category, inline: true },
                      { name: 'Closed By', value: closedBy.toString(), inline: true },
                      { name: 'Thread ID', value: ticketThread.id, inline: true },
                      { name: 'Close Reason', value: closeReason, inline: false }
                    )
                    .setThumbnail(closedBy.displayAvatarURL())
                    .setTimestamp();

                  if (transcriptSlug) {
                    const transcriptUrl = createTranscriptUrl(transcriptSlug);
                    logEmbed.addFields({
                      name: 'Transcript Link',
                      value: `[View Transcript](${transcriptUrl})`,
                      inline: false
                    });
                  }

                  try {
                    await logsChannel.send({ embeds: [logEmbed] });
                  } catch (logSendErr) {
                    logger.error('Failed to send logs to ticket logs channel', {
                      context: 'ModalHandler',
                      error: logSendErr,
                      logsChannelId: ticketLogsChannelId
                    });
                  }
                }
              }
            } catch (logsErr) {
              logger.warn('Error processing ticket logs channel', {
                context: 'ModalHandler',
                error: logsErr
              });
            }

            // DM transcript link to ticket creator
            try {
              const creatorUser = await interaction.client.users.fetch(ticket.userId);
              const dmEmbed = new EmbedBuilder()
                .setColor(0x3256d9)
                .setTitle('🎫 Your Ticket Has Been Closed')
                .setDescription(`Your **${ticket.category}** support ticket has been closed.`)
                .addFields(
                  { name: 'Closed By:', value: closedBy.tag, inline: true },
                  { name: 'Reason:', value: closeReason, inline: false }
                )
                .setTimestamp();

              if (transcriptSlug) {
                const transcriptUrl = createTranscriptUrl(transcriptSlug);
                dmEmbed.addFields({
                  name: '📄 View Your Transcript',
                  value: `[Click here to view transcript](${transcriptUrl})`,
                  inline: false
                });
              }

              try {
                await creatorUser.send({ embeds: [dmEmbed] });
              } catch (dmSendErr) {
                logger.warn('Failed to send DM to user after ticket close', {
                  context: 'ModalHandler',
                  error: dmSendErr,
                  userId: ticket.userId
                });
              }
            } catch (userFetchErr) {
              logger.warn('Failed to fetch ticket creator for DM', {
                context: 'ModalHandler',
                error: userFetchErr,
                userId: ticket.userId
              });
            }

            // Close and archive the thread
            try {
              await db.closeTicket(ticketThread.id, closedBy.id, closeReason);
              await ticketThread.send({ content: `🔒 Ticket closed by ${closedBy.toString()}. This thread will be archived in 5 seconds.` });
              
              logger.info('Ticket closed successfully', {
                context: 'ModalHandler',
                threadId: ticketThread.id,
                closedBy: closedBy.id,
                guildId: ticketThread.guild?.id
              });

              setTimeout(async () => {
                try {
                  await ticketThread.setArchived(true);
                  logger.debug('Ticket thread archived', {
                    context: 'ModalHandler',
                    threadId: ticketThread.id
                  });
                } catch (archiveErr) {
                  logger.error('Failed to archive ticket thread', {
                    context: 'ModalHandler',
                    error: archiveErr,
                    threadId: ticketThread.id
                  });
                }
              }, 5000);
            } catch (closeErr) {
              logger.error('Failed to close ticket', {
                context: 'ModalHandler',
                error: closeErr,
                threadId: ticketThread.id
              });
              try {
                await interaction.followUp({ content: '❌ Failed to close ticket.', flags: [64] });
              } catch (followUpErr) {
                logger.error('Failed to send close failure followup', {
                  context: 'ModalHandler',
                  error: followUpErr
                });
              }
            }
          } catch (err) {
            logger.interactionError('Error processing ticket close modal', interaction, err);
            try {
              await interaction.followUp({ content: '❌ An error occurred while closing the ticket.', flags: [64] });
            } catch (followUpErr) {
              logger.error('Failed to send error followup', {
                context: 'ModalHandler',
                error: followUpErr
              });
            }
          }
        } catch (err) {
          logger.interactionError('Error in ticket close modal handler', interaction, err);
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
