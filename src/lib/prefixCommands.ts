/**
 * Prefix Commands Metadata
 * Dynamically loads all prefix commands from the filesystem
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger';

export interface PrefixCommandMetadata {
  name: string;
  description: string;
  category: string;
  aliases?: string[];
}

export interface PrefixCommandModule {
  default: (message: any, args: string[]) => Promise<void> | void;
  metadata?: PrefixCommandMetadata;
}

let commandMetadataCache: PrefixCommandMetadata[] | null = null;

/**
 * Dynamically load all prefix commands from the filesystem
 * Each command module should export a 'metadata' object
 */
export async function loadPrefixCommandsMetadata(): Promise<PrefixCommandMetadata[]> {
  if (commandMetadataCache) {
    return commandMetadataCache;
  }

  try {
    const prefixDir = path.join(__dirname, '../prefix');
    if (!fs.existsSync(prefixDir)) {
      logger.warn('Prefix commands directory not found', { context: 'PrefixCommands' });
      return [];
    }

    const files = fs.readdirSync(prefixDir).filter(
      file => file.endsWith('.ts') || file.endsWith('.js')
    );

    const commands: PrefixCommandMetadata[] = [];

    for (const file of files) {
      try {
        // Skip help.ts and other system files
        if (file === 'help.ts' || file === 'help.js') continue;

        const filePath = path.join(prefixDir, file);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const module: PrefixCommandModule = require(filePath);

        // If module exports metadata, use it
        if (module.metadata) {
          commands.push(module.metadata);
        }
      } catch (err) {
        logger.debug(`Failed to load metadata from prefix command ${file}`, {
          context: 'PrefixCommands',
          error: err
        });
      }
    }

    // Sort by category then by name for consistent display
    commands.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    commandMetadataCache = commands;
    logger.info(`Loaded ${commands.length} prefix command metadata entries`, {
      context: 'PrefixCommands'
    });

    return commands;
  } catch (err) {
    logger.error('Failed to load prefix commands metadata', {
      context: 'PrefixCommands',
      error: err
    });
    return [];
  }
}

/**
 * Get all unique categories from loaded commands
 */
export function getAllCategories(): string[] {
  if (!commandMetadataCache) {
    logger.warn('Command metadata not loaded yet', { context: 'PrefixCommands' });
    return [];
  }

  const categories = new Set<string>();
  commandMetadataCache.forEach(cmd => categories.add(cmd.category));
  return Array.from(categories).sort();
}

/**
 * Get all commands for a specific category
 */
export function getCommandsByCategory(category: string): PrefixCommandMetadata[] {
  if (!commandMetadataCache) {
    return [];
  }

  return commandMetadataCache.filter(cmd => cmd.category === category);
}

/**
 * Get all loaded commands
 */
export function getAllCommands(): PrefixCommandMetadata[] {
  return commandMetadataCache || [];
}

/**
 * Format a command for display in help
 */
export function formatCommand(cmd: PrefixCommandMetadata): string {
  const aliasText = cmd.aliases && cmd.aliases.length > 0 
    ? ` (${cmd.aliases.map(a => `\`!${a}\``).join(', ')})`
    : '';
  return `\`!${cmd.name}\`${aliasText} - ${cmd.description}`;
}
