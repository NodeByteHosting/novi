import { ChatInputCommandInteraction, SlashCommandBuilder, ThreadChannel, GuildMember } from 'discord.js';
import db from '../../lib/db';
import { canManageTicket } from '../../lib/tickets';

export const data = new SlashCommandBuilder()
  .setName('ticketremoveuser')
  .setDescription('Remove a user from the current ticket thread')
  .setDMPermission(false)
  .addUserOption((opt) =>
    opt
      .setName('user')
      .setDescription('User to remove from the ticket')
      .setRequired(true)
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
  const canRemoveUsers = await canManageTicket(member, ticket, false);
  if (!canRemoveUsers) {
    return interaction.reply({
      content: '❌ Only the assigned team can remove users from this ticket.',
      flags: [64]
    });
  }

  const targetUser = interaction.options.getUser('user', true);

  if (targetUser.id === ticket.userId) {
    return interaction.reply({
      content: '❌ You cannot remove the ticket creator from their own ticket.',
      flags: [64]
    });
  }

  if (ticket.claimedBy === targetUser.id) {
    return interaction.reply({
      content: '❌ Unclaim the ticket before removing the current assignee.',
      flags: [64]
    });
  }

  try {
    await ticketThread.members.remove(targetUser.id);
    return interaction.reply({
      content: `✅ Removed ${targetUser.toString()} from this ticket.`,
      flags: [64]
    });
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: '❌ Failed to remove that user from the ticket.',
      flags: [64]
    });
  }
}
