import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getFiveMServerInfo, parseFiveMServerIdentifier, FiveMPlayer } from '../../lib/gameServer';
import { logger } from '../../lib/logger';

export const data = new SlashCommandBuilder()
  .setName('fivemserver')
  .setDescription('Look up a FiveM server information')
  .addStringOption(option =>
    option
      .setName('server')
      .setDescription('CFX join code (e.g. pmdoa5) or cfx.re/join URL')
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
          .setDescription(
            'Please provide a valid CFX join code or `cfx.re/join/...` URL.\n\n' +
            '**Examples:**\n' +
            '• `/fivemserver pmdoa5`\n' +
            '• `/fivemserver https://cfx.re/join/pmdoa5`\n\n' +
            'You can find server codes from [servers.fivem.net](https://servers.fivem.net) or `cfx.re/join/` links.'
          )
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
            .setDescription(`Could not find server: \`${serverIdentifier}\`\n\nMake sure the server is online and the CFX code is correct.`)
        ]
      });
      return;
    }

    const players = server.players || [];
    const lastSeenDate = server.lastSeen ? new Date(server.lastSeen) : null;
    const lastSeenText = lastSeenDate ? `<t:${Math.floor(lastSeenDate.getTime() / 1000)}:R>` : 'Unknown';

    const embed = new EmbedBuilder()
      .setColor(0x3BB98E)
      .setTitle(server.hostname || 'FiveM Server')
      .setDescription(server.projectDesc || null)
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
          name: '⏱️ Last Seen', 
          value: lastSeenText, 
          inline: true 
        },
        { 
          name: '📡 OneSync', 
          value: server.onesyncEnabled ? 'Enabled' : 'Disabled', 
          inline: true 
        },
        {
          name: '🔒 Private',
          value: server.isPrivate ? 'Yes' : 'No',
          inline: true
        },
        {
          name: '️ CFX Code',
          value: `\`${server.endpoint}\` ([Join](https://cfx.re/join/${server.endpoint}))`,
          inline: true
        },
        {
          name: '🛠️ Server Version',
          value: server.version || 'Unknown',
          inline: false
        }
      );

    // Add tags if available
    if (server.tags.length > 0) {
      embed.addFields({
        name: '🏷️ Tags',
        value: server.tags.map(t => `\`${t}\``).join(', '),
        inline: false
      });
    }

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
    if (server.resources.length > 0) {
      const resourceList = server.resources
        .slice(0, 15)
        .map((r: string) => `\`${r}\``)
        .join(', ');

      const moreText = server.resources.length > 15 ? ` +${server.resources.length - 15} more` : '';

      embed.addFields({
        name: `📦 Resources (${server.resources.length})`,
        value: resourceList + moreText,
        inline: false
      });
    }

    // Set owner info & banner
    if (server.bannerUrl) {
      embed.setImage(server.bannerUrl);
    }
    if (server.ownerAvatar) {
      embed.setThumbnail(server.ownerAvatar);
    }

    embed
      .setFooter({ text: `Owner: ${server.ownerName} • Requested by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.debug('Fetched FiveM server info', {
      context: 'FiveM',
      cfxCode: server.endpoint,
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
