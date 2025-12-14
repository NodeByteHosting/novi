import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField, TextChannel } from 'discord.js';
import db from '../../lib/db';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a user')
  .addUserOption((o) => o.setName('target').setDescription('User to ban').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.BanMembers))
    return interaction.reply({ content: '❌ You lack permission to ban members.', flags: [64] });

  const target = interaction.options.getUser('target', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';

  if (target.id === interaction.user.id)
    return interaction.reply({ content: '❌ You cannot ban yourself.', flags: [64] });

  if (target.id === interaction.client.user?.id)
    return interaction.reply({ content: '❌ I cannot ban myself.', flags: [64] });

  const member = await interaction.guild?.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ Member not found in guild.', flags: [64] });

  // Check role hierarchy
  if (member.roles.highest.position >= (interaction.member as any).roles.highest.position)
    return interaction.reply({ content: '❌ You cannot ban someone with an equal or higher role.', flags: [64] });

  try {
    // Send DM first before banning
    const dmSent = await db.sendDM(target, 'banned', interaction.guild?.name || 'Unknown Server', reason, interaction.user);

    // Ban the user
    await member.ban({ reason: `${interaction.user.tag}: ${reason}` });

    // Log to database
    await db.logModeration('ban', interaction.guild!.id, interaction.user.id, target.id, reason);

    // Send to mod logs channel
    const logsChannelId = process.env.LOGS_CHANNEL_ID;
    const logsChannel = interaction.guild?.channels.cache.get(logsChannelId as string) as TextChannel;
    await db.sendModLog(logsChannel, 'ban', interaction.user, target, reason);

    await interaction.reply({ 
      content: `✅ Banned **${target.tag}** — ${reason}${!dmSent ? '\n⚠️ Could not DM user.' : ''}` 
    });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: '❌ Failed to ban user. Check my permissions and role hierarchy.', flags: [64] });
  }
}
