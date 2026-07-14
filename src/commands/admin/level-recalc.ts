import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField, GuildMember } from 'discord.js';
import db from '../../lib/db';
import { updateUserLevelRole } from '../../lib/levels';
import { logger } from '../../lib/logger';

export const data = new SlashCommandBuilder()
  .setName('level-recalc')
  .setDescription('Recalculate levels for users based on activity')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addUserOption((opt) =>
    opt
      .setName('user')
      .setDescription('Specific user to recalculate (optional - recalcs all if omitted)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const specificUser = interaction.options.getUser('user');

  try {
    const config = await db.getLevelConfig(interaction.guildId!);
    
    if (!config?.enabled) {
      return interaction.reply({
        content: '❌ Level system is not enabled in this server.',
        flags: [64]
      });
    }

    await interaction.deferReply();

    let updatedCount = 0;
    let levelRoleIds: string[] = [];

    if (config.levelRoleIds) {
      try {
        levelRoleIds = JSON.parse(config.levelRoleIds);
      } catch (err) {
        logger.warn('Failed to parse level role IDs', {
          context: 'LevelRecalc',
          guildId: interaction.guildId!
        });
      }
    }

    if (specificUser) {
      // Recalculate for single user
      const userLevel = await db.getUserLevel(interaction.guildId!, specificUser.id);
      if (!userLevel) {
        return interaction.editReply('❌ User has no level data.');
      }

      const oldLevel = userLevel.level;
      const newLevel = await db.calculateUserLevel(interaction.guildId!, specificUser.id);

      if (newLevel !== oldLevel) {
        await db.updateUserLevel(interaction.guildId!, specificUser.id, newLevel);

        // Update role if roles are configured
        if (levelRoleIds.length > 0) {
          const member = await interaction.guild?.members.fetch(specificUser.id).catch(() => null);
          if (member) {
            await updateUserLevelRole(interaction.guild!, specificUser.id, newLevel, oldLevel, levelRoleIds);
          }
        }

        updatedCount = 1;
      }

      return interaction.editReply(
        `✅ Recalculated ${specificUser.tag}'s level: ${oldLevel} → ${newLevel}`
      );
    } else {
      // Recalculate for all users
      // This is a heavy operation - show progress
      const allUserLevels = await db.prisma.userLevel.findMany({
        where: { guildId: interaction.guildId! }
      });

      for (const userLevel of allUserLevels) {
        const newLevel = await db.calculateUserLevel(interaction.guildId!, userLevel.userId);

        if (newLevel !== userLevel.level) {
          await db.updateUserLevel(interaction.guildId!, userLevel.userId, newLevel);

          // Update role if roles are configured
          if (levelRoleIds.length > 0) {
            const member = await interaction.guild?.members.fetch(userLevel.userId).catch(() => null);
            if (member) {
              await updateUserLevelRole(interaction.guild!, userLevel.userId, newLevel, userLevel.level, levelRoleIds).catch(() => null);
            }
          }

          updatedCount++;
        }
      }

      return interaction.editReply(
        `✅ Recalculation complete! Updated **${updatedCount}** user(s) level(s).`
      );
    }
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: '❌ Failed to recalculate levels.',
      flags: [64]
    });
  }
}
