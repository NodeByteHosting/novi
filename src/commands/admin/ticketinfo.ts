import { ChatInputCommandInteraction, SlashCommandBuilder, ThreadChannel, GuildMember, EmbedBuilder } from 'discord.js';
import db from '../../lib/db';
import { canManageTicket, getTicketCategoryLabel } from '../../lib/tickets';
import { createTranscriptUrl } from '../../lib/transcriptServer';

function toDiscordTimestamp(date: Date | null): string {
  if (!date) return '—';
  return `<t:${Math.floor(date.getTime() / 1000)}:f>`;
}

export const data = new SlashCommandBuilder()
  .setName('ticketinfo')
  .setDescription('View information about the current ticket')
  .setDMPermission(false);

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
  const canViewTicket = await canManageTicket(member, ticket, true);
  if (!canViewTicket) {
    return interaction.reply({
      content: '❌ Only the ticket creator or assigned team can view ticket info.',
      flags: [64]
    });
  }

  const [creatorUser, claimedByUser, closedByUser, transcript] = await Promise.all([
    interaction.client.users.fetch(ticket.userId).catch(() => null),
    ticket.claimedBy ? interaction.client.users.fetch(ticket.claimedBy).catch(() => null) : Promise.resolve(null),
    ticket.closedBy ? interaction.client.users.fetch(ticket.closedBy).catch(() => null) : Promise.resolve(null),
    db.getTranscriptByThreadId(ticket.threadId)
  ]);

  const transcriptUrl = transcript ? createTranscriptUrl(transcript.slug) : null;
  const openingSummary = ticket.createMsg
    ? ticket.createMsg.length > 500
      ? `${ticket.createMsg.slice(0, 497)}...`
      : ticket.createMsg
    : 'No opening message recorded.';

  const embed = new EmbedBuilder()
    .setColor(0x3256d9)
    .setTitle('Ticket Information')
    .addFields(
      { name: 'Category', value: getTicketCategoryLabel(ticket.category), inline: true },
      { name: 'Status', value: ticket.status, inline: true },
      { name: 'Thread ID', value: ticket.threadId, inline: true },
      { name: 'Created By', value: creatorUser ? creatorUser.toString() : `<@${ticket.userId}>`, inline: true },
      { name: 'Claimed By', value: claimedByUser ? claimedByUser.toString() : (ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Unclaimed'), inline: true },
      { name: 'Created At', value: toDiscordTimestamp(ticket.createdAt), inline: true },
      { name: 'Closed By', value: closedByUser ? closedByUser.toString() : (ticket.closedBy ? `<@${ticket.closedBy}>` : '—'), inline: true },
      { name: 'Closed At', value: toDiscordTimestamp(ticket.closedAt), inline: true },
      { name: 'Transcript', value: transcriptUrl ? `[View Transcript](${transcriptUrl})` : 'No transcript generated yet.', inline: true },
      { name: 'Opening Message', value: openingSummary, inline: false }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed], flags: [64] });
}
