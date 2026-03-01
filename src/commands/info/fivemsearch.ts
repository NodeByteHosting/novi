import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { searchFiveMServers, FiveMServer } from '../../lib/gameServer';
import { logger } from '../../lib/logger';

export const data = new SlashCommandBuilder()
  .setName('fivemsearch')
  .setDescription('Search for FiveM servers by name or query')
  .addStringOption(option =>
    option
      .setName('query')
      .setDescription('Server name or search query')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('limit')
      .setDescription('Number of results (1-20)')
      .setMinValue(1)
      .setMaxValue(20)
      .setRequired(false)
  )
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const query = interaction.options.getString('query', true);
  const limit = interaction.options.getInteger('limit') || 10;

  try {
    const servers = await searchFiveMServers(query, limit);

    if (!servers || servers.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF5555)
            .setTitle('No Results')
            .setDescription(`No FiveM servers found matching: \`${query}\``)
        ]
      });
      return;
    }

    const embeds = servers.map((server: FiveMServer, index: number) => {
      const players = server.players || [];
      const playerPercentage = Math.round((server.clients / server.maxClients) * 100);

      return new EmbedBuilder()
        .setColor(server.clients > 0 ? 0x3BB98E : 0xFFA500)
        .setTitle(`#${index + 1} - ${server.hostname || 'Unknown Server'}`)
        .addFields(
          { 
            name: '👥 Players', 
            value: `${server.clients}/${server.maxClients} (${playerPercentage}%)`, 
            inline: true 
          },
          { 
            name: '🗺️ Map', 
            value: server.mapname || 'Unknown', 
            inline: true 
          },
          { 
            name: '🎮 Game Type', 
            value: server.gametype || 'Unknown', 
            inline: true 
          },
          {
            name: '📦 Resources',
            value: server.resources?.length?.toString() || '0',
            inline: true
          },
          {
            name: '📡 OneSync',
            value: server.oneSync || server.onesyncEnabled ? '✓' : '✗',
            inline: true
          },
          {
            name: 'ℹ️ Server ID',
            value: `\`${server.connectEndPoints?.[0] || 'Unknown'}\``,
            inline: false
          }
        )
        .setFooter({ text: `Result ${index + 1}/${servers.length} | Requested by ${interaction.user.tag}` })
        .setTimestamp();
    });

    // Send first result immediately
    await interaction.editReply({ embeds: [embeds[0]] });

    // If more than one result, show pagination info
    if (embeds.length > 1) {
      await interaction.followUp({
        content: `Showing ${embeds.length} results for \`${query}\`. Use embed navigation if available, or run the search again to see the next set.`,
        ephemeral: true
      });
    }

    logger.debug('FiveM server search completed', {
      context: 'FiveM',
      query,
      resultsFound: servers.length,
    });
  } catch (err) {
    logger.error('Failed to execute fivemsearch command', {
      context: 'FiveM',
      error: err,
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF5555)
          .setTitle('Error')
          .setDescription('An error occurred while searching for servers. Please try again later.')
      ]
    });
  }
}
