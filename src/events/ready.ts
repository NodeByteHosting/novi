import { Client, ActivityType, EmbedBuilder, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../lib/db';
import { logger } from '../lib/logger';

export default async (client: Client) => {
  logger.info(`Bot is ready and logged in as: ${client.user?.tag}`, {
    context: 'ReadyEvent'
  });
  
  // Set up rotating bot status
  const statuses = [
    { name: 'Trapped in a world of chaos!', type: ActivityType.Custom }
  ];

  // Set initial random status
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  client.user?.setPresence({
    activities: [randomStatus],
    status: 'dnd'
  });

  // Rotate status every 30 seconds
  setInterval(() => {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    client.user?.setPresence({
      activities: [status],
      status: 'dnd',
    });
  }, 30 * 1000);

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

  // Function to refresh ticket messages
  const refreshTicketMessages = async () => {
    try {
      logger.debug('Starting ticket message refresh', {
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
      logger.error('Ticket message refresh error', {
        context: 'ReadyEvent',
        error: err
      });
    }
  };

  // Refresh ticket messages on startup
  await refreshTicketMessages();

  // Set up periodic ticket message refresh (every 12 hours)
  // This ensures Discord continues to accept reactions on the ticket button
  setInterval(refreshTicketMessages, 12 * 60 * 60 * 1000); // 12 hours in milliseconds

  // Function to apply decay to all guild level systems
  const applyLevelDecay = async () => {
    try {
      logger.debug('Starting daily level decay job', {
        context: 'ReadyEvent'
      });

      for (const [guildId] of client.guilds.cache) {
        try {
          await db.applyDecay(guildId);
        } catch (err) {
          logger.error('Failed to apply decay for guild', {
            context: 'ReadyEvent',
            error: err,
            guildId
          });
        }
      }
    } catch (err) {
      logger.error('Level decay job error', {
        context: 'ReadyEvent',
        error: err
      });
    }
  };

  // Run decay once on startup, then daily at 2 AM
  const now = new Date();
  const target = new Date();
  target.setHours(2, 0, 0, 0);
  
  // If past 2 AM, schedule for tomorrow
  if (now > target) {
    target.setDate(target.getDate() + 1);
  }

  const timeUntilDecay = target.getTime() - now.getTime();
  setTimeout(() => {
    applyLevelDecay();
    // Run daily after initial delay
    setInterval(applyLevelDecay, 24 * 60 * 60 * 1000);
  }, timeUntilDecay);

  logger.info('Level system decay scheduled', {
    context: 'ReadyEvent',
    nextRunAt: target.toISOString()
  });
};
