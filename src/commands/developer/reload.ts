import { ChatInputCommandInteraction, SlashCommandBuilder, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';

export const data = new SlashCommandBuilder()
  .setName('reload')
  .setDescription('Reload and register all slash commands (Developer only)');

export async function execute(interaction: ChatInputCommandInteraction) {
  const devIds = process.env.DEV_IDS?.split(',') || [];
  
  if (!devIds.includes(interaction.user.id)) {
    return interaction.reply({ content: '❌ This command is for developers only.', flags: [64] });
  }

  await interaction.deferReply({ flags: [64] });

  try {
    const commands: any[] = [];
    const commandsPath = path.join(__dirname, '..');

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

    await interaction.editReply({ 
      content: `✅ Successfully reloaded ${commands.length} slash commands.\n\nCommands registered:\n${commands.map(c => `• /${c.name}`).join('\n')}` 
    });
  } catch (err) {
    console.error('Failed to reload commands:', err);
    await interaction.editReply({ content: '❌ Failed to reload commands.' });
  }
}
