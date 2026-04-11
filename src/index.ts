import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials, Interaction, GuildMember } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { logger } from './lib/logger';
import { ExtendedClient, CommandModule } from './types';
import { createTranscriptServer } from './lib/transcriptServer';
import { initMalwareFilter, startAutoRefresh } from './lib/malwareFilter';

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
// Support both single GUILD_ID (legacy) and multiple GUILD_IDS
const guildIds = process.env.GUILD_IDS 
  ? process.env.GUILD_IDS.split(',').map(id => id.trim())
  : process.env.GUILD_ID 
    ? [process.env.GUILD_ID]
    : [];

if (!token) {
  logger.error('BOT_TOKEN is required in .env');
  process.exit(1);
}

logger.info('Starting bot initialization...');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMembers, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildPresences
  ],
  partials: [
    Partials.Message,
    Partials.Channel
  ]
}) as ExtendedClient;
client.commands = new Collection<string, CommandModule>();

// load commands
const commandsPath = path.join(__dirname, 'commands');
function walkCommands(dir: string) {
  try {
    // Use filter to reduce iterations - only process files on first pass
    const files = fs.readdirSync(dir).filter(file => {
      const full = path.join(dir, file);
      const isDir = fs.statSync(full).isDirectory();
      const isCommand = (file.endsWith('.js') || file.endsWith('.ts'));
      return isDir || isCommand;
    });

    for (const file of files) {
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      
      if (stat.isDirectory()) {
        walkCommands(full);
      } else {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const cmd = require(full);
          const name = cmd.data?.name ?? path.basename(file, path.extname(file));
          client.commands.set(name, cmd);
          logger.debug(`Loaded command: ${name}`);
        } catch (err) {
          logger.error(`Failed to load command from ${file}`, {
            context: 'CommandLoading',
            error: err
          });
        }
      }
    }
  } catch (err) {
    logger.error(`Error walking commands directory ${dir}`, {
      context: 'CommandLoading',
      error: err
    });
  }
}

if (fs.existsSync(commandsPath)) {
  logger.info('Loading commands...');
  walkCommands(commandsPath);
  
  // Filter and log commands by category for better visibility
  const commandsByFirst = client.commands.partition((cmd) => cmd.data.name.length > 0);
  logger.info(`Loaded ${client.commands.size} commands`);
  logger.debug(`Commands collection cached: ${commandsByFirst[0].size} available`);
} else {
  logger.warn('Commands directory does not exist', { context: 'CommandLoading' });
}

// event loader
const eventsPath = path.join(__dirname, 'events');
try {
  logger.info('Loading events...');
  let eventCount = 0;
  
  for (const file of fs.readdirSync(eventsPath)) {
    if (!file.endsWith('.js') && !file.endsWith('.ts')) continue;
    
    try {
      const eventName = path.basename(file, path.extname(file));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const handler = require(path.join(eventsPath, file)).default;
      if (!handler) {
        logger.warn(`Event handler ${eventName} does not export default`, {
          context: 'EventLoading'
        });
        continue;
      }

      if (eventName === 'ready') {
        client.once('clientReady', async () => {
          try {
            // Register slash commands before calling the handler
            try {
              if (guildIds.length === 0) {
                logger.warn('GUILD_ID or GUILD_IDS not set, skipping command registration', {
                  context: 'CommandRegistration'
                });
              } else {
                const commandData = Array.from(client.commands.values())
                  .map(cmd => cmd.data)
                  .filter(data => data !== undefined);
                
                for (const guildId of guildIds) {
                  const guild = client.guilds.cache.get(guildId);
                  if (guild) {
                    logger.info(`Registering ${commandData.length} slash commands to guild ${guildId}...`, {
                      context: 'CommandRegistration'
                    });
                    
                    const registered = await guild.commands.set(commandData);
                    logger.info(`Successfully registered ${registered.size} slash commands to guild ${guildId}`, {
                      context: 'CommandRegistration',
                      guildId,
                      count: registered.size
                    });
                  } else {
                    logger.warn(`Guild ${guildId} not found in cache`, {
                      context: 'CommandRegistration'
                    });
                  }
                }
              }
            } catch (regErr) {
              logger.error('Failed to register slash commands', {
                context: 'CommandRegistration',
                error: regErr
              });
            }

            // Initialize malware filter
            try {
              await initMalwareFilter();
              startAutoRefresh();
              logger.info('Malware filter initialized and auto-refresh started', { context: 'MalwareFilter' });
            } catch (filterErr) {
              logger.error('Failed to initialize malware filter', {
                context: 'MalwareFilter',
                error: filterErr
              });
            }
            
            // Call the ready event handler
            await handler(client);
          } catch (err) {
            logger.error('Error in ready event handler', {
              context: 'EventHandler',
              error: err
            });
          }
        });
      } else if (eventName === 'interactionCreate') {
        client.on('interactionCreate', async (i: Interaction) => {
          try {
            await handler(client, i);
          } catch (err) {
            logger.error('Error in interactionCreate event handler', {
              context: 'EventHandler',
              error: err,
              userId: i.user?.id,
              guildId: i.guild?.id
            });
            if (i.isRepliable() && !i.replied) {
              try {
                await i.reply({
                  content: '❌ An error occurred while processing your request.',
                  flags: [64]
                });
              } catch (replyErr) {
                logger.error('Failed to send error reply', {
                  context: 'EventHandler',
                  error: replyErr
                });
              }
            }
          }
        });
      } else if (eventName === 'guildMemberAdd') {
        client.on('guildMemberAdd', (m: GuildMember) => {
          try {
            handler(client, m);
          } catch (err) {
            logger.error('Error in guildMemberAdd event handler', {
              context: 'EventHandler',
              error: err,
              userId: m.user?.id,
              guildId: m.guild?.id
            });
          }
        });
      } else {
        client.on(eventName as Parameters<typeof client.on>[0], (...args: unknown[]) => {
          try {
            handler(client, ...args);
          } catch (err) {
            logger.error(`Error in ${eventName} event handler`, {
              context: 'EventHandler',
              error: err
            });
          }
        });
      }
      
      eventCount++;
      logger.debug(`Loaded event: ${eventName}`);
    } catch (err) {
      const eventName = path.basename(file, path.extname(file));
      logger.error(`Failed to load event ${eventName}`, {
        context: 'EventLoading',
        error: err
      });
    }
  }
  
  logger.info(`Loaded ${eventCount} events`);
} catch (err) {
  logger.error('Error loading events', {
    context: 'EventLoading',
    error: err
  });
}

client.login(token).catch((err: Error) => {
  logger.error('Failed to login to Discord', {
    context: 'ClientLogin',
    error: err
  });
  process.exit(1);
});

// Start transcript server
const transcriptPort = parseInt(process.env.TRANSCRIPT_PORT || '3001', 10);
createTranscriptServer(transcriptPort);

// ============================================
// GLOBAL ERROR HANDLERS
// ============================================

/**
 * Discord.js client error event
 * Fired when a critical error occurs in the Discord client
 */
client.on('error', (error: Error) => {
  logger.error('Discord client error', {
    context: 'ClientError',
    error
  });
});

/**
 * Discord.js warning event
 * Fired for non-critical warnings
 */
client.on('warn', (warning: string) => {
  logger.warn(`Discord client warning: ${warning}`, {
    context: 'ClientWarning'
  });
});

/**
 * Handle unhandled promise rejections
 * Prevents the bot from crashing on unhandled rejections
 */
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection', {
    context: 'ProcessError',
    error: reason,
    promise: String(promise)
  });
});

/**
 * Handle uncaught exceptions
 * Logs the error but keeps the process running
 */
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    context: 'ProcessError',
    error
  });
  // Don't exit the process, as we want the bot to continue running
  // This is a safety mechanism to ensure the bot doesn't crash completely
  // Consider implementing a restart mechanism if crashes become frequent
});

/**
 * Handle warnings from the process
 */
process.on('warning', (warning: any) => {
  logger.warn(`Process warning: ${warning.message || warning}`, {
    context: 'ProcessWarning',
    error: warning
  });
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

/**
 * Handle graceful shutdown on SIGINT (Ctrl+C)
 */
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  try {
    client.destroy();
    logger.info('Discord client destroyed');
  } catch (err) {
    logger.error('Error destroying client during shutdown', {
      context: 'Shutdown',
      error: err
    });
  }
  process.exit(0);
});

/**
 * Handle graceful shutdown on SIGTERM
 */
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  try {
    client.destroy();
    logger.info('Discord client destroyed');
  } catch (err) {
    logger.error('Error destroying client during shutdown', {
      context: 'Shutdown',
      error: err
    });
  }
  process.exit(0);
});
