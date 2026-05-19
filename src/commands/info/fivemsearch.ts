import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { lookupFiveMServers, FiveMServer } from '../../lib/gameServer';
import { logger } from '../../lib/logger';

export const data = new SlashCommandBuilder()
  .setName('fivemsearch')
  .setDescription('Look up multiple FiveM servers by their CFX codes')
  .addStringOption(option =>
    option
      .setName('codes')
      .setDescription('CFX join codes separated by spaces (e.g. pmdoa5 abc123 xyz789)')
      .setRequired(true)
  )
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const input = interaction.options.getString('codes', true);
  const codes = input.trim().split(/[\s,]+/).filter(c => /^[a-zA-Z0-9]{3,10}$/.test(c));

  if (codes.length === 0) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF5555)
          .setTitle('Invalid Input')
          .setDescription(
            'Please provide valid CFX join codes separated by spaces.\n\n' +
            '**Example:** `/fivemsearch pmdoa5 abc123`\n\n' +
            'You can find server codes from [servers.fivem.net](https://servers.fivem.net) or `cfx.re/join/` links.'
          )
      ]
    });
    return;
  }

  if (codes.length > 10) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF5555)
          .setTitle('Too Many Codes')
          .setDescription('Please provide at most 10 server codes at a time.')
      ]
    });
    return;
  }

  try {
    const servers = await lookupFiveMServers(codes);

    if (servers.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF5555)
            .setTitle('No Servers Found')
            .setDescription(`Could not find any of the provided servers. Make sure the CFX codes are correct.`)
        ]
      });
      return;
    }

    const embeds = servers.slice(0, 10).map((server: FiveMServer, index: number) => {
      const playerPercentage = server.maxClients > 0
        ? Math.round((server.clients / server.maxClients) * 100)
        : 0;

      return new EmbedBuilder()
        .setColor(server.clients > 0 ? 0x3BB98E : 0xFFA500)
        .setTitle(`#${index + 1} — ${server.hostname || 'Unknown Server'}`)
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
            value: server.resources.length.toString(),
            inline: true
          },
          {
            name: '📡 OneSync',
            value: server.onesyncEnabled ? '✓' : '✗',
            inline: true
          },
          {
            name: '🏷️ CFX Code',
            value: `\`${server.endpoint}\` ([Join](https://cfx.re/join/${server.endpoint}))`,
            inline: true
          },
        )
        .setFooter({ text: `Owner: ${server.ownerName} • Result ${index + 1}/${servers.length}` })
        .setTimestamp();
    });

    // Discord allows up to 10 embeds per message
    await interaction.editReply({ embeds: embeds.slice(0, 10) });

    logger.debug('FiveM multi-server lookup completed', {
      context: 'FiveM',
      codesRequested: codes.length,
      serversFound: servers.length,
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
          .setDescription('An error occurred while looking up servers. Please try again later.')
      ]
    });
  }
}
