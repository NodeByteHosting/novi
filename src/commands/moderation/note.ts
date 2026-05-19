import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField, EmbedBuilder } from 'discord.js';
import db from '../../lib/db';
import { hasModPermission } from '../../lib/modPermissions';

export const data = new SlashCommandBuilder()
  .setName('note')
  .setDescription('Add a moderation note to a user (internal record)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
  .addUserOption((opt) =>
    opt
      .setName('user')
      .setDescription('User to add note for')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('note')
      .setDescription('Note content')
      .setMinLength(1)
      .setMaxLength(500)
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // Check if user has permission to add notes (any mod permission works)
  const hasDiscordPerm = interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers);
  const hasModPerm = await hasModPermission(interaction.member as any, 'warn');

  if (!hasDiscordPerm && !hasModPerm) {
    return interaction.reply({ content: '❌ You lack permission to add moderation notes.', flags: [64] });
  }

  const targetUser = interaction.options.getUser('user', true);
  const noteContent = interaction.options.getString('note', true);

  try {
    // Add the note
    const note = await db.addModNote(interaction.guildId!, interaction.user.id, targetUser.id, noteContent);

    if (!note) {
      return interaction.reply({
        content: '❌ Failed to add note.',
        flags: [64]
      });
    }

    // Send to mod logs
    const config = await db.getGuildConfig(interaction.guildId!);
    const logsChannelId = config?.logsChannelId;
    const logsChannel = interaction.guild?.channels.cache.get(logsChannelId!) as any;
    
    if (logsChannel) {
      const embed = new EmbedBuilder()
        .setColor(0x9900FF)
        .setTitle('📝 Moderation Note Added')
        .addFields(
          { name: 'User', value: `${targetUser.toString()} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: `${interaction.user.toString()}`, inline: true },
          { name: 'Note ID', value: note.id.toString(), inline: true },
          { name: 'Content', value: noteContent, inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `ID: ${targetUser.id}` });
      
      await logsChannel.send({ embeds: [embed] }).catch(() => null);
    }

    return interaction.reply({
      content: `✅ Added note **#${note.id}** for **${targetUser.tag}**`,
      flags: [64]
    });
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: '❌ Failed to add note.',
      flags: [64]
    });
  }
}
