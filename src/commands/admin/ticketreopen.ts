import { ChatInputCommandInteraction, SlashCommandBuilder, ThreadChannel, GuildMember, TextChannel, EmbedBuilder } from 'discord.js';
import db from '../../lib/db';
import { addAssignedOnlineMembersToThread, canManageTicket, getTicketCategoryLabel } from '../../lib/tickets';

export const data = new SlashCommandBuilder()
  .setName('ticketreopen')
  .setDescription('Reopen the current closed ticket')
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
  const canReopenTicket = await canManageTicket(member, ticket, true);
  if (!canReopenTicket) {
    return interaction.reply({
      content: '❌ Only the ticket creator or assigned team can reopen this ticket.',
      flags: [64]
    });
  }

  if (ticket.status !== 'closed') {
    return interaction.reply({
      content: '❌ This ticket is not closed.',
      flags: [64]
    });
  }

  await interaction.reply({ content: '🔓 Reopening ticket...', flags: [64] });

  try {
    const reopenedTicket = await db.reopenTicket(ticketThread.id);
    if (!reopenedTicket) {
      return interaction.followUp({ content: '❌ Failed to reopen ticket.', flags: [64] });
    }

    if (ticketThread.archived) {
      await ticketThread.setArchived(false);
    }

    // Add ticket creator
    await ticketThread.members.add(ticket.userId).catch(() => null);

    // Restore manually added users
    const addedUserIds = await db.getTicketAddedUsers(ticketThread.id);
    for (const userId of addedUserIds) {
      await ticketThread.members.add(userId).catch(() => null);
    }

    // Add assigned team members
    const parentChannel = ticketThread.parent as TextChannel | null;
    if (parentChannel) {
      await parentChannel.permissionOverwrites.create(ticket.userId, {
        SendMessagesInThreads: true,
        ViewChannel: true,
      }, { reason: `Ticket ${ticketThread.id} reopened` }).catch(() => null);
    }

    if (ticketThread.guild) {
      await addAssignedOnlineMembersToThread(ticketThread.guild, ticketThread, ticket.category);
    }

    const embed = new EmbedBuilder()
      .setColor(0x3256d9)
      .setTitle('🔓 Ticket Reopened')
      .setDescription(`This ${getTicketCategoryLabel(ticket.category)} ticket has been reopened by ${interaction.user.toString()}.`)
      .addFields(
        { name: 'Info', value: `${addedUserIds.length} previously added user(s) have been restored.`, inline: false }
      )
      .setTimestamp();

    await ticketThread.send({ embeds: [embed] }).catch(() => null);
  } catch (err) {
    console.error(err);
    await interaction.followUp({ content: '❌ Failed to reopen ticket.', flags: [64] }).catch(() => null);
  }
}
