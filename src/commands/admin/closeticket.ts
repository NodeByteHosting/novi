import { ChatInputCommandInteraction, SlashCommandBuilder, ThreadChannel, GuildMember } from 'discord.js';
import db from '../../lib/db';
import { performTicketClose } from '../../lib/ticketClose';
import { canManageTicket } from '../../lib/tickets';

export const data = new SlashCommandBuilder()
  .setName('closeticket')
  .setDescription('Close the current support ticket')
  .setDMPermission(false)
  .addStringOption(opt =>
    opt
      .setName('reason')
      .setDescription('Reason for closing the ticket')
      .setRequired(true)
      .setMinLength(5)
      .setMaxLength(500)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const ticketThread = interaction.channel as ThreadChannel;

  if (!ticketThread?.isThread()) {
    return interaction.reply({
      content: '❌ This command can only be used inside a ticket thread.',
      flags: [64]
    });
  }

  const ticket = await db.getTicket(ticketThread.id);
  if (!ticket) {
    return interaction.reply({ content: '❌ This is not a recognised ticket thread.', flags: [64] });
  }

  const member = interaction.member as GuildMember;
  const canCloseTicket = await canManageTicket(member, ticket, true);

  if (!canCloseTicket) {
    return interaction.reply({
      content: '❌ Only the ticket creator or assigned team can close this ticket.',
      flags: [64]
    });
  }

  const reason = interaction.options.getString('reason', true);

  await interaction.reply({ content: '🔒 Closing ticket and generating transcript...', flags: [64] });

  const result = await performTicketClose(
    ticketThread,
    interaction.user,
    reason,
    interaction.client
  );

  if (!result.success) {
    await interaction.followUp({ content: result.error ?? '❌ Failed to close ticket.', flags: [64] });
  }
}
