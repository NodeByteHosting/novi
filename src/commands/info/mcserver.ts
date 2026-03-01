import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { queryMinecraftServer, parseGameServerIdentifier } from '../../lib/gameServer';
import { logger } from '../../lib/logger';

export const data = new SlashCommandBuilder()
  .setName('mcserver')
  .setDescription('Look up a Minecraft server information')
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
  const parsed = parseGameServerIdentifier(serverInput, 25565);

  if (!parsed) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF5555)
          .setTitle('Invalid Server Address')
          .setDescription('Please provide a valid address in format: `hostname:port` or just `hostname`\n\nExample: `mc.example.com:25565`')
      ]
    });
    return;
  }

  try {
    const server = await queryMinecraftServer(parsed.host, parsed.port);

    if (!server || !server.online) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF5555)
            .setTitle('Server Offline')
            .setDescription(`Could not reach server: \`${parsed.host}:${parsed.port}\`\n\nThe server is either offline or the address is incorrect.`)
        ]
      });
      return;
    }

    const capacity = `${server.players}/${server.maxPlayers}`;
    const percentageFull = Math.round((server.players / server.maxPlayers) * 100);

    const embed = new EmbedBuilder()
      .setColor(0x3BB98E)
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
          value: `${server.responseTime}ms`, 
          inline: true 
        },
        {
          name: '🗺️ MOTD',
          value: server.motd || 'No MOTD',
          inline: false
        },
        {
          name: '📍 Map',
          value: server.map || 'Unknown',
          inline: false
        },
        {
          name: '🔗 Address',
          value: `\`${parsed.host}:${parsed.port}\``,
          inline: false
        }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.debug('Queried Minecraft server', {
      context: 'GameServer',
      host: parsed.host,
      port: parsed.port,
      players: server.players,
    });
  } catch (err) {
    logger.error('Failed to execute mcserver command', {
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
