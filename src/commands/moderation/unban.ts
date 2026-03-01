import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField, TextChannel } from 'discord.js';
import db from '../../lib/db';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
  .addStringOption((o) => o.setName('userid').setDescription('User ID to unban').setMinLength(17).setMaxLength(20).setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setMinLength(1).setMaxLength(100).setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.BanMembers))
    return interaction.reply({ content: '❌ You lack permission to unban members.', flags: [64] });

  const userId = interaction.options.getString('userid', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';

  try {
    // Fetch ban to verify user is banned
    const ban = await interaction.guild?.bans.fetch(userId).catch(() => null);
    if (!ban) {
      return interaction.reply({ content: '❌ User is not banned or ID is invalid.', flags: [64] });
    }

    // Unban the user
    await interaction.guild?.bans.remove(userId, `${interaction.user.tag}: ${reason}`);

    // Fetch user info
    const user = await interaction.client.users.fetch(userId).catch(() => null);

    // Log to database
    await db.logModeration('unban', interaction.guild!.id, interaction.user.id, userId, reason);

    // Send to mod logs channel
    const config = await db.getGuildConfig(interaction.guildId!);
    const logsChannelId = config?.logsChannelId;
    const logsChannel = interaction.guild?.channels.cache.get(logsChannelId!) as TextChannel;
    if (user) {
      await db.sendModLog(logsChannel, 'unban', interaction.user, user, reason);
    }

    await interaction.reply({ 
      content: `✅ Unbanned **${user?.tag || userId}** — ${reason}` 
    });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: '❌ Failed to unban user. Check my permissions.', flags: [64] });
  }
}
