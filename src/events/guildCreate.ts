import { Client, Guild } from 'discord.js';
import db from '../lib/db';
import { logger } from '../lib/logger';

export default async (client: Client, guild: Guild) => {
  try {
    await db.getOrCreateGuildConfig(guild.id);
    logger.info(`Joined guild ${guild.name}, guild config ensured`, {
      context: 'GuildCreate',
      guildId: guild.id
    });
  } catch (err) {
    logger.error('Failed to create guild config on join', {
      context: 'GuildCreate',
      error: err,
      guildId: guild.id
    });
  }
};
