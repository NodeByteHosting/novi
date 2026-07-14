import { Collection, Message } from 'discord.js';
import { logger } from './logger';

/**
 * Cross-channel spam/raid detector. Scam bots (crypto giveaways, casino
 * links, etc.) typically blast the same or near-identical message into many
 * channels in quick succession. Content-based filters can be evaded by
 * varying the image/text slightly, but the cross-posting *behavior* itself
 * is a strong signal on its own.
 */

interface TrackedMessage {
  message: Message;
  normalizedContent: string;
  timestamp: number;
}

const WINDOW_MS = 60_000; // how long we remember a user's recent messages
const DUPLICATE_CHANNEL_THRESHOLD = 3; // same content posted in >= N distinct channels
const RAPID_WINDOW_MS = 15_000; // window for raw rapid-fire posting
const RAPID_MESSAGE_THRESHOLD = 5; // >= N messages...
const RAPID_CHANNEL_THRESHOLD = 3; // ...across >= N distinct channels
const MAX_TRACKED_PER_USER = 25;

const userMessages = new Collection<string, TrackedMessage[]>();

function normalize(content: string): string {
  return content
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '<link>') // ignore link differences (tracking params etc.)
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SpamCheckResult {
  isSpam: boolean;
  reason?: string;
  matchedMessages?: Message[];
}

/**
 * Records the message and checks whether it's part of a cross-channel
 * spam/raid pattern. Must be called at most once per message.
 */
export function trackAndCheckSpam(message: Message): SpamCheckResult {
  if (!message.guild) return { isSpam: false };

  const userId = message.author.id;
  const now = Date.now();
  const normalizedContent = normalize(message.content);

  const existing = (userMessages.get(userId) || []).filter(m => now - m.timestamp < WINDOW_MS);

  // Signal 1: identical/near-identical content posted across multiple channels
  if (normalizedContent.length > 0) {
    const sameContent = existing.filter(m => m.normalizedContent === normalizedContent);
    const distinctChannels = new Set(sameContent.map(m => m.message.channelId));
    distinctChannels.add(message.channelId);

    if (distinctChannels.size >= DUPLICATE_CHANNEL_THRESHOLD) {
      const matchedMessages = [...sameContent.map(m => m.message), message];
      persist(userId, existing, message, normalizedContent, now);
      logger.warn('Cross-channel duplicate spam detected', {
        context: 'SpamDetector',
        userId,
        channels: distinctChannels.size,
      });
      return {
        isSpam: true,
        reason: `identical message posted in ${distinctChannels.size} channels`,
        matchedMessages,
      };
    }
  }

  // Signal 2: rapid-fire posting across many channels regardless of content
  // (catches obfuscated/varied scam payloads, e.g. slightly different images each time)
  const rapid = existing.filter(m => now - m.timestamp < RAPID_WINDOW_MS);
  const rapidChannels = new Set(rapid.map(m => m.message.channelId));
  rapidChannels.add(message.channelId);

  if (rapid.length + 1 >= RAPID_MESSAGE_THRESHOLD && rapidChannels.size >= RAPID_CHANNEL_THRESHOLD) {
    const matchedMessages = [...rapid.map(m => m.message), message];
    persist(userId, existing, message, normalizedContent, now);
    logger.warn('Rapid cross-channel spam raid detected', {
      context: 'SpamDetector',
      userId,
      messages: rapid.length + 1,
      channels: rapidChannels.size,
    });
    return {
      isSpam: true,
      reason: `${rapid.length + 1} messages posted across ${rapidChannels.size} channels in ${RAPID_WINDOW_MS / 1000}s`,
      matchedMessages,
    };
  }

  persist(userId, existing, message, normalizedContent, now);
  return { isSpam: false };
}

function persist(userId: string, existing: TrackedMessage[], message: Message, normalizedContent: string, now: number) {
  const updated = [...existing, { message, normalizedContent, timestamp: now }].slice(-MAX_TRACKED_PER_USER);
  userMessages.set(userId, updated);
}

/** Clears tracked state for a user, e.g. after acting on a detected raid. */
export function clearTrackedMessages(userId: string): void {
  userMessages.delete(userId);
}

// Periodically drop stale/empty entries so long-running processes don't
// accumulate tracking state for users who've gone quiet.
setInterval(() => {
  const now = Date.now();
  for (const [userId, messages] of userMessages) {
    const fresh = messages.filter(m => now - m.timestamp < WINDOW_MS);
    if (fresh.length === 0) {
      userMessages.delete(userId);
    } else if (fresh.length !== messages.length) {
      userMessages.set(userId, fresh);
    }
  }
}, WINDOW_MS).unref();
