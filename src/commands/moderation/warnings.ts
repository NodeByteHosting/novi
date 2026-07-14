import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField, EmbedBuilder } from 'discord.js';
import db from '../../lib/db';

export const data = new SlashCommandBuilder()
  .setName('warnings')
  .setDescription('View warnings for a user')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
  .addUserOption((o) => o.setName('target').setDescription('User to check').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers))
    return interaction.reply({ content: '❌ You lack permission to view warnings.', flags: [64] });

  const target = interaction.options.getUser('target', true);

  try {
    const warnings = await db.getWarnings(interaction.guild!.id, target.id);

    if (warnings.length === 0) {
      return interaction.reply({ 
        content: `✅ **${target.tag}** has no warnings.`, 
        flags: [64] 
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3256d9)
      .setTitle(`⚠️ Warnings for ${target.tag}`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(`Total warnings: **${warnings.length}**`)
      .setTimestamp()
      .setFooter({ text: `User ID: ${target.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

    const warningList = warnings.slice(0, 10).map((w: any, i: number) => {
      const date = new Date(w.createdAt).toLocaleDateString();
      return `**${i + 1}.** ${w.reason}\n└ <t:${Math.floor(w.createdAt.getTime() / 1000)}:R> by <@${w.moderatorId}>`;
    }).join('\n\n');

    embed.addFields({ name: 'Recent Warnings', value: warningList || 'None' });

    if (warnings.length > 10) {
      embed.setDescription(`Total warnings: **${warnings.length}** (Showing 10 most recent)`);
    }

    await interaction.reply({ embeds: [embed], flags: [64] });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: '❌ Failed to fetch warnings.', flags: [64] });
  }
}
