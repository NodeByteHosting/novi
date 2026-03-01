import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { getFiveMServerResources, parseFiveMServerIdentifier } from '../../lib/gameServer';
import { logger } from '../../lib/logger';

export const data = new SlashCommandBuilder()
  .setName('fivemresources')
  .setDescription('View FiveM server resources and scripts')
  .addStringOption(option =>
    option
      .setName('server')
      .setDescription('CFX join code (e.g. pmdoa5) or cfx.re/join URL')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('page')
      .setDescription('Page number to start on')
      .setMinValue(1)
      .setRequired(false)
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
            '• `/fivemresources pmdoa5`\n' +
            '• `/fivemresources https://cfx.re/join/pmdoa5`'
          )
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

    // Build pages (25 resources per page for readability)
    const itemsPerPage = 25;
    const totalPages = Math.ceil(resources.length / itemsPerPage);

    function buildPage(pageIndex: number): EmbedBuilder {
      const start = pageIndex * itemsPerPage;
      const pageResources = resources!.slice(start, start + itemsPerPage);
      const resourceList = pageResources
        .map((r: string, idx: number) => `\`${start + idx + 1}.\` ${r}`)
        .join('\n');

      return new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle(`📦 Server Resources — ${serverIdentifier}`)
        .setDescription(resourceList)
        .setFooter({
          text: `Page ${pageIndex + 1} of ${totalPages} • ${resources!.length} total resources`,
        })
        .setTimestamp();
    }

    function buildButtons(pageIndex: number): ActionRowBuilder<ButtonBuilder> {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('res_first')
          .setEmoji('⏮')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === 0),
        new ButtonBuilder()
          .setCustomId('res_prev')
          .setEmoji('◀')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex === 0),
        new ButtonBuilder()
          .setCustomId('res_page')
          .setLabel(`${pageIndex + 1} / ${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('res_next')
          .setEmoji('▶')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex === totalPages - 1),
        new ButtonBuilder()
          .setCustomId('res_last')
          .setEmoji('⏭')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === totalPages - 1),
      );
    }

    // Determine starting page
    const requestedPage = interaction.options.getInteger('page');
    let currentPage = requestedPage ? Math.min(Math.max(requestedPage - 1, 0), totalPages - 1) : 0;

    const message = await interaction.editReply({
      embeds: [buildPage(currentPage)],
      components: totalPages > 1 ? [buildButtons(currentPage)] : [],
    });

    // No pagination needed for single page
    if (totalPages <= 1) return;

    // Collect button interactions for 3 minutes
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: 180_000,
    });

    collector.on('collect', async (btnInteraction) => {
      switch (btnInteraction.customId) {
        case 'res_first':
          currentPage = 0;
          break;
        case 'res_prev':
          currentPage = Math.max(0, currentPage - 1);
          break;
        case 'res_next':
          currentPage = Math.min(totalPages - 1, currentPage + 1);
          break;
        case 'res_last':
          currentPage = totalPages - 1;
          break;
      }

      await btnInteraction.update({
        embeds: [buildPage(currentPage)],
        components: [buildButtons(currentPage)],
      });
    });

    collector.on('end', async () => {
      // Disable all buttons when collector expires
      try {
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('res_first').setEmoji('⏮').setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId('res_prev').setEmoji('◀').setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('res_page').setLabel(`${currentPage + 1} / ${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId('res_next').setEmoji('▶').setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('res_last').setEmoji('⏭').setStyle(ButtonStyle.Secondary).setDisabled(true),
        );
        await interaction.editReply({ components: [disabledRow] });
      } catch {
        // Message may have been deleted
      }
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
