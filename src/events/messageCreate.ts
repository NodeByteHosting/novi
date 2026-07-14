import { Client, Message, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, REST, Routes, Collection } from 'discord.js';
import { logger } from '../lib/logger';
import { isMalicious } from '../lib/malwareFilter';
import { checkScamMessage } from '../lib/scamFilter';
import { isOcrEligibleAttachment, extractTextFromImage } from '../lib/imageOcr';
import { trackAndCheckSpam, clearTrackedMessages } from '../lib/spamDetector';
import db from '../lib/db';
import { resolvePrefixCommandFile } from '../lib/prefixCommands';
import * as fs from 'fs';
import * as path from 'path';

const MAX_OCR_ATTACHMENTS_PER_MESSAGE = 3;
const SPAM_RAID_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const MALICIOUS_CONTENT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes - single confirmed malware/scam hit

/** Times out the author if the bot is able to moderate them. Best-effort; never throws. */
async function attemptTimeout(message: Message, durationMs: number, reason: string, logContext: string) {
  if (!message.guild) return;
  try {
    const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null);
    if (member?.moderatable) {
      await member.timeout(durationMs, reason);
    }
  } catch (err) {
    logger.debug('Failed to timeout user', { context: logContext, error: err });
  }
}

/**
 * Deletes the offending message(s), DMs the author, posts an alert to the
 * guild's log channel, and optionally times the author out. Shared by the
 * malware/scam/spam-raid detectors below since they all resolve to the same
 * delete+notify+log(+timeout) flow.
 */
async function deleteAndReport(
  primaryMessage: Message,
  messagesToDelete: Message[],
  opts: {
    logTitle: string;
    logContext: string;
    dmReason: string;
    embedFields: { name: string; value: string; inline?: boolean }[];
    timeout?: { durationMs: number; reason: string };
  }
) {
  const { logTitle, logContext, dmReason, embedFields, timeout } = opts;

  try {
    await Promise.all(
      messagesToDelete.map(m => m.delete().catch(err => {
        logger.debug('Failed to delete message during moderation action', { context: logContext, error: err, messageId: m.id });
      }))
    );

    logger.warn(logTitle, {
      context: logContext,
      userId: primaryMessage.author.id,
      username: primaryMessage.author.username,
      guildId: primaryMessage.guildId ?? undefined,
      channelId: primaryMessage.channelId,
      deletedCount: messagesToDelete.length,
    });

    if (timeout) {
      await attemptTimeout(primaryMessage, timeout.durationMs, timeout.reason, logContext);
    }

    try {
      const timeoutMinutes = timeout ? Math.round(timeout.durationMs / 60000) : 0;
      await primaryMessage.author.send(
        `Your message(s) in **${primaryMessage.guild?.name || 'a server'}** were automatically deleted: ${dmReason} ` +
        `${timeout ? `You have also been timed out for ${timeoutMinutes} minute(s). ` : ''}` +
        `If you believe this is a mistake, please contact server staff.`
      );
    } catch {
      logger.debug('Could not send DM about deleted message', { context: logContext, userId: primaryMessage.author.id });
    }

    const guildConfig = primaryMessage.guildId ? await db.getGuildConfig(primaryMessage.guildId) : null;
    const logChannelId = guildConfig?.logsChannelId;
    if (logChannelId && primaryMessage.guild) {
      try {
        const logChannel = await primaryMessage.guild.channels.fetch(logChannelId);
        if (logChannel?.isTextBased()) {
          const alertEmbed = new EmbedBuilder()
            .setColor(0xFF5555)
            .setTitle(logTitle)
            .setDescription(`Message(s) from ${primaryMessage.author} automatically deleted${timeout ? ` and user timed out for ${Math.round(timeout.durationMs / 60000)}m` : ''}`)
            .addFields(
              { name: 'User', value: `${primaryMessage.author.tag} (${primaryMessage.author.id})`, inline: true },
              { name: 'Channel', value: `${primaryMessage.channel}`, inline: true },
              ...embedFields
            )
            .setTimestamp();
          await logChannel.send({ embeds: [alertEmbed] });
        }
      } catch (logErr) {
        logger.debug('Failed to log to moderation channel', { context: logContext, error: logErr });
      }
    }
  } catch (err) {
    logger.error('Failed to complete moderation action', { context: logContext, error: err, messageId: primaryMessage.id });
  }
}

/** Extracts and combines OCR text from a message's image attachments (best-effort). */
async function extractAttachmentText(message: Message): Promise<string> {
  const imageAttachments = message.attachments
    .filter(a => isOcrEligibleAttachment(a))
    .first(MAX_OCR_ATTACHMENTS_PER_MESSAGE);

  if (imageAttachments.length === 0) return '';

  const texts = await Promise.all(imageAttachments.map(a => extractTextFromImage(a.url)));
  return texts.filter(Boolean).join(' ');
}

const PREFIX = '!';

// Cache for allowed guild IDs (for prefix commands) with TTL
const allowedGuildsCache = new Collection<string, { guilds: string[]; expiresAt: number }>();
const GUILDS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getAllowedGuildIds(): Promise<string[]> {
  const cached = allowedGuildsCache.get('allowed_guilds');
  
  if (cached && Date.now() < cached.expiresAt) {
    return cached.guilds;
  }

  // Merge env var guild IDs with database guild IDs
  const envGuildIds = process.env.GUILD_IDS
    ? process.env.GUILD_IDS.split(',').map(id => id.trim())
    : process.env.GUILD_ID
      ? [process.env.GUILD_ID]
      : [];

  const dbGuildIds = await db.getGuildIds();
  const allGuildIds = Array.from(new Set([...envGuildIds, ...dbGuildIds]));

  allowedGuildsCache.set('allowed_guilds', {
    guilds: allGuildIds,
    expiresAt: Date.now() + GUILDS_CACHE_TTL
  });

  return allGuildIds;
}

// Command aliases mapping — targets must match an existing file in src/prefix/
const COMMAND_ALIASES: Record<string, string> = {
  // billing
  'b': 'billing',
  // bytesend
  'bs': 'bytesend',
  'send': 'bytesend',
  // crash
  'crashed': 'crash',
  'crashing': 'crash',
  // docs
  'doc': 'docs',
  'd': 'docs',
  // faq
  'f': 'faq',
  'questions': 'faq',
  // fullscreen
  'fs': 'fullscreen',
  'full': 'fullscreen',
  // java
  'j': 'java',
  // lag
  'lagging': 'lag',
  'tps': 'lag',
  // logs
  'log': 'logs',
  // mods
  'mod': 'mods',
  'm': 'mods',
  // partnerinfo
  'pi': 'partnerinfo',
  'newpartner': 'partnerinfo',
  // partnership
  'partner': 'partnership',
  'partners': 'partnership',
  // plugins
  'plugin': 'plugins',
  'p': 'plugins',
  // services
  'service': 'services',
  'svc': 'services',
  // status
  's': 'status',
  // support
  'sup': 'support',
  // update
  'updates': 'update',
  'u': 'update',
}

export default async (client: Client, message: Message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Check for cross-channel spam/raid behavior (scam bots blasting the same
  // or varied payloads into many channels in quick succession)
  if (message.guild) {
    const spamCheck = trackAndCheckSpam(message);
    if (spamCheck.isSpam) {
      const uniqueMessages = Array.from(new Map((spamCheck.matchedMessages || [message]).map(m => [m.id, m])).values());

      await deleteAndReport(message, uniqueMessages, {
        logTitle: 'Spam Raid Detected',
        logContext: 'MessageCreate:SpamDetector',
        dmReason: `you were posting the same or rapid-fire messages across multiple channels (${spamCheck.reason}).`,
        embedFields: [
          { name: 'Reason', value: spamCheck.reason || 'N/A', inline: false },
          { name: 'Messages Removed', value: `${uniqueMessages.length}`, inline: true },
        ],
        timeout: { durationMs: SPAM_RAID_TIMEOUT_MS, reason: 'Automated: cross-channel spam raid detected' },
      });

      clearTrackedMessages(message.author.id);
      return;
    }
  }

  // Pull text out of image attachments (scam giveaways/casino screenshots
  // usually carry no message text at all) and combine with the message body
  const ocrText = await extractAttachmentText(message);
  const combinedText = ocrText ? `${message.content} ${ocrText}` : message.content;

  // Check for malicious links
  const maliciousCheck = isMalicious(combinedText);
  if (maliciousCheck.isMalicious) {
    await deleteAndReport(message, [message], {
      logTitle: 'Malicious Link Detected',
      logContext: 'MessageCreate:MalwareFilter',
      dmReason: 'it contained a potentially malicious link.',
      embedFields: [
        { name: 'Detection Type', value: maliciousCheck.matchType || 'unknown', inline: true },
        { name: 'Matched', value: `\`${maliciousCheck.matched || 'N/A'}\``, inline: false },
        { name: 'Source', value: ocrText ? 'Message text / image OCR' : 'Message text', inline: true },
      ],
      timeout: { durationMs: MALICIOUS_CONTENT_TIMEOUT_MS, reason: 'Automated: posted a known malicious link' },
    });
    return;
  }

  // Check for crypto/payout giveaway scams (e.g. fake MrBeast giveaways)
  const scamCheck = checkScamMessage(combinedText);
  if (scamCheck.isScam) {
    await deleteAndReport(message, [message], {
      logTitle: 'Scam Message Detected',
      logContext: 'MessageCreate:ScamFilter',
      dmReason: 'it matched patterns commonly used in crypto/payout giveaway scams.',
      embedFields: [
        { name: 'Score', value: `${scamCheck.score}`, inline: true },
        { name: 'Signals', value: scamCheck.reasons.map(r => `\`${r}\``).join(', ') || 'N/A', inline: false },
        { name: 'Source', value: ocrText ? 'Message text / image OCR' : 'Message text', inline: true },
      ],
      timeout: { durationMs: MALICIOUS_CONTENT_TIMEOUT_MS, reason: 'Automated: posted a crypto/payout giveaway scam' },
    });
    return;
  }

  // Track activity for level system
  if (message.guild) {
    const levelConfig = await db.getLevelConfig(message.guildId!);
    if (levelConfig?.enabled) {
      db.addActivityPoints(message.guildId!, message.author.id, 1, 'message').catch(err => {
        logger.debug('Failed to add activity points', { context: 'MessageCreate', error: err });
      });
    }
  }

  // Handle prefix commands (! prefix)
  if (message.content.startsWith(PREFIX)) {
    // Get all allowed guilds (from env and database)
    const allowedGuilds = await getAllowedGuildIds();

    // Only allow prefix commands in configured guilds
    if (!allowedGuilds.includes(message.guildId || '')) {
      await message.reply({
        content: '❌ These commands are unavailable in this guild.',
        flags: ['SuppressEmbeds']
      }).catch(() => null);
      return;
    }

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    let command = args[0]?.toLowerCase();

    // Resolve aliases
    if (command && COMMAND_ALIASES[command]) {
      command = COMMAND_ALIASES[command];
    }

    if (command) {
      try {
        let cmdModule;
        const resolvedCommandPath = resolvePrefixCommandFile(command);

        if (resolvedCommandPath) {
          delete require.cache[require.resolve(resolvedCommandPath)];
          cmdModule = require(resolvedCommandPath);
        }

        if (cmdModule && cmdModule.default) {
          await cmdModule.default(message, args.slice(1));
          logger.debug(`Prefix command executed: ${command}`, {
            context: 'PrefixCommands',
            command,
            userId: message.author.id,
            guildId: message.guildId || undefined
          });
          return;
        }
      } catch (err) {
        logger.error(`Error executing prefix command: ${command}`, {
          context: 'PrefixCommands',
          error: err,
          command,
          userId: message.author.id,
          guildId: message.guildId || undefined
        });
        await message.reply({
          content: '❌ Error executing command. Please try again.',
          flags: ['SuppressEmbeds']
        }).catch(() => null);
        return;
      }
    }
  }

  // Check if message mentions the bot in a guild (for developer commands)
  if (message.guild && message.mentions.has(client.user!.id)) {
    const devIds = process.env.DEV_IDS?.split(',').map(id => id.trim()) || [];
    
    // Check if it's a developer for special commands
    if (devIds.includes(message.author.id)) {
      const content = message.content.replace(`<@${client.user!.id}>`, '').trim();
      const args = content.split(/\s+/);
      const command = args[0]?.toLowerCase();

      // Handle clearcache command
      if (command === 'clearcache') {
        const msg = await message.reply('🔄 Clearing command cache...');

        try {
          const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!);
          const clientId = process.env.CLIENT_ID!;

          // Clear global commands
          await rest.put(Routes.applicationCommands(clientId), { body: [] });
          
          // Clear guild commands for all configured guilds
          const guildsToClean = await getAllowedGuildIds();
          for (const guildId of guildsToClean) {
            try {
              await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            } catch (err) {
              logger.debug(`Failed to clear commands for guild ${guildId}`, {
                context: 'MessageCreate',
                error: err
              });
            }
          }

          await msg.edit('✅ Successfully cleared all slash commands cache.');
        } catch (err) {
          console.error('Failed to clear commands:', err);
          await msg.edit('❌ Failed to clear commands cache.');
        }
        return;
      }

      // Handle reload command
      if (command === 'reload') {
        const msg = await message.reply('🔄 Reloading commands...');

        try {
          const commands: any[] = [];
          const commandsPath = path.join(__dirname, '..', 'commands');

          // Recursively load all command files
          function loadCommands(dir: string) {
            for (const file of fs.readdirSync(dir)) {
              const fullPath = path.join(dir, file);
              if (fs.statSync(fullPath).isDirectory()) {
                loadCommands(fullPath);
              } else if ((file.endsWith('.js') || file.endsWith('.ts')) && file !== 'reload.ts' && file !== 'clearcache.ts') {
                try {
                  // Clear require cache
                  delete require.cache[require.resolve(fullPath)];
                  
                  const cmd = require(fullPath);
                  if (cmd.data) {
                    commands.push(cmd.data.toJSON());
                  }
                } catch (err) {
                  console.error(`Failed to load command ${file}:`, err);
                }
              }
            }
          }

          loadCommands(commandsPath);

          const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!);
          const clientId = process.env.CLIENT_ID!;

          // Register to all configured guilds for instant updates (dev) OR globally (production)
          const guildsToRegister = await getAllowedGuildIds();
          if (guildsToRegister.length > 0) {
            for (const guildId of guildsToRegister) {
              try {
                await rest.put(
                  Routes.applicationGuildCommands(clientId, guildId),
                  { body: commands }
                );
                logger.debug(`Reloaded ${commands.length} commands in guild ${guildId}`, {
                  context: 'MessageCreate'
                });
              } catch (err) {
                logger.error(`Failed to reload commands in guild ${guildId}`, {
                  context: 'MessageCreate',
                  error: err
                });
              }
            }
          } else {
            await rest.put(Routes.applicationCommands(clientId), { body: commands });
            logger.debug('Reloaded commands globally', {
              context: 'MessageCreate'
            });
          }

          await msg.edit(`✅ Successfully reloaded ${commands.length} slash commands.\n\n**Commands:**\n${commands.map(c => `• /${c.name}`).join('\n')}`);
        } catch (err) {
          console.error('Failed to reload commands:', err);
          await msg.edit('❌ Failed to reload commands.');
        }
        return;
      }
    }
    
    // If developer mentioned bot but no command, fall through to regular mention response
  }

  // Regular bot mention (non-developer or no command) - show help info
  if (message.guild && message.mentions.has(client.user!.id)) {
    const content = message.content.replace(`<@${client.user!.id}>`, '').trim();
    
    // Only show help embed if no additional text (or not a dev command)
    if (!content || content.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle('👋 Hello! I\'m Novi')
        .setDescription(`Thanks for mentioning me! I'm here to help manage this server.`)
        .addFields(
          { name: '📚 Get Started:', value: 'Use `/help` to see all available commands!', inline: false },
          { name: '🎫 Need Support?', value: 'DM me with the word `help` to create a support ticket. Remember we don\'t allow Billing or Account Support via Discord.', inline: false },
          { name: '🔗 Quick Links:', value: 'Use `/links` to see our services and links.', inline: false }
        )
        .setThumbnail(client.user?.displayAvatarURL() || '')
        .setTimestamp()
        .setFooter({ text: '\u00a9Copyright 2024 - 2026 NodeByte LTD' });

      await message.reply({ embeds: [embed] });
      return;
    }
  }

  // Check if message is a DM
  if (!message.guild) {
    console.log(`[DM] Received message from ${message.author.tag}: "${message.content}"`);
    
    // Check if the message is "help" (case-insensitive)
    if (message.content.toLowerCase().trim() !== 'help') {
      console.log(`[DM] Message is not "help", ignoring`);
      return; // Ignore other DM messages
    }

    console.log(`[DM] Showing ticket menu to ${message.author.tag}`);
    
    // Show ticket creation menu when user types "help"
    const embed = new EmbedBuilder()
      .setColor(0x3256d9)
      .setTitle('🎫 Support Ticket System')
      .setDescription('Please select the type of support you need from the dropdown menu below.\n\nOur support team will assist you as soon as possible. Please note that we do not provide **Billing or Account Support via Discord. For those issues, please open a support ticket on our website**.')
      .addFields(
        { name: '📋 General Support', value: 'General questions and assistance', inline: false },
        { name: '🖥️ Tech Support', value: 'Technical issues and troubleshooting', inline: false },
        { name: '🎮 Game Support', value: 'Game-related help and issues', inline: false },
        { name: '🔧 VPS Support', value: 'VPS server assistance', inline: false }
      )
      .setFooter({ text: '\u00a9Copyright 2024 - 2025 NodeByte LTD' })
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_category')
      .setPlaceholder('Select support category...')
      .addOptions([
        {
          label: 'General Support',
          description: 'General questions and assistance',
          value: 'general',
          emoji: '📋'
        },
        {
          label: 'Tech Support',
          description: 'Technical issues and troubleshooting',
          value: 'tech',
          emoji: '🖥️'
        },
        {
          label: 'Game Support',
          description: 'Game-related help and issues',
          value: 'game',
          emoji: '🎮'
        },
        {
          label: 'VPS Support',
          description: 'VPS server assistance',
          value: 'vps',
          emoji: '🔧'
        }
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

    try {
      await message.reply({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('Failed to send ticket menu', err);
      await message.reply('❌ There was an error creating your ticket. Please try again later.').catch(() => null);
    }
  }
};
