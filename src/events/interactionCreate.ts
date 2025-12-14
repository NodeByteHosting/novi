import { Client, Interaction, EmbedBuilder, TextChannel, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder, Message, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export default async (client: Client & { commands?: any }, interaction: Interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return;

  try {
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands?.get(interaction.commandName);
      if (!cmd) return interaction.reply({ content: 'Command not found', flags: [64] });
      await cmd.execute(interaction);
    }
    
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'rr_select_1') {
        const values = interaction.values;
        const guild = interaction.guild;
        if (!guild) return;

        // Map role values to actual Discord role IDs
        const mapping: Record<string, string> = {
          updates: '1057752910240419910',
          status: '1057753007388901407',
          notified: '1057740476280741998',
          applications: '1241870908042252338',
          minecraft_alerts: '1340728734533156994',
          vps_alerts: '1436464615545638972'
        };

        const allRoleIds = Object.values(mapping);
        const selectedRoleIds = values.map((v) => mapping[v]).filter(Boolean) as string[];

        try {
          const member = interaction.member as any;
          
          // Only add roles, never remove them (users must manually deselect to remove)
          const rolesToAdd = selectedRoleIds.filter(roleId => !member.roles.cache.has(roleId));

          // Add selected roles
          for (const roleId of rolesToAdd) {
            await member.roles.add(roleId).catch(() => null);
          }

          // Build a list of current roles for feedback
          const currentRoles = allRoleIds
            .filter(roleId => member.roles.cache.has(roleId) || rolesToAdd.includes(roleId))
            .map(roleId => {
              const roleName = Object.keys(mapping).find(k => mapping[k] === roleId);
              return roleName ? roleName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';
            })
            .filter(Boolean)
            .join(', ');

          if (rolesToAdd.length > 0) {
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
          console.error(err);
          await interaction.reply({ content: '❌ Failed to update roles.', flags: [64] });
        }
      } else if (interaction.customId === 'ticket_category') {
        // Handle ticket creation
        const category = interaction.values[0];
        const user = interaction.user;

        const categoryNames: Record<string, string> = {
          general: '📋 General Support',
          tech: '🖥️ Tech Support',
          game: '🎮 Game Support',
          vps: '🔧 VPS Support'
        };

        const categoryName = categoryNames[category] || 'Support';

        try {
          // Get the ticket category ID from environment
          const ticketCategoryId = process.env.TICKET_CATEGORY_ID;
          if (!ticketCategoryId) {
            return interaction.reply({ 
              content: '❌ Ticket category is not configured. Please ask an administrator to set TICKET_CATEGORY_ID in the .env file.', 
              flags: [64] 
            });
          }

          // Find the guild that has the ticket category
          let guild: any = null;
          let ticketCategory: any = null;
          
          for (const [guildId, g] of client.guilds.cache) {
            const category = g.channels.cache.get(ticketCategoryId);
            if (category) {
              guild = g;
              ticketCategory = category;
              break;
            }
          }

          if (!guild || !ticketCategory) {
            return interaction.reply({ 
              content: '❌ Ticket category not found. Please contact an administrator.', 
              flags: [64] 
            });
          }

          // Create a ticket channel
          const ticketChannel = await guild.channels.create({
            name: `ticket-${user.username}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            parent: ticketCategoryId,
            type: ChannelType.GuildText,
            permissionOverwrites: [
              {
                id: guild.id,
                deny: ['ViewChannel']
              },
              {
                id: user.id,
                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
              },
              {
                id: client.user!.id,
                allow: ['ViewChannel', 'SendMessages', 'ManageChannels', 'ReadMessageHistory']
              }
            ],
            reason: `Support ticket created by ${user.tag}`
          });

          // Add support role permissions if configured
          const supportRoleId = process.env.SUPPORT_ROLE_ID;
          if (supportRoleId) {
            await ticketChannel.permissionOverwrites.create(supportRoleId, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true
            });
          }

          // Create ticket embed
          const ticketEmbed = new EmbedBuilder()
            .setColor(0x3256d9)
            .setTitle(`🎫 ${categoryName}`)
            .setDescription(`Support ticket created by ${user.toString()}`)
            .addFields(
              { name: 'User:', value: `${user.tag} (${user.id})`, inline: true },
              { name: 'Category:', value: categoryName, inline: true },
              { name: 'Status:', value: '🟢 Open', inline: true }
            )
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: `Ticket ID: ${ticketChannel.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

          // Send message in ticket channel
          const pingMessage = supportRoleId 
            ? `<@&${supportRoleId}> - New support ticket!` 
            : 'New support ticket!';

          // Create control buttons for support agents
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

          const addUserButton = new ButtonBuilder()
            .setCustomId('ticket_add_user')
            .setLabel('Add User')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Primary);

          const removeUserButton = new ButtonBuilder()
            .setCustomId('ticket_remove_user')
            .setLabel('Remove User')
            .setEmoji('➖')
            .setStyle(ButtonStyle.Primary);

          const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(claimButton, unclaimButton, closeButton);
          const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(addUserButton, removeUserButton);

          await ticketChannel.send({ content: pingMessage, embeds: [ticketEmbed], components: [row1, row2] });
          await ticketChannel.send(`${user.toString()}, please describe your issue and our support team will assist you shortly.`);

          // Confirm to user
          await interaction.reply({ 
            content: `✅ Your ticket has been created! Please check ${ticketChannel.toString()} for assistance.`, 
            flags: [64] 
          });

          // Send confirmation in DM
          try {
            await user.send(`✅ Your **${categoryName}** ticket has been created! You can view it here: https://discord.com/channels/${guild.id}/${ticketChannel.id}`);
          } catch (err) {
            console.error('Could not DM user', err);
          }

        } catch (err) {
          console.error('Failed to create ticket', err);
          await interaction.reply({ 
            content: '❌ Failed to create ticket. Please try again later or contact an administrator.', 
            flags: [64] 
          });
        }
      }
    }
    
    if (interaction.isButton()) {
      // Handle ticket button interactions
      if (interaction.customId === 'ticket_claim') {
        const ticketChannel = interaction.channel;
        if (!ticketChannel?.isTextBased()) return;

        const claimedBy = interaction.user;
        
        const embed = new EmbedBuilder()
          .setColor(0x3256d9)
          .setDescription(`✋ Ticket claimed by ${claimedBy.toString()}`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else if (interaction.customId === 'ticket_unclaim') {
        const ticketChannel = interaction.channel;
        if (!ticketChannel?.isTextBased()) return;

        const unclaimedBy = interaction.user;
        
        const embed = new EmbedBuilder()
          .setColor(0x3256d9)
          .setDescription(`🔓 Ticket unclaimed by ${unclaimedBy.toString()}`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else if (interaction.customId === 'ticket_close') {
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
        return;
      } else if (interaction.customId === 'ticket_add_user') {
        await interaction.reply({ 
          content: '➕ To add a user to this ticket, use Discord\'s thread settings or mention them in the thread.', 
          flags: [64] 
        });
      } else if (interaction.customId === 'ticket_remove_user') {
        await interaction.reply({ 
          content: '➖ To remove a user from this ticket, use Discord\'s thread settings.', 
          flags: [64] 
        });
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'ticket_close_modal') {
        const ticketChannel = interaction.channel as TextChannel;
        if (!ticketChannel?.isTextBased() || ticketChannel.isDMBased()) return;

        const closedBy = interaction.user;
        const closeReason = interaction.fields.getTextInputValue('close_reason');

        await interaction.reply({ content: '🔒 Closing ticket and generating transcript...', flags: [64] });

        try {
          // Generate transcript
          const messages = await ticketChannel.messages.fetch({ limit: 100 });
          const sortedMessages = Array.from(messages.values()).reverse();

          let transcript = `# Ticket Transcript: ${ticketChannel.name}\n`;
          transcript += `## Closed by: ${closedBy.tag}\n`;
          transcript += `## Date: ${new Date().toLocaleString()}\n\n`;
          transcript += `---\n\n`;

          for (const msg of sortedMessages) {
            const timestamp = (msg as Message).createdAt.toLocaleString();
            transcript += `**${(msg as Message).author.tag}** (${timestamp})\n`;
            if ((msg as Message).content) transcript += `${(msg as Message).content}\n`;
            if ((msg as Message).embeds.length > 0) {
              for (const embed of (msg as Message).embeds) {
                transcript += `[Embed: ${embed.title || 'No title'}]\n`;
                if (embed.description) transcript += `${embed.description}\n`;
              }
            }
            transcript += `\n`;
          }

          // Find ticket creator from thread name or first message
          let ticketCreator = null;
          for (const msg of sortedMessages) {
            if ((msg as Message).mentions.users.size > 0) {
              ticketCreator = (msg as Message).mentions.users.first();
              break;
            }
          }

          // Send transcript to ticket logs channel
          const ticketLogsChannelId = process.env.TICKET_LOG_CHANNEL_ID;
          if (ticketLogsChannelId) {
            const logsChannel = ticketChannel.guild?.channels.cache.get(ticketLogsChannelId) as TextChannel;
            if (logsChannel && 'send' in logsChannel) {
              const logEmbed = new EmbedBuilder()
                .setColor(0x3256d9)
                .setTitle('🔒 Ticket Closed')
                .addFields(
                  { name: 'Ticket', value: ticketChannel.name, inline: true },
                  { name: 'Closed By', value: closedBy.toString(), inline: true },
                  { name: 'Channel ID', value: ticketChannel.id, inline: true },
                  { name: 'Close Reason', value: closeReason, inline: false }
                )
                .setTimestamp();

              await logsChannel.send({ embeds: [logEmbed] });

              // Send transcript as file if it's too long
              if (transcript.length > 2000) {
                const buffer = Buffer.from(transcript, 'utf-8');
                await logsChannel.send({ 
                  content: `📄 Transcript for **${ticketChannel.name}**`,
                  files: [{ attachment: buffer, name: `transcript-${ticketChannel.id}.txt` }]
                });
              } else {
                await logsChannel.send({ content: `📄 **Transcript:**\n\`\`\`\n${transcript}\n\`\`\`` });
              }
            }
          }

          // DM transcript to ticket creator
          if (ticketCreator) {
            try {
              const dmEmbed = new EmbedBuilder()
                .setColor(0x3256d9)
                .setTitle('🎫 Your Ticket Has Been Closed')
                .setDescription(`Your ticket **${ticketChannel.name}** has been closed by ${closedBy.tag}.`)
                .setTimestamp();

              await ticketCreator.send({ embeds: [dmEmbed] });

              if (transcript.length > 2000) {
                const buffer = Buffer.from(transcript, 'utf-8');
                await ticketCreator.send({ 
                  content: '📄 Here is your ticket transcript:',
                  files: [{ attachment: buffer, name: `transcript-${ticketChannel.id}.txt` }]
                });
              } else {
                await ticketCreator.send({ content: `📄 **Transcript:**\n\`\`\`\n${transcript}\n\`\`\`` });
              }
            } catch (err) {
              console.error('Could not DM transcript to user', err);
            }
          }

          // Delete the ticket channel
          await ticketChannel.send({ content: `🔒 Ticket closed by ${closedBy.toString()}. This channel will be deleted in 5 seconds.` });
          
          setTimeout(async () => {
            try {
              await ticketChannel.delete('Ticket closed');
            } catch (err) {
              console.error('Failed to delete ticket channel', err);
            }
          }, 5000);

        } catch (err) {
          console.error('Failed to close ticket', err);
          await interaction.followUp({ content: '❌ Failed to close ticket.', flags: [64] });
        }
      }
    }
  } catch (err) {
    console.error('Interaction handler error', err);
    if (interaction.isRepliable()) await interaction.reply({ content: 'There was an error.', flags: [64] });
  }
};
