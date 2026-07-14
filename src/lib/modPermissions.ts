import { GuildMember } from 'discord.js';
import db from './db';
import { logger } from './logger';

export type ModPermission = 'ban' | 'kick' | 'warn' | 'timeout' | 'purge';

/**
 * Check if a guild member has a specific mod permission
 * @param member The guild member to check
 * @param permission The permission to check for
 * @returns true if the member has the permission
 */
export async function hasModPermission(member: GuildMember, permission: ModPermission): Promise<boolean> {
  try {
    // Admins always have all permissions
    if (member.permissions.has('Administrator')) {
      return true;
    }

    const modPermissions = await db.getModRolePermissions(member.guild.id);
    if (!modPermissions) {
      return false;
    }

    // Check if any of the member's roles have this permission
    for (const roleId of member.roles.cache.keys()) {
      const rolePermissions = modPermissions[roleId];
      if (rolePermissions && rolePermissions.includes(permission)) {
        logger.debug('User has mod permission', {
          context: 'ModPermissions',
          userId: member.id,
          permission,
          roleId
        });
        return true;
      }
    }

    return false;
  } catch (err) {
    logger.error('Error checking mod permission', {
      context: 'ModPermissions',
      error: err,
      userId: member.id,
      permission
    });
    return false;
  }
}

/**
 * Get all permissions a member has
 * @param member The guild member
 * @returns Array of permissions the member has
 */
export async function getMemberPermissions(member: GuildMember): Promise<ModPermission[]> {
  try {
    // Admins have all permissions
    if (member.permissions.has('Administrator')) {
      return ['ban', 'kick', 'warn', 'timeout', 'purge'];
    }

    const modPermissions = await db.getModRolePermissions(member.guild.id);
    if (!modPermissions) {
      return [];
    }

    const permissions = new Set<ModPermission>();

    // Collect permissions from all member roles
    for (const roleId of member.roles.cache.keys()) {
      const rolePermissions = modPermissions[roleId];
      if (rolePermissions) {
        rolePermissions.forEach(perm => permissions.add(perm as ModPermission));
      }
    }

    return Array.from(permissions);
  } catch (err) {
    logger.error('Error getting member permissions', {
      context: 'ModPermissions',
      error: err,
      userId: member.id
    });
    return [];
  }
}

/**
 * Check if a member is a support agent (has a support role)
 * @param member The guild member
 * @returns true if the member is a support agent
 */
export async function isSupportAgent(member: GuildMember): Promise<boolean> {
  try {
    // Admins are always support agents
    if (member.permissions.has('Administrator')) {
      return true;
    }

    const supportRoles = await db.getSupportRoles(member.guild.id);
    if (!supportRoles) {
      return false;
    }

    return member.roles.cache.some(role => supportRoles.includes(role.id));
  } catch (err) {
    logger.error('Error checking support agent status', {
      context: 'ModPermissions',
      error: err,
      userId: member.id
    });
    return false;
  }
}
