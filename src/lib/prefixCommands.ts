/**
 * Prefix Commands Metadata
 * Defines all available prefix commands with their descriptions and categories
 * This is the single source of truth for the help command
 */

export interface PrefixCommandMetadata {
  name: string;
  description: string;
  category: string;
  aliases?: string[];
}

export const PREFIX_COMMANDS: PrefixCommandMetadata[] = [
  // Documentation & Resources
  {
    name: 'docs',
    description: 'Access NodeByte knowledge base with guides for all game types',
    category: '📖 Documentation & Resources'
  },
  {
    name: 'faq',
    description: 'Frequently asked questions and common issues',
    category: '📖 Documentation & Resources'
  },
  {
    name: 'support',
    description: 'General support guidelines and how to get help',
    category: '📖 Documentation & Resources'
  },

  // Server Troubleshooting
  {
    name: 'lag',
    description: 'Diagnose and fix server lag, performance issues, and low TPS',
    category: '⚙️ Server Troubleshooting'
  },
  {
    name: 'crash',
    description: 'Diagnose server crashes and find solutions',
    category: '⚙️ Server Troubleshooting'
  },
  {
    name: 'logs',
    description: 'Access, view, and share server crash logs',
    category: '⚙️ Server Troubleshooting'
  },
  {
    name: 'status',
    description: 'Check server status, uptime, and performance metrics',
    category: '⚙️ Server Troubleshooting'
  },

  // Service Monitoring
  {
    name: 'services',
    description: 'Monitor NodeByte infrastructure status (game servers, web services)',
    category: '🔍 Service Monitoring'
  },

  // Server Configuration
  {
    name: 'java',
    description: 'Java version requirements for different Minecraft versions',
    category: '🔧 Server Configuration'
  },
  {
    name: 'update',
    description: 'Update your Minecraft server to a different version',
    category: '🔧 Server Configuration'
  },
  {
    name: 'mods',
    description: 'Install and manage mods on your server',
    category: '🔧 Server Configuration'
  },
  {
    name: 'plugins',
    description: 'Install and manage plugins on your server',
    category: '🔧 Server Configuration'
  },

  // Panel & Billing
  {
    name: 'panel',
    description: 'Quick link to the game server control panel',
    category: '🎛️ Panel & Billing',
    aliases: ['p']
  },
  {
    name: 'billing',
    description: 'Quick link to the billing and account management',
    category: '🎛️ Panel & Billing',
    aliases: ['b']
  },
  {
    name: 'fullscreen',
    description: 'Open panel in fullscreen mode',
    category: '🎛️ Panel & Billing'
  },

  // Server Info
  {
    name: 'ping',
    description: 'Check bot latency and response time',
    category: '💡 Server Info'
  },
  {
    name: 'uptime',
    description: 'Display bot uptime since last restart',
    category: '💡 Server Info'
  },
  {
    name: 'botinfo',
    description: 'Display bot information and statistics',
    category: '💡 Server Info'
  },
  {
    name: 'serverinfo',
    description: 'Show information about your Discord server',
    category: '💡 Server Info'
  },
  {
    name: 'userinfo',
    description: 'Display information about a Discord user',
    category: '💡 Server Info'
  },
  {
    name: 'roleinfo',
    description: 'Show detailed information about a role',
    category: '💡 Server Info'
  },
  {
    name: 'channelinfo',
    description: 'Display information about a channel',
    category: '💡 Server Info'
  },
  {
    name: 'links',
    description: 'Show helpful links (billing, panel, knowledge base, etc)',
    category: '💡 Server Info'
  }
];

/**
 * Get all commands for a specific category
 */
export function getCommandsByCategory(category: string): PrefixCommandMetadata[] {
  return PREFIX_COMMANDS.filter(cmd => cmd.category === category);
}

/**
 * Get all unique categories
 */
export function getAllCategories(): string[] {
  return [...new Set(PREFIX_COMMANDS.map(cmd => cmd.category))];
}

/**
 * Format a command for display
 */
export function formatCommand(cmd: PrefixCommandMetadata): string {
  const aliases = cmd.aliases?.length ? ` (aliases: ${cmd.aliases.map(a => `!${a}`).join(', ')})` : '';
  return `**!${cmd.name}**${aliases} - ${cmd.description}`;
}
