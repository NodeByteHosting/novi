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

const prefixDir = path.join(__dirname, '../prefix');

function isCommandFile(fileName: string): boolean {
  return fileName.endsWith('.ts') || fileName.endsWith('.js');
}

function isHelpFile(fileName: string): boolean {
  return fileName === 'help.ts' || fileName === 'help.js';
}

function collectCommandFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectCommandFiles(entryPath));
      continue;
    }

    if (entry.isFile() && isCommandFile(entry.name) && !isHelpFile(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function getCommandNameFromPath(filePath: string): string {
  return path
    .relative(prefixDir, filePath)
    .replace(/\.(ts|js)$/, '')
    .split(path.sep)
    .join('/');
}

function isValidCommandPath(command: string): boolean {
  return command.split('/').every(segment => /^[a-z0-9_-]+$/i.test(segment));
}

export function resolvePrefixCommandFile(command: string): string | null {
  const normalizedCommand = command.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

  if (!normalizedCommand || !isValidCommandPath(normalizedCommand)) {
    return null;
  }

  const commandSegments = normalizedCommand.split('/');
  const candidates = [
    path.join(prefixDir, ...commandSegments) + '.ts',
    path.join(prefixDir, ...commandSegments) + '.js',
    path.join(prefixDir, ...commandSegments, 'index.ts'),
    path.join(prefixDir, ...commandSegments, 'index.js')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Dynamically load all prefix commands from the filesystem
 * Each command module should export a 'metadata' object
 */
export async function loadPrefixCommandsMetadata(): Promise<PrefixCommandMetadata[]> {
  if (commandMetadataCache) {
    return commandMetadataCache;
  }

  try {
    if (!fs.existsSync(prefixDir)) {
      logger.warn('Prefix commands directory not found', { context: 'PrefixCommands' });
      return [];
    }

    const files = collectCommandFiles(prefixDir);

    const commands: PrefixCommandMetadata[] = [];

    for (const filePath of files) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const module: PrefixCommandModule = require(filePath);

        // If module exports metadata, use it
        if (module.metadata) {
          commands.push({
            ...module.metadata,
            name: module.metadata.name || getCommandNameFromPath(filePath)
          });
        }
      } catch (err) {
        logger.debug(`Failed to load metadata from prefix command ${filePath}`, {
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
