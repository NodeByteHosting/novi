import { Client, Message, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger';
import { isMalicious } from '../lib/malwareFilter';

const PREFIX = '!';

// Command aliases mapping
const COMMAND_ALIASES: Record<string, string> = {
  // Support command aliases
  'ts': 'techsupport',
  'tech': 'techsupport',
  'gs': 'vps',
  'game': 'vps',
  'gameserver': 'vps',
  'mc': 'minecraft',
  'rust': 'rust',
  'hytale': 'hytale',
  'panel': 'panel',
  'p': 'panel',
  'billing': 'billing',
  'b': 'billing',
  'guides': 'guides',
  'g': 'guides',
  'support': 'support',
}

export default async (client: Client, message: Message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Check for malicious links
  const maliciousCheck = isMalicious(message.content);
  if (maliciousCheck.isMalicious) {
    try {
      await message.delete();
      logger.warn('Malicious message deleted', {
        context: 'MessageCreate',
        userId: message.author.id,
        username: message.author.username,
        guildId: message.guildId ?? undefined,
        channelId: message.channelId,
        matchType: maliciousCheck.matchType,
        matched: maliciousCheck.matched,
      });
      try {
        await message.author.send(
          `Your message in **${message.guild?.name || 'a server'}** was automatically deleted for containing a potentially malicious link. ` +
          `If you believe this is a mistake, please contact server staff.`
        );
      } catch (dmErr) {
        logger.debug('Could not send DM about deleted message', { context: 'MessageCreate', userId: message.author.id });
      }
      const logChannelId = process.env.MODERATION_LOG_CHANNEL_ID;
      if (logChannelId && message.guild) {
        try {
          const logChannel = await message.guild.channels.fetch(logChannelId);
          if (logChannel?.isTextBased()) {
            const alertEmbed = new EmbedBuilder()
              .setColor(0xFF5555)
              .setTitle('Malicious Link Detected')
              .setDescription(`Message from ${message.author} automatically deleted`)
              .addFields(
                { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Detection Type', value: maliciousCheck.matchType || 'unknown', inline: true },
                { name: 'Matched', value: `\`${maliciousCheck.matched || 'N/A'}\``, inline: false }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [alertEmbed] });
          }
        } catch (logErr) {
          logger.debug('Failed to log to moderation channel', { context: 'MessageCreate', error: logErr });
        }
      }
    } catch (delErr) {
      logger.error('Failed to delete malicious message', {
        context: 'MessageCreate',
        error: delErr,
        messageId: message.id,
      });
    }
    return;
  }

  // Handle prefix commands (! prefix)
  if (message.content.startsWith(PREFIX)) {
    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    let command = args[0]?.toLowerCase();

    // Resolve aliases
    if (command && COMMAND_ALIASES[command]) {
      command = COMMAND_ALIASES[command];
    }

    if (command) {
      try {
        const commandPath = path.join(__dirname, '..', 'prefix', `${command}.ts`);
        const jsCommandPath = path.join(__dirname, '..', 'prefix', `${command}.js`);

        // Check if command file exists
        let cmdModule;
        if (fs.existsSync(commandPath)) {
          delete require.cache[require.resolve(commandPath)];
          cmdModule = require(commandPath);
        } else if (fs.existsSync(jsCommandPath)) {
          delete require.cache[require.resolve(jsCommandPath)];
          cmdModule = require(jsCommandPath);
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
          
          // Clear guild commands if GUILD_ID is set
          if (process.env.GUILD_ID) {
            await rest.put(Routes.applicationGuildCommands(clientId, process.env.GUILD_ID), { body: [] });
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

          // Register to guild for instant updates (dev) OR globally (production)
          if (process.env.GUILD_ID) {
            await rest.put(
              Routes.applicationGuildCommands(clientId, process.env.GUILD_ID),
              { body: commands }
            );
          } else {
            await rest.put(Routes.applicationCommands(clientId), { body: commands });
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
        .setTitle('👋 Hello! I\'m NodeBot')
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
