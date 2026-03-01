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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    try {
      // Try to connect to the server status API
      const response = await fetch(`https://api.mcsrvstat.us/3/${host}:${port}`, {
        signal: controller.signal,
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
    } finally {
      clearTimeout(timeout);
    }
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`https://api.battlemetrics.com/servers/${serverId}`, {
        headers: {
          'User-Agent': 'NodeByte-GameServer-Bot/1.0',
        },
        signal: controller.signal,
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
    } finally {
      clearTimeout(timeout);
    }
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      // Try status API if available
      const response = await fetch(`https://${host}:${port}/status`, {
        method: 'GET',
        headers: {
          'User-Agent': 'NodeByte-GameServer-Bot/1.0',
        },
        signal: controller.signal,
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
    } finally {
      clearTimeout(timeout);
    }
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
}

/**
 * Normalized FiveM server data (mapped from CFX API response)
 */
export interface FiveMServer {
  /** CFX join code (e.g. "pmdoa5") */
  endpoint: string;
  hostname: string;
  clients: number;
  maxClients: number;
  gametype: string;
  mapname: string;
  version: string;
  players: FiveMPlayer[];
  resources: string[];
  onesyncEnabled: boolean;
  isPrivate: boolean;
  connectEndPoints: string[];
  vars: Record<string, string>;
  ownerName: string;
  ownerAvatar: string;
  lastSeen: string;
  tags: string[];
  projectName: string;
  projectDesc: string;
  iconVersion: number;
  upvotePower: number;
  bannerUrl: string | null;
  supportStatus: string;
  locale: string;
  gameName: string;
  txAdminVersion: string;
}

/** Raw response shape from the CFX servers-frontend API */
interface CFXApiResponse {
  EndPoint: string;
  Data: {
    hostname: string;
    gametype: string;
    mapname: string;
    clients: number;
    sv_maxclients: number;
    svMaxclients: number;
    server: string;
    enhancedHostSupport: boolean;
    selfReportedClients: number;
    players: FiveMPlayer[];
    resources: string[];
    ownerID: number;
    private: boolean;
    fallback: boolean;
    connectEndPoints: string[];
    lastSeen: string;
    upvotePower: number;
    burstPower: number;
    ownerName: string;
    ownerProfile: string;
    ownerAvatar: string;
    support_status: string;
    iconVersion: number;
    vars: Record<string, string>;
    requestSteamTicket: string;
    suspendedTill: string;
  };
}

const FIVEM_API_BASE = 'https://servers-frontend.fivem.net/api/servers';

/**
 * Map raw CFX API response to our normalized FiveMServer interface
 */
function mapCFXResponse(raw: CFXApiResponse): FiveMServer {
  const d = raw.Data;
  const vars = d.vars || {};
  const tagString = vars.tags || '';

  return {
    endpoint: raw.EndPoint,
    hostname: d.hostname || 'Unknown',
    clients: d.clients || 0,
    maxClients: d.svMaxclients || d.sv_maxclients || 0,
    gametype: d.gametype || 'Unknown',
    mapname: d.mapname || 'Unknown',
    version: d.server || 'Unknown',
    players: d.players || [],
    resources: d.resources || [],
    onesyncEnabled: vars.onesync_enabled === 'true',
    isPrivate: d.private || false,
    connectEndPoints: d.connectEndPoints || [],
    vars,
    ownerName: d.ownerName || 'Unknown',
    ownerAvatar: d.ownerAvatar || '',
    lastSeen: d.lastSeen || '',
    tags: tagString ? tagString.split(',').map(t => t.trim()).filter(Boolean) : [],
    projectName: vars.sv_projectName || '',
    projectDesc: vars.sv_projectDesc || '',
    iconVersion: d.iconVersion || 0,
    upvotePower: d.upvotePower || 0,
    bannerUrl: vars.banner_detail || vars.banner_connecting || null,
    supportStatus: d.support_status || 'unknown',
    locale: vars.locale || 'en-US',
    gameName: vars.gamename || 'gta5',
    txAdminVersion: vars['txAdmin-version'] || '',
  };
}

/**
 * Fetch FiveM server information from the CFX servers-frontend API
 * Accepts a CFX join code (e.g. "pmdoa5") or a cfx.re/join URL
 */
export async function getFiveMServerInfo(serverIdentifier: string): Promise<FiveMServer | null> {
  try {
    const cfxCode = parseFiveMServerIdentifier(serverIdentifier);
    if (!cfxCode) {
      logger.warn('Invalid FiveM server identifier', { context: 'GameServer', serverIdentifier });
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${FIVEM_API_BASE}/single/${cfxCode}`, {
        headers: { 'User-Agent': 'NodeByte-GameServer-Bot/1.0' },
        signal: controller.signal,
      });

      if (!response.ok) {
        logger.warn(`CFX API returned ${response.status} for server ${cfxCode}`, {
          context: 'GameServer',
          cfxCode,
          status: response.status,
        });
        return null;
      }

      const raw: CFXApiResponse = await response.json();
      return mapCFXResponse(raw);
    } finally {
      clearTimeout(timeout);
    }
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
 * Fetch FiveM server resources from the CFX servers-frontend API
 */
export async function getFiveMServerResources(serverIdentifier: string): Promise<string[] | null> {
  const server = await getFiveMServerInfo(serverIdentifier);
  if (!server) return null;
  return server.resources;
}

/**
 * Look up multiple FiveM servers by their CFX codes
 * Since CFX has no public search API, this accepts an array of known codes
 */
export async function lookupFiveMServers(codes: string[]): Promise<FiveMServer[]> {
  const results: FiveMServer[] = [];
  // Query up to 10 servers in parallel
  const batch = codes.slice(0, 10);
  const promises = batch.map(async (code) => {
    try {
      return await getFiveMServerInfo(code);
    } catch {
      return null;
    }
  });

  const settled = await Promise.all(promises);
  for (const server of settled) {
    if (server) results.push(server);
  }
  return results;
}

/**
 * Parse server identifier (host:port format) for non-FiveM games
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
 * Parse FiveM server identifier from various input formats.
 * Returns the CFX join code, or null if the input is not a valid identifier.
 *
 * The CFX API only accepts join codes (e.g. "pmdoa5"), NOT IP:port.
 * Supported inputs:
 *   - CFX join code: "pmdoa5"
 *   - cfx.re/join URL: "https://cfx.re/join/pmdoa5" or "cfx.re/join/pmdoa5"
 */
export function parseFiveMServerIdentifier(input: string): string | null {
  const trimmed = input.trim();

  // Handle cfx.re/join URLs (https://cfx.re/join/xxx or cfx.re/join/xxx)
  const urlMatch = trimmed.match(/(?:https?:\/\/)?cfx\.re\/join\/([a-zA-Z0-9]+)/i);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Handle bare CFX join code (alphanumeric, typically 5-7 chars)
  if (/^[a-zA-Z0-9]{3,10}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}
