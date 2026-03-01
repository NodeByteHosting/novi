import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { queryHytaleServer, parseGameServerIdentifier } from '../lib/gameServer';
import { logger } from '../lib/logger';

export const data = new SlashCommandBuilder()
  .setName('hytaleserver')
  .setDescription('Look up a Hytale server information')
  .addStringOption(option =>
    option
      .setName('server')
      .setDescription('Server address (hostname:port or just hostname)')
      .setRequired(true)
  )
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const serverInput = interaction.options.getString('server', true);
  const parsed = parseGameServerIdentifier(serverInput, 12345);

  if (!parsed) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF5555)
          .setTitle('Invalid Server Address')
          .setDescription('Please provide a valid address in format: `hostname:port` or just `hostname`\n\nExample: `hytale.example.com:12345`')
      ]
    });
    return;
  }

  try {
    const server = await queryHytaleServer(parsed.host, parsed.port);

    if (!server || !server.online) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('Server Offline or Unreachable')
            .setDescription(`Could not reach server: \`${parsed.host}:${parsed.port}\`\n\nThe server is either offline, the address is incorrect, or Hytale's status API is unavailable.`)
        ]
      });
      return;
    }

    const capacity = `${server.players}/${server.maxPlayers}`;
    const percentageFull = server.maxPlayers > 0 ? Math.round((server.players / server.maxPlayers) * 100) : 0;

    const embed = new EmbedBuilder()
      .setColor(0x3256D9)
      .setTitle(`🎮 ${server.hostname}`)
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
          name: '🗺️ World/Map',
          value: server.map || 'Unknown',
          inline: false
        },
        {
          name: '📊 Status',
          value: server.online ? '✅ Online' : '❌ Offline',
          inline: true
        },
        {
          name: '🔗 Address',
          value: `\`${parsed.host}:${parsed.port}\``,
          inline: true
        }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag} | Hytale is in development` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.debug('Queried Hytale server', {
      context: 'GameServer',
      host: parsed.host,
      port: parsed.port,
      players: server.players,
    });
  } catch (err) {
    logger.error('Failed to execute hytaleserver command', {
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
