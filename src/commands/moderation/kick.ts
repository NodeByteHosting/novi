import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField, TextChannel } from 'discord.js';
import db from '../../lib/db';
import { hasModPermission } from '../../lib/modPermissions';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a user from the server')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers)
  .addUserOption((o) => o.setName('target').setDescription('User to kick').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setMinLength(1).setMaxLength(100).setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const hasDiscordPerm = interaction.memberPermissions?.has(PermissionsBitField.Flags.KickMembers);
  const hasModPerm = await hasModPermission(interaction.member as any, 'kick');

  if (!hasDiscordPerm && !hasModPerm)
    return interaction.reply({ content: '❌ You lack permission to kick members.', flags: [64] });

  const target = interaction.options.getUser('target', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';

  if (target.id === interaction.user.id)
    return interaction.reply({ content: '❌ You cannot kick yourself.', flags: [64] });

  if (target.id === interaction.client.user?.id)
    return interaction.reply({ content: '❌ I cannot kick myself.', flags: [64] });

  const member = await interaction.guild?.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ Member not found in guild.', flags: [64] });

  // Check role hierarchy
  if (member.roles.highest.position >= (interaction.member as any).roles.highest.position)
    return interaction.reply({ content: '❌ You cannot kick someone with an equal or higher role.', flags: [64] });

  try {
    // Send DM first before kicking
    const dmSent = await db.sendDM(target, 'kicked', interaction.guild?.name || 'Unknown Server', reason, interaction.user);

    // Kick the user
    await member.kick(`${interaction.user.tag}: ${reason}`);

    // Log to database
    await db.logModeration('kick', interaction.guild!.id, interaction.user.id, target.id, reason);

    // Send to mod logs channel
    const config = await db.getGuildConfig(interaction.guildId!);
    const logsChannelId = config?.logsChannelId;
    const logsChannel = interaction.guild?.channels.cache.get(logsChannelId!) as TextChannel;
    await db.sendModLog(logsChannel, 'kick', interaction.user, target, reason);

    await interaction.reply({ 
      content: `✅ Kicked **${target.tag}** — ${reason}${!dmSent ? '\n⚠️ Could not DM user.' : ''}` 
    });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: '❌ Failed to kick user. Check my permissions and role hierarchy.', flags: [64] });
  }
}
