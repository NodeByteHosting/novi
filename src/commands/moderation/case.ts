import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField, EmbedBuilder } from 'discord.js';
import db from '../../lib/db';

export const data = new SlashCommandBuilder()
  .setName('case')
  .setDescription('View moderation history for a user')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
  .addUserOption((o) => o.setName('target').setDescription('User to check').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers))
    return interaction.reply({ content: '❌ You lack permission to view moderation cases.', flags: [64] });

  const target = interaction.options.getUser('target', true);

  try {
    const cases = await db.getModLogs(interaction.guild!.id, target.id);

    if (cases.length === 0) {
      return interaction.reply({ 
        content: `✅ **${target.tag}** has no moderation history.`, 
        flags: [64] 
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3256d9)
      .setTitle(`📋 Moderation History for ${target.tag}`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(`Total cases: **${cases.length}**`)
      .setTimestamp()
      .setFooter({ text: `User ID: ${target.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

    const caseList = cases.slice(0, 10).map((c: any, i: number) => {
      const actionEmoji: Record<string, string> = {
        ban: '🔨',
        kick: '👢',
        warn: '⚠️',
        unban: '✅'
      };
      const emoji = actionEmoji[c.action] || '📝';
      return `${emoji} **${c.action.toUpperCase()}** - Case #${c.id}\n└ **Reason:** ${c.reason || 'No reason provided'}\n└ **Moderator:** <@${c.moderatorId}>\n└ **Date:** <t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:R>`;
    }).join('\n\n');

    embed.addFields({ name: 'Recent Cases', value: caseList || 'None' });

    if (cases.length > 10) {
      embed.setDescription(`Total cases: **${cases.length}** (Showing 10 most recent)`);
    }

    await interaction.reply({ embeds: [embed], flags: [64] });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: '❌ Failed to fetch moderation history.', flags: [64] });
  }
}
