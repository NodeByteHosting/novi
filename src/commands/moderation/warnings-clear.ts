import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField, EmbedBuilder } from 'discord.js';
import db from '../../lib/db';
import { hasModPermission } from '../../lib/modPermissions';

export const data = new SlashCommandBuilder()
  .setName('warnings-clear')
  .setDescription('Clear all warnings for a user')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
  .addUserOption((opt) =>
    opt
      .setName('user')
      .setDescription('User to clear warnings for')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('reason')
      .setDescription('Reason for clearing warnings')
      .setMinLength(1)
      .setMaxLength(100)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // Check if user has permission to warn
  const hasDiscordPerm = interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers);
  const hasModPerm = await hasModPermission(interaction.member as any, 'warn');

  if (!hasDiscordPerm && !hasModPerm) {
    return interaction.reply({ content: '❌ You lack permission to manage warnings.', flags: [64] });
  }

  const targetUser = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';

  try {
    // Get current warnings
    const warningsBefore = await db.getWarnings(interaction.guildId!, targetUser.id);
    const warningCount = warningsBefore.length;

    if (warningCount === 0) {
      return interaction.reply({
        content: `ℹ️ **${targetUser.tag}** has no warnings to clear.`,
        flags: [64]
      });
    }

    // Clear all warnings
    const cleared = await db.clearWarnings(interaction.guildId!, targetUser.id);

    if (!cleared) {
      return interaction.reply({
        content: '❌ Failed to clear warnings.',
        flags: [64]
      });
    }

    // Log the action
    await db.logModeration('warnings-clear', interaction.guildId!, interaction.user.id, targetUser.id, reason);

    // Send to mod logs
    const config = await db.getGuildConfig(interaction.guildId!);
    const logsChannelId = config?.logsChannelId;
    const logsChannel = interaction.guild?.channels.cache.get(logsChannelId!) as any;
    
    if (logsChannel) {
      const embed = new EmbedBuilder()
        .setColor(0x00AA00)
        .setTitle('✅ Warnings Cleared')
        .addFields(
          { name: 'User', value: `${targetUser.toString()} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: `${interaction.user.toString()}`, inline: true },
          { name: 'Warnings Removed', value: warningCount.toString(), inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `ID: ${targetUser.id}` });
      
      await logsChannel.send({ embeds: [embed] }).catch(() => null);
    }

    return interaction.reply({
      content: `✅ Cleared **${warningCount}** warning(s) for **${targetUser.tag}**`
    });
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: '❌ Failed to clear warnings.',
      flags: [64]
    });
  }
}
