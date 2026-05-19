import { ChatInputCommandInteraction, SlashCommandBuilder, ThreadChannel, GuildMember } from 'discord.js';
import db from '../../lib/db';
import { canManageTicket } from '../../lib/tickets';

export const data = new SlashCommandBuilder()
  .setName('ticketadduser')
  .setDescription('Add a user to the current ticket thread')
  .setDMPermission(false)
  .addUserOption((opt) =>
    opt
      .setName('user')
      .setDescription('User to add to the ticket')
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
  const canAddUsers = await canManageTicket(member, ticket, false);
  if (!canAddUsers) {
    return interaction.reply({
      content: '❌ Only the assigned team can add users to this ticket.',
      flags: [64]
    });
  }

  if (ticket.status === 'closed') {
    return interaction.reply({
      content: '❌ Reopen this ticket before adding users.',
      flags: [64]
    });
  }

  const targetUser = interaction.options.getUser('user', true);

  if (targetUser.id === ticket.userId) {
    return interaction.reply({
      content: '❌ The ticket creator already has access to this ticket.',
      flags: [64]
    });
  }

  try {
    await ticketThread.members.add(targetUser.id);
    return interaction.reply({
      content: `✅ Added ${targetUser.toString()} to this ticket.`,
      flags: [64]
    });
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: '❌ Failed to add that user to the ticket.',
      flags: [64]
    });
  }
}
