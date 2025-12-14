import { ChatInputCommandInteraction, SlashCommandBuilder, REST, Routes } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('clearcache')
  .setDescription('Clear all slash commands (Developer only)');

export async function execute(interaction: ChatInputCommandInteraction) {
  const devIds = process.env.DEV_IDS?.split(',') || [];
  
  if (!devIds.includes(interaction.user.id)) {
    return interaction.reply({ content: '❌ This command is for developers only.', flags: [64] });
  }

  await interaction.deferReply({ flags: [64] });

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!);
    const clientId = process.env.CLIENT_ID!;

    // Clear global commands
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    
    // Clear guild commands if GUILD_ID is set
    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(clientId, process.env.GUILD_ID), { body: [] });
    }

    await interaction.editReply({ content: '✅ Successfully cleared all slash commands cache.' });
  } catch (err) {
    console.error('Failed to clear commands:', err);
    await interaction.editReply({ content: '❌ Failed to clear commands cache.' });
  }
}
