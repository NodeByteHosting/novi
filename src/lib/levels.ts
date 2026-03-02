import { Guild, Role } from 'discord.js';
import { logger } from './logger';

// Create level roles for a guild
export async function createLevelRoles(guild: Guild, maxLevels: number): Promise<string[] | null> {
  try {
    const roleIds: string[] = [];

    for (let i = 1; i <= maxLevels; i++) {
      try {
        const role = await guild.roles.create({
          name: `Level ${i}`,
          reason: 'Automatic level role creation'
        });
        roleIds.push(role.id);
        logger.debug(`Created level role`, {
          context: 'Levels',
          guildId: guild.id,
          level: i,
          roleId: role.id
        });
      } catch (err) {
        logger.error(`Failed to create level ${i} role`, {
          context: 'Levels',
          error: err,
          guildId: guild.id,
          level: i
        });
        return null;
      }
    }

    return roleIds;
  } catch (err) {
    logger.error('Failed to create level roles', {
      context: 'Levels',
      error: err,
      guildId: guild.id
    });
    return null;
  }
}

// Update user's level role
export async function updateUserLevelRole(
  guild: Guild,
  userId: string,
  newLevel: number,
  oldLevel: number | null,
  levelRoleIds: string[]
): Promise<boolean> {
  try {
    const member = await guild.members.fetch(userId);
    if (!member) return false;

    // Remove old level role if exists
    if (oldLevel !== null && oldLevel > 0 && levelRoleIds[oldLevel - 1]) {
      try {
        await member.roles.remove(levelRoleIds[oldLevel - 1]);
      } catch (err) {
        logger.warn('Failed to remove old level role', {
          context: 'Levels',
          error: err,
          guildId: guild.id,
          userId,
          oldLevel
        });
      }
    }

    // Add new level role if level > 0
    if (newLevel > 0 && levelRoleIds[newLevel - 1]) {
      try {
        await member.roles.add(levelRoleIds[newLevel - 1]);
      } catch (err) {
        logger.warn('Failed to add new level role', {
          context: 'Levels',
          error: err,
          guildId: guild.id,
          userId,
          newLevel
        });
      }
    }

    return true;
  } catch (err) {
    logger.error('Failed to update user level role', {
      context: 'Levels',
      error: err,
      guildId: guild.id,
      userId
    });
    return false;
  }
}

// Delete level roles for a guild
export async function deleteLevelRoles(guild: Guild, levelRoleIds: string[]): Promise<boolean> {
  try {
    for (const roleId of levelRoleIds) {
      try {
        const role = await guild.roles.fetch(roleId);
        if (role) {
          await role.delete('Level system disabled');
        }
      } catch (err) {
        logger.warn('Failed to delete level role', {
          context: 'Levels',
          error: err,
          guildId: guild.id,
          roleId
        });
      }
    }
    return true;
  } catch (err) {
    logger.error('Failed to delete level roles', {
      context: 'Levels',
      error: err,
      guildId: guild.id
    });
    return false;
  }
}
