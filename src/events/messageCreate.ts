import { Client, Message, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';

export default async (client: Client, message: Message) => {
  // Ignore bot messages
  if (message.author.bot) return;

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
          { name: '📚 Get Started', value: 'Use `/help` to see all available commands!', inline: false },
          { name: '🎫 Need Support?', value: 'DM me with the word `help` to create a support ticket.', inline: false },
          { name: '🔗 Quick Links', value: 'Use `/links` to see our services and links.', inline: false }
        )
        .setThumbnail(client.user?.displayAvatarURL() || '')
        .setTimestamp()
        .setFooter({ text: '\u00a9Copyright 2024 - 2025 NodeByte LTD' });

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
      .setDescription('Please select the type of support you need from the dropdown menu below.\n\nOur support team will assist you as soon as possible.')
      .addFields(
        { name: '📋 General Support', value: 'General questions and assistance', inline: false },
        { name: '🖥️ Tech Support', value: 'Technical issues and troubleshooting', inline: false },
        { name: '🎮 Game Support', value: 'Game-related help and issues', inline: false },
        { name: '🔧 VPS Support', value: 'VPS server assistance', inline: false }
      )
      .setFooter({ text: 'Please note we do not allow Billing or Account Support via Discord. Open a support ticket on the website. 😊 |\u00a9Copyright 2024 - 2025 NodeByte LTD' })
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
