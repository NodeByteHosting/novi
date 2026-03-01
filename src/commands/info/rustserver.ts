import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { queryRustServer } from '../../lib/gameServer';
import { logger } from '../../lib/logger';

export const data = new SlashCommandBuilder()
  .setName('rustserver')
  .setDescription('Look up a Rust server information')
  .addStringOption(option =>
    option
      .setName('serverid')
      .setDescription('Battlemetrics server ID (find at https://www.battlemetrics.com)')
      .setRequired(true)
  )
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const serverId = interaction.options.getString('serverid', true);

  try {
    const server = await queryRustServer(serverId);

    if (!server || !server.online) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF5555)
            .setTitle('Server Not Found or Offline')
            .setDescription(`Could not find server with ID: \`${serverId}\`\n\nThe server is either offline or the ID is incorrect.\n\n**How to find your server ID:**\n1. Visit https://www.battlemetrics.com\n2. Search for your server name\n3. The ID is in the URL: \`battlemetrics.com/servers/rust/{ID}\``)
        ]
      });
      return;
    }

    const capacity = `${server.players}/${server.maxPlayers}`;
    const percentageFull = server.maxPlayers > 0 ? Math.round((server.players / server.maxPlayers) * 100) : 0;

    const embed = new EmbedBuilder()
      .setColor(0xD4542C)
      .setTitle(`🦀 ${server.hostname}`)
      .addFields(
        { 
          name: '👥 Players', 
          value: `${capacity} (${percentageFull}%)`, 
          inline: true 
        },
        { 
          name: '📦 Version', 
          value: server.version || 'Unknown', 
          inline: true 
        },
        { 
          name: '⏱️ Response Time', 
          value: server.responseTime ? `${server.responseTime}ms` : 'N/A', 
          inline: true 
        },
        {
          name: '🗺️ Map',
          value: server.map || 'Unknown',
          inline: false
        },
        {
          name: '📊 Status',
          value: server.online ? '✅ Online' : '❌ Offline',
          inline: true
        },
        {
          name: '🔗 Battlemetrics',
          value: `[View on Battlemetrics](https://www.battlemetrics.com/servers/rust/${serverId})`,
          inline: true
        }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.debug('Queried Rust server', {
      context: 'GameServer',
      serverId,
      players: server.players,
    });
  } catch (err) {
    logger.error('Failed to execute rustserver command', {
      context: 'GameServer',
      error: err,
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF5555)
          .setTitle('Error')
          .setDescription('An error occurred while querying the server. Please try again later.')
      ]
    });
  }
}
