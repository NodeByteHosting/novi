/**
 * Game Server Query Utilities
 * Supports multiple game server types with respective query methods
 */

import { logger } from './logger';

export interface GameServerInfo {
  hostname: string;
  players: number;
  maxPlayers: number;
  gameType: string;
  version?: string;
  map?: string;
  motd?: string;
  online: boolean;
  responseTime?: number;
}

/**
 * Query a Minecraft server using status endpoint
 */
export async function queryMinecraftServer(host: string, port: number = 25565): Promise<GameServerInfo | null> {
  try {
    const start = Date.now();
    
    // Try to connect to the server status API
    const response = await fetch(`https://api.mcsrvstat.us/3/${host}:${port}`, {
      timeout: 5000,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as any;
    const responseTime = Date.now() - start;

    if (!data.online) {
      return {
        hostname: host,
        players: 0,
        maxPlayers: 0,
        gameType: 'Minecraft',
        online: false,
        responseTime,
      };
    }

    return {
      hostname: data.hostname || host,
      players: data.players?.online || 0,
      maxPlayers: data.players?.max || 0,
      gameType: 'Minecraft',
      version: data.version || 'Unknown',
      motd: data.motd?.clean?.[0] || 'No MOTD',
      map: data.map || 'Unknown',
      online: true,
      responseTime,
    };
  } catch (err) {
    logger.debug('Failed to query Minecraft server', {
      context: 'GameServer',
      host,
      port,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Query a Rust server using Battlemetrics API
 */
export async function queryRustServer(serverId: string): Promise<GameServerInfo | null> {
  try {
    const start = Date.now();

    const response = await fetch(`https://api.battlemetrics.com/servers/${serverId}`, {
      headers: {
        'User-Agent': 'NodeByte-GameServer-Bot/1.0',
      },
      timeout: 5000,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as any;
    const responseTime = Date.now() - start;
    const serverData = data.data;

    return {
      hostname: serverData.attributes.name,
      players: serverData.attributes.players || 0,
      maxPlayers: serverData.attributes.maxPlayers || 0,
      gameType: 'Rust',
      version: serverData.attributes.details?.rust?.version || 'Unknown',
      map: serverData.attributes.details?.map || serverData.attributes.details?.rust?.map || 'Unknown',
      online: serverData.attributes.status === 'online',
      responseTime,
    };
  } catch (err) {
    logger.debug('Failed to query Rust server', {
      context: 'GameServer',
      serverId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Query a Hytale server
 * Note: Hytale is still in development with limited public server APIs
 * This provides basic connectivity check
 */
export async function queryHytaleServer(host: string, port: number = 12345): Promise<GameServerInfo | null> {
  try {
    const start = Date.now();

    // Try status API if available
    const response = await fetch(`https://${host}:${port}/status`, {
      method: 'GET',
      headers: {
        'User-Agent': 'NodeByte-GameServer-Bot/1.0',
      },
      timeout: 5000,
    });

    if (!response.ok) {
      return {
        hostname: host,
        players: 0,
        maxPlayers: 0,
        gameType: 'Hytale',
        online: false,
      };
    }

    const data = await response.json() as any;
    const responseTime = Date.now() - start;

    return {
      hostname: host,
      players: data.players || 0,
      maxPlayers: data.maxPlayers || data.max_players || 0,
      gameType: 'Hytale',
      version: data.version || 'Unknown',
      map: data.map || data.world || 'Unknown',
      online: true,
      responseTime,
    };
  } catch (err) {
    logger.debug('Failed to query Hytale server', {
      context: 'GameServer',
      host,
      port,
      error: err instanceof Error ? err.message : String(err),
    });
    
    // Return offline status if query fails
    return {
      hostname: host,
      players: 0,
      maxPlayers: 0,
      gameType: 'Hytale',
      online: false,
    };
  }
}

/**
 * FiveM specific interfaces
 */
export interface FiveMPlayer {
  id: number;
  name: string;
  identifiers: string[];
  ping: number;
  state: string;
}

export interface FiveMServer {
  hostname: string;
  clients: number;
  maxClients: number;
  gametype: string;
  mapname: string;
  players: FiveMPlayer[];
  resources?: string[];
  iconVersion: number;
  oneSync?: boolean;
  onesyncEnabled?: boolean;
  burstRoute?: number;
  minClients?: number;
  tags?: string[];
  deployMode?: string;
  txnId?: string;
  svMaxClients?: number;
  privateClients?: number;
  connectEndPoints?: string[];
  vars?: Record<string, string>;
  uptime?: number;
}

/**
 * Fetch FiveM server information from CFX.re API
 */
export async function getFiveMServerInfo(serverIdentifier: string): Promise<FiveMServer | null> {
  try {
    const response = await fetch(`https://servers.cfx.re/api/servers/single/${serverIdentifier}`, {
      headers: {
        'User-Agent': 'NodeByte-GameServer-Bot/1.0',
      },
    });

    if (!response.ok) {
      logger.warn(`CFX API returned ${response.status} for server ${serverIdentifier}`, {
        context: 'GameServer',
        serverIdentifier,
        status: response.status,
      });
      return null;
    }

    const data: FiveMServer = await response.json();
    return data;
  } catch (err) {
    logger.error('Failed to fetch FiveM server info', {
      context: 'GameServer',
      serverIdentifier,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Fetch FiveM server resources from CFX.re API
 */
export async function getFiveMServerResources(serverIdentifier: string): Promise<string[] | null> {
  try {
    const response = await fetch(`https://servers.cfx.re/api/servers/single/${serverIdentifier}`, {
      headers: {
        'User-Agent': 'NodeByte-GameServer-Bot/1.0',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: FiveMServer = await response.json();
    return data.resources || [];
  } catch (err) {
    logger.error('Failed to fetch FiveM server resources', {
      context: 'GameServer',
      serverIdentifier,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Search for a FiveM server by name using CFX.re search
 */
export async function searchFiveMServers(query: string, limit: number = 10): Promise<FiveMServer[] | null> {
  try {
    const response = await fetch(`https://servers.cfx.re/api/servers/search?query=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'NodeByte-GameServer-Bot/1.0',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: FiveMServer[] = await response.json();
    return data.slice(0, limit);
  } catch (err) {
    logger.error('Failed to search FiveM servers', {
      context: 'GameServer',
      query,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Parse server identifier (host:port format)
 */
export function parseGameServerIdentifier(input: string, defaultPort: number): { host: string; port: number } | null {
  try {
    const parts = input.split(':');
    
    if (parts.length === 2) {
      const port = parseInt(parts[1], 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        return null;
      }
      return { host: parts[0], port };
    }
    
    if (parts.length === 1) {
      return { host: parts[0], port: defaultPort };
    }
    
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Parse FiveM server identifier from various input formats
 */
export function parseFiveMServerIdentifier(input: string): string | null {
  // Handle IP:port format
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(input)) {
    return input;
  }

  // Handle hostname:port format (basic check)
  if (/^[a-zA-Z0-9.-]+:\d+$/.test(input)) {
    return input;
  }

  // Handle just IP
  if (/^\d+\.\d+\.\d+\.\d+$/.test(input)) {
    return `${input}:30120`; // Default FiveM port
  }

  // Handle server UUID/identifier from CFX
  if (/^[a-f0-9-]+$/.test(input)) {
    return input;
  }

  return null;
}
