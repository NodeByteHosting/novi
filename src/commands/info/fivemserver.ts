import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getFiveMServerInfo, parseFiveMServerIdentifier, FiveMPlayer } from '../lib/gameServer';
import { logger } from '../lib/logger';

export const data = new SlashCommandBuilder()
  .setName('fivemserver')
  .setDescription('Look up a FiveM server information')
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
    const server = await getFiveMServerInfo(serverIdentifier);

    if (!server) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF5555)
            .setTitle('Server Not Found')
            .setDescription(`Could not find server: \`${serverIdentifier}\`\n\nMake sure the server is online and the identifier is correct.`)
        ]
      });
      return;
    }

    const players = server.players || [];
    const uptime = server.uptime ? Math.floor(server.uptime / 1000) : 0;
    const uptimeText = uptime > 0 
      ? `${uptime} seconds (${Math.floor(uptime / 3600)} hours)`
      : 'Unknown';

    const embed = new EmbedBuilder()
      .setColor(0x3BB98E)
      .setTitle(server.hostname || 'FiveM Server')
      .addFields(
        { 
          name: '👥 Players', 
          value: `${server.clients}/${server.maxClients}`, 
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
          name: '⏱️ Uptime', 
          value: uptimeText, 
          inline: true 
        },
        { 
          name: '📡 OneSync', 
          value: server.oneSync || server.onesyncEnabled ? 'Enabled' : 'Disabled', 
          inline: true 
        },
        { 
          name: '🔐 Private Slots', 
          value: server.privateClients?.toString() || '0', 
          inline: true 
        }
      );

    // Add player list if there are players
    if (players.length > 0) {
      const playerList = players
        .slice(0, 10)
        .map((p: FiveMPlayer, i: number) => `${i + 1}. **${p.name}** (ID: ${p.id}, Ping: ${p.ping}ms)`)
        .join('\n');

      const moreText = players.length > 10 ? `\n\n*... and ${players.length - 10} more*` : '';

      embed.addFields({
        name: '👨‍💼 Players Online',
        value: playerList + moreText,
        inline: false
      });
    } else {
      embed.addFields({
        name: '👨‍💼 Players Online',
        value: 'No players currently online',
        inline: false
      });
    }

    // Add first 15 resources if available
    if (server.resources && server.resources.length > 0) {
      const resourceList = server.resources
        .slice(0, 15)
        .map((r: string) => `\`${r}\``)
        .join(', ');

      const moreText = server.resources.length > 15 ? ` +${server.resources.length - 15} more` : '';

      embed.addFields({
        name: '📦 Resources',
        value: resourceList + moreText,
        inline: false
      });
    }

    embed
      .setFooter({ text: `Requested by ${interaction.user.tag} | Server ID: ${serverIdentifier}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.debug('Fetched FiveM server info', {
      context: 'FiveM',
      serverIdentifier,
      players: server.clients,
    });
  } catch (err) {
    logger.error('Failed to execute fivemserver command', {
      context: 'FiveM',
      error: err,
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF5555)
          .setTitle('Error')
          .setDescription('An error occurred while fetching server information. Please try again later.')
      ]
    });
  }
}
