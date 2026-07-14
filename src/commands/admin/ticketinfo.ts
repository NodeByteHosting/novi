import { ChatInputCommandInteraction, SlashCommandBuilder, ThreadChannel, GuildMember, EmbedBuilder, Role } from 'discord.js';
import db from '../../lib/db';
import { canManageTicket, getTicketCategoryLabel, getTicketHandlerRoleIds } from '../../lib/tickets';
import { createTranscriptUrl } from '../../lib/transcriptServer';

function toDiscordTimestamp(date: Date | null): string {
  if (!date) return '—';
  return `<t:${Math.floor(date.getTime() / 1000)}:f>`;
}

function getStatusEmoji(status: string): string {
  const statusEmojis: Record<string, string> = {
    open: '🟢',
    claimed: '🟡',
    closed: '🔴'
  };
  return statusEmojis[status] || '⚪';
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

  // Get assigned team role IDs
  const assignedRoleIds = await getTicketHandlerRoleIds(interaction.guildId!, ticket.category);
  let assignedTeamStr = 'No team assigned';
  
  if (assignedRoleIds.length > 0) {
    const roles = assignedRoleIds
      .map(roleId => interaction.guild?.roles.cache.get(roleId))
      .filter(role => role !== undefined) as Role[];
    
    if (roles.length > 0) {
      assignedTeamStr = roles.map(r => r.toString()).join(', ');
    } else {
      assignedTeamStr = `${assignedRoleIds.length} team role(s) (hidden or deleted)`;
    }
  }

  // Transcript status
  let transcriptStatus: string;
  let transcriptValue: string;
  
  if (transcript) {
    transcriptStatus = '✅ Generated';
    transcriptValue = `[View Transcript](${createTranscriptUrl(transcript.slug)})`;
  } else if (ticket.status === 'closed') {
    transcriptStatus = '⚠️ Not Generated (Ticket Closed)';
    transcriptValue = 'Transcript was not created before closing.';
  } else {
    transcriptStatus = '⏳ Not Generated Yet';
    transcriptValue = 'Transcript will be generated when ticket is closed.';
  }

  const openingSummary = ticket.createMsg
    ? ticket.createMsg.length > 500
      ? `${ticket.createMsg.slice(0, 497)}...`
      : ticket.createMsg
    : 'No opening message recorded.';

  const statusEmoji = getStatusEmoji(ticket.status);
  const statusDisplay = `${statusEmoji} ${ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}`;
  const claimedDisplay = claimedByUser 
    ? `${claimedByUser.toString()} ✅` 
    : (ticket.claimedBy ? `<@${ticket.claimedBy}> ✅` : '❌ Unclaimed');

  const embed = new EmbedBuilder()
    .setColor(ticket.status === 'open' ? 0x00AA00 : ticket.status === 'claimed' ? 0xFFAA00 : 0xFF0000)
    .setTitle('🎫 Ticket Information')
    .addFields(
      { name: 'Category', value: getTicketCategoryLabel(ticket.category), inline: true },
      { name: 'Status', value: statusDisplay, inline: true },
      { name: 'Thread ID', value: ticket.threadId, inline: true },
      { name: '👤 Created By', value: creatorUser ? creatorUser.toString() : `<@${ticket.userId}>`, inline: true },
      { name: '🔗 Assigned Team', value: assignedTeamStr, inline: true },
      { name: '✋ Claimed By', value: claimedDisplay, inline: true },
      { name: '📅 Created At', value: toDiscordTimestamp(ticket.createdAt), inline: true },
      { name: '📋 Times', value: `Created: <t:${Math.floor(ticket.createdAt.getTime() / 1000)}:R>\n${ticket.closedAt ? `Closed: <t:${Math.floor(ticket.closedAt.getTime() / 1000)}:R>` : 'Still Open'}`, inline: true },
      { name: '🔐 Closed By', value: closedByUser ? closedByUser.toString() : (ticket.closedBy ? `<@${ticket.closedBy}>` : '—'), inline: true },
      { name: `📄 Transcript (${transcriptStatus})`, value: transcriptValue, inline: false },
      { name: '💬 Opening Message', value: openingSummary, inline: false }
    )
    .setTimestamp()
    .setFooter({ text: `Ticket #${ticket.id}` });

  return interaction.reply({ embeds: [embed], flags: [64] });
}
