import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getFiveMServerResources, parseFiveMServerIdentifier } from '../lib/gameServer';
import { logger } from '../lib/logger';

export const data = new SlashCommandBuilder()
  .setName('fivemresources')
  .setDescription('View FiveM server resources and scripts')
  .addStringOption(option =>
    option
      .setName('server')
      .setDescription('Server identifier (IP:port, hostname:port, or CFX UUID)')
      .setRequired(true)
  )
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const serverInput = interaction.options.getString('server', true);
  const serverIdentifier = parseFiveMServerIdentifier(serverInput);

  if (!serverIdentifier) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF5555)
          .setTitle('Invalid Server Identifier')
          .setDescription('Please provide a valid server IP:port, hostname:port, or CFX UUID.')
      ]
    });
    return;
  }

  try {
    const resources = await getFiveMServerResources(serverIdentifier);

    if (!resources || resources.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('No Resources Found')
            .setDescription(`Server \`${serverIdentifier}\` has no resources loaded.`)
        ]
      });
      return;
    }

    // Create pages for resources (50 per embed)
    const itemsPerPage = 50;
    const pages = [];

    for (let i = 0; i < resources.length; i += itemsPerPage) {
      const pageResources = resources.slice(i, i + itemsPerPage);
      const resourceList = pageResources
        .map((r: string, idx: number) => `${i + idx + 1}. \`${r}\``)
        .join('\n');

      const page = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle(`📦 FiveM Server Resources - Page ${Math.floor(i / itemsPerPage) + 1}`)
        .setDescription(resourceList)
        .setFooter({ 
          text: `Total: ${resources.length} resources | Page ${Math.floor(i / itemsPerPage) + 1}/${Math.ceil(resources.length / itemsPerPage)}` 
        })
        .setTimestamp();

      pages.push(page);
    }

    // Send first page
    await interaction.editReply({ 
      embeds: [pages[0]],
      content: pages.length > 1 ? `Showing page 1 of ${pages.length}. This server has ${resources.length} total resources.` : undefined
    });

    logger.debug('Fetched FiveM server resources', {
      context: 'FiveM',
      serverIdentifier,
      resourceCount: resources.length,
    });
  } catch (err) {
    logger.error('Failed to execute fivemresources command', {
      context: 'FiveM',
      error: err,
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF5555)
          .setTitle('Error')
          .setDescription('An error occurred while fetching server resources. Please try again later.')
      ]
    });
  }
}
