import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import db from '../../lib/db';
import { hasModPermission } from '../../lib/modPermissions';

export const data = new SlashCommandBuilder()
  .setName('warn-remove')
  .setDescription('Remove a specific warning from a user')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
  .addUserOption((opt) =>
    opt
      .setName('user')
      .setDescription('User to remove warning from')
      .setRequired(true)
  )
  .addIntegerOption((opt) =>
    opt
      .setName('warning-id')
      .setDescription('Warning ID to remove (use /warnings to find)')
      .setMinValue(1)
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // Check if user has permission to warn
  const hasDiscordPerm = interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers);
  const hasModPerm = await hasModPermission(interaction.member as any, 'warn');

  if (!hasDiscordPerm && !hasModPerm) {
    return interaction.reply({ content: '❌ You lack permission to manage warnings.', flags: [64] });
  }

  const targetUser = interaction.options.getUser('user', true);
  const warningId = interaction.options.getInteger('warning-id', true);

  try {
    // Verify the warning exists and belongs to this guild/user
    const warnings = await db.getWarnings(interaction.guildId!, targetUser.id);
    const warning = warnings.find(w => w.id === warningId);

    if (!warning) {
      return interaction.reply({
        content: `❌ Warning ID ${warningId} not found for ${targetUser.tag}.`,
        flags: [64]
      });
    }

    // Remove the warning
    const removed = await db.removeWarning(warningId);

    if (!removed) {
      return interaction.reply({
        content: '❌ Failed to remove warning.',
        flags: [64]
      });
    }

    // Log the removal
    await db.logModeration('warn-remove', interaction.guildId!, interaction.user.id, targetUser.id, `Removed warning: ${warning.reason}`);

    // Send to mod logs
    const config = await db.getGuildConfig(interaction.guildId!);
    const logsChannelId = config?.logsChannelId;
    const logsChannel = interaction.guild?.channels.cache.get(logsChannelId!) as any;
    
    if (logsChannel) {
      const { EmbedBuilder } = await import('discord.js');
      const embed = new EmbedBuilder()
        .setColor(0x00AA00)
        .setTitle('⚠️ Warning Removed')
        .addFields(
          { name: 'User', value: `${targetUser.toString()} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: `${interaction.user.toString()}`, inline: true },
          { name: 'Warning ID', value: warningId.toString(), inline: true },
          { name: 'Removed Reason', value: warning.reason, inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `ID: ${targetUser.id}` });
      
      await logsChannel.send({ embeds: [embed] }).catch(() => null);
    }

    return interaction.reply({
      content: `✅ Removed warning **#${warningId}** from **${targetUser.tag}**`
    });
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: '❌ Failed to remove warning.',
      flags: [64]
    });
  }
}
