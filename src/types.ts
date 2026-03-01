import {
  Client,
  Collection,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  GuildMember,
  Message,
  Interaction,
  User,
  TextChannel
} from 'discord.js';
import {
  ModerationLog,
  Warning,
  Ticket,
  GuildConfig
} from '@prisma/client';

/**
 * Represents a Discord.js slash command module
 * All commands must export data and execute properties
 */
export interface CommandModule {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

/**
 * Extended Client type that includes the commands collection
 * Used throughout the application to ensure type-safe command access
 */
export interface ExtendedClient extends Client {
  commands: Collection<string, CommandModule>;
}

/**
 * Generic event handler type for Discord.js event listeners
 * Maps event names to their handler signatures
 */
export type EventHandler<T extends unknown[] = unknown[]> = (
  client: ExtendedClient,
  ...args: T
) => Promise<void> | void;

/**
 * Interaction event handler specifically for interaction events
 */
export type InteractionEventHandler = (
  client: ExtendedClient,
  interaction: Interaction
) => Promise<void>;

/**
 * Guild member event handler for member join/leave/update events
 */
export type GuildMemberEventHandler = (
  client: ExtendedClient,
  member: GuildMember
) => Promise<void>;

/**
 * Message event handler for message-related events
 */
export type MessageEventHandler = (
  client: ExtendedClient,
  message: Message
) => Promise<void>;

/**
 * Ready event handler (only receives client, no additional args)
 */
export type ReadyEventHandler = (client: ExtendedClient) => Promise<void> | void;

/**
 * Cache entry with TTL support
 */
export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Configuration for in-memory cache with TTL
 */
export interface CacheConfig {
  ttl: number; // Time-to-live in milliseconds
  maxSize?: number; // Maximum number of entries
}

/**
 * Generic memoization cache for expensive operations
 */
export class MemoizationCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private readonly ttl: number;
  private readonly maxSize: number;

  constructor(config: CacheConfig) {
    this.cache = new Map();
    this.ttl = config.ttl;
    this.maxSize = config.maxSize ?? 1000;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttl
    });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Database helper return types
 * These correspond to functions in src/lib/db.ts
 */
export namespace DatabaseTypes {
  export type ModerationLogResult = ModerationLog | null;
  export type WarningResult = Warning | null;
  export type WarningsListResult = Warning[];
  export type ModerationLogsListResult = ModerationLog[];
  export type TicketResult = Ticket | null;
  export type GuildConfigResult = GuildConfig | null;
  export type ChannelIdResult = string | null;
  export type RoleIdResult = string | null;

  /**
   * Parameters for database helper functions
   */
  export interface ModerationLogParams {
    action: string;
    guildId: string;
    moderatorId: string;
    targetId: string;
    reason?: string;
  }

  export interface WarningParams {
    guildId: string;
    userId: string;
    moderatorId: string;
    reason: string;
  }

  export interface TicketParams {
    guildId: string;
    threadId: string;
    userId: string;
    category: string;
  }

  export interface TicketUpdateParams {
    threadId: string;
    claimedBy?: string | null;
    status?: string;
    closedBy?: string;
    closedAt?: Date;
    closeReason?: string;
  }

  export interface SendModLogParams {
    channel: TextChannel | null;
    action: string;
    moderator: User;
    target: User;
    reason: string;
  }

  export interface SendDMParams {
    user: User;
    action: string;
    guildName: string;
    reason: string;
    moderator?: User;
  }
}

/**
 * Type guard to check if interaction has a member property
 * Useful for narrowing Interaction type to guild-based interactions
 */
export function isGuildInteraction(
  interaction: Interaction
): interaction is Interaction & { member: GuildMember | null } {
  return 'member' in interaction;
}

/**
 * Type guard to check if message was sent in a guild
 */
export function isGuildMessage(
  message: Message
): message is Message & { member: GuildMember | null; guild: NonNullable<Message['guild']> } {
  return message.guild !== null && message.member !== null;
}
