import { PermissionsBitField, GuildMember, Collection } from 'discord.js';
import { logger } from './logger';

/**
 * Cached permission check result with TTL
 */
interface PermissionCheckCache {
  hasPermission: boolean;
  expiresAt: number;
}

/**
 * In-memory cache for permission checks
 * Key format: `${userId}:${guildId}:${permissionFlag}`
 */
const permissionCache = new Collection<string, PermissionCheckCache>();
const PERMISSION_CACHE_TTL = 10 * 60 * 1000; // 10 minutes - permissions change less frequently

/**
 * Generate cache key for permission lookup
 */
function getCacheKey(userId: string, guildId: string, permission: bigint): string {
  return `${userId}:${guildId}:${permission.toString()}`;
}

/**
 * Memoized permission check with caching
 * Reduces repeated permission lookups for the same user/guild/permission combo
 * 
 * @param member The guild member to check
 * @param permission The permission flag to check
 * @returns Whether the member has the permission
 */
export async function checkPermissionCached(
  member: GuildMember | null,
  permission: bigint
): Promise<boolean> {
  if (!member) return false;

  const cacheKey = getCacheKey(member.id, member.guild.id, permission);
  const cached = permissionCache.get(cacheKey);

  // Return cached result if not expired
  if (cached && Date.now() < cached.expiresAt) {
    logger.debug(`Permission cache hit for ${member.user.tag} in ${member.guild.name}`, {
      context: 'PermissionCache'
    });
    return cached.hasPermission;
  }

  // Check permission and cache result
  const hasPermission = member.permissions.has(permission);
  
  permissionCache.set(cacheKey, {
    hasPermission,
    expiresAt: Date.now() + PERMISSION_CACHE_TTL
  });

  logger.debug(`Permission check for ${member.user.tag}: ${hasPermission}`, {
    context: 'PermissionCache'
  });

  return hasPermission;
}

/**
 * Check if member has any of the provided permissions
 * @param member The guild member
 * @param permissions Array of permission flags
 * @returns Whether member has any of the permissions
 */
export async function checkPermissionsCached(
  member: GuildMember | null,
  permissions: bigint[]
): Promise<boolean> {
  if (!member) return false;

  for (const permission of permissions) {
    if (await checkPermissionCached(member, permission)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if member has all of the provided permissions
 * @param member The guild member
 * @param permissions Array of permission flags
 * @returns Whether member has all permissions
 */
export async function checkAllPermissionsCached(
  member: GuildMember | null,
  permissions: bigint[]
): Promise<boolean> {
  if (!member) return false;

  for (const permission of permissions) {
    if (!(await checkPermissionCached(member, permission))) {
      return false;
    }
  }
  return true;
}

/**
 * Invalidate permission cache for a specific member
 * Call this when member roles change or permissions are updated
 */
export function invalidatePermissionCache(userId: string, guildId: string): void {
  // Remove all entries for this user/guild combination
  const keysToDelete: string[] = [];
  
  for (const key of permissionCache.keys()) {
    if (key.startsWith(`${userId}:${guildId}:`)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => permissionCache.delete(key));
  
  logger.debug(`Invalidated permission cache for user ${userId} in guild ${guildId}`, {
    context: 'PermissionCache'
  });
}

/**
 * Clear all permission cache
 */
export function clearPermissionCache(): void {
  permissionCache.clear();
  logger.debug('Cleared entire permission cache', {
    context: 'PermissionCache'
  });
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: permissionCache.size,
    expiredEntries: Array.from(permissionCache.values()).filter(
      entry => Date.now() > entry.expiresAt
    ).length
  };
}
