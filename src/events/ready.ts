import { Client, ActivityType, EmbedBuilder, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../lib/db';
import { logger } from '../lib/logger';

export default async (client: Client) => {
  logger.info(`Bot is ready and logged in as: ${client.user?.tag}`, {
    context: 'ReadyEvent'
  });
  
  // Set bot status
  client.user?.setPresence({
    activities: [
      {
        name: 'NodeByte Services',
        type: ActivityType.Watching
      }
    ],
    status: 'idle'
  });

  // Send ready embed to logs channel
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const config = await db.getOrCreateGuildConfig(guildId);
      const logsChannelId = config?.logsChannelId;

      if (logsChannelId) {
        const logsChannel = guild.channels.cache.get(logsChannelId) as TextChannel;
        if (logsChannel && 'send' in logsChannel) {
          const embed = new EmbedBuilder()
            .setColor(0x3256d9)
            .setTitle('✅ Bot Online')
            .setThumbnail(client.user?.displayAvatarURL() || '')
            .setDescription(`${client.user?.tag} is now online and ready!`)
            .setTimestamp()
            .setFooter({ text: `Please don't delete the bot or restart it unnecessarily. | © Copyright 2024 - 2026 NodeByte LTD` });

          try {
            await logsChannel.send({ embeds: [embed] });
          } catch (err) {
            logger.error('Failed to send ready embed to logs channel', {
              context: 'ReadyEvent',
              error: err
            });
          }
          break; // Only send to one guild's logs channel
        }
      }
    } catch (err) {
      logger.error('Failed to process guild in ready event', {
        context: 'ReadyEvent',
        error: err,
        guildId
      });
    }
  }

  // Set up periodic ticket message refresh (every 12 hours)
  // This ensures Discord continues to accept reactions on the ticket button
  setInterval(async () => {
    try {
      logger.debug('Starting periodic ticket message refresh', {
        context: 'ReadyEvent'
      });

      for (const [guildId, guild] of client.guilds.cache) {
        try {
          const config = await db.getOrCreateGuildConfig(guildId);
          if (!config?.ticketMessageId || !config?.ticketChannelId) continue;

          const ticketChannel = guild.channels.cache.get(config.ticketChannelId) as TextChannel;
          if (!ticketChannel || !ticketChannel.isTextBased()) continue;

          try {
            const message = await ticketChannel.messages.fetch(config.ticketMessageId);
            
            // Recreate the button to reset reaction collector
            const createButton = new ButtonBuilder()
              .setCustomId('ticket_create')
              .setLabel('Create Ticket')
              .setEmoji('🎫')
              .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(createButton);

            // Edit the message to refresh it
            await message.edit({ components: [row] });

            logger.debug('Refreshed ticket message', {
              context: 'ReadyEvent',
              guildId,
              messageId: config.ticketMessageId
            });
          } catch (err) {
            logger.error('Failed to refresh ticket message', {
              context: 'ReadyEvent',
              error: err,
              guildId,
              messageId: config.ticketMessageId
            });
          }
        } catch (err) {
          logger.error('Error processing guild in ticket refresh', {
            context: 'ReadyEvent',
            error: err,
            guildId
          });
        }
      }
    } catch (err) {
      logger.error('Ticket message refresh interval error', {
        context: 'ReadyEvent',
        error: err
      });
    }
  }, 12 * 60 * 60 * 1000); // 12 hours in milliseconds
};
