import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import db from '../../lib/db';
import { updateUserLevelRole } from '../../lib/levels';
import { logger } from '../../lib/logger';

export const data = new SlashCommandBuilder()
  .setName('level-set')
  .setDescription('Manually set a user\'s level')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addUserOption((opt) =>
    opt
      .setName('user')
      .setDescription('User to set level for')
      .setRequired(true)
  )
  .addIntegerOption((opt) =>
    opt
      .setName('level')
      .setDescription('Level to set (0-max level)')
      .setMinValue(0)
      .setRequired(true)
  )
  .addIntegerOption((opt) =>
    opt
      .setName('points')
      .setDescription('Activity points (optional)')
      .setMinValue(0)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser('user', true);
  const newLevel = interaction.options.getInteger('level', true);
  const newPoints = interaction.options.getInteger('points');

  try {
    const config = await db.getLevelConfig(interaction.guildId!);
    
    if (!config?.enabled) {
      return interaction.reply({
        content: '❌ Level system is not enabled in this server.',
        flags: [64]
      });
    }

    if (newLevel > config.maxLevel) {
      return interaction.reply({
        content: `❌ Maximum level is ${config.maxLevel}.`,
        flags: [64]
      });
    }

    await interaction.deferReply();

    const userLevel = await db.getUserLevel(interaction.guildId!, targetUser.id);
    if (!userLevel) {
      return interaction.editReply('❌ Failed to get user level data.');
    }

    const oldLevel = userLevel.level;

    // Update level and points
    const updateData: any = { level: newLevel };
    if (newPoints !== null) {
      updateData.activityPoints = newPoints;
    }

    const updated = await db.prisma.userLevel.update({
      where: { guildId_userId: { guildId: interaction.guildId!, userId: targetUser.id } },
      data: updateData
    });

    // Update roles if configured
    let levelRoleIds: string[] = [];
    if (config.levelRoleIds) {
      try {
        levelRoleIds = JSON.parse(config.levelRoleIds);
      } catch (err) {
        logger.warn('Failed to parse level role IDs', {
          context: 'LevelSet',
          guildId: interaction.guildId!
        });
      }
    }

    if (levelRoleIds.length > 0) {
      const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
      if (member) {
        await updateUserLevelRole(interaction.guild!, targetUser.id, newLevel, oldLevel, levelRoleIds);
      }
    }

    const pointsInfo = newPoints !== null ? ` (${newPoints} points)` : '';
    return interaction.editReply(
      `✅ Set **${targetUser.tag}** level: ${oldLevel} → ${newLevel}${pointsInfo}`
    );
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: '❌ Failed to set user level.',
      flags: [64]
    });
  }
}
