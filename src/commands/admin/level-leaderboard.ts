import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../../lib/db';
import { hasModPermission } from '../../lib/modPermissions';

export const data = new SlashCommandBuilder()
  .setName('level-leaderboard')
  .setDescription('View the server level leaderboard')
  .setDMPermission(false)
  .addIntegerOption((opt) =>
    opt
      .setName('limit')
      .setDescription('Number of top users to show (1-50)')
      .setMinValue(1)
      .setMaxValue(50)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const limit = interaction.options.getInteger('limit') || 10;

  try {
    const config = await db.getLevelConfig(interaction.guildId!);
    
    if (!config?.enabled) {
      return interaction.reply({
        content: '❌ Level system is not enabled in this server.',
        flags: [64]
      });
    }

    await interaction.deferReply();

    const leaderboard = await db.getLeaderboard(interaction.guildId!, limit);

    if (leaderboard.length === 0) {
      return interaction.editReply({
        content: '📊 No users have leveled up yet.'
      });
    }

    // Fetch user data for display
    const userDataPromises = leaderboard.map(entry =>
      interaction.client.users.fetch(entry.userId).catch(() => null)
    );
    const users = await Promise.all(userDataPromises);

    // Build leaderboard text
    let leaderboardText = '';
    leaderboard.forEach((entry, index) => {
      const user = users[index];
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const username = user ? user.username : `Unknown User (${entry.userId})`;
      const threshold = config.baseThreshold * Math.pow(config.exponentFactor, entry.level - 1);
      const progressToNext = config.baseThreshold * Math.pow(config.exponentFactor, entry.level);
      const progressPct = Math.floor((entry.activityPoints / progressToNext) * 100);
      
      leaderboardText += `${medal} **${username}** - Level ${entry.level} (${entry.activityPoints} pts, ${progressPct}% to next)\n`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x3256d9)
      .setTitle('📊 Server Level Leaderboard')
      .setDescription(leaderboardText)
      .addFields(
        { name: 'Info', value: `Max Level: ${config.maxLevel}\nBase Threshold: ${config.baseThreshold}\nExponent: ${config.exponentFactor}x`, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `Showing top ${leaderboard.length} users` });

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: '❌ Failed to fetch leaderboard.',
      flags: [64]
    });
  }
}
