import net from 'net';
import dns from 'dns/promises';
import { logger } from './logger';

// Custom user agent for service monitoring - can be whitelisted in Cloudflare
const SERVICE_MONITOR_USER_AGENT = 'NodeByte-ServiceMonitor/1.0 (+https://nodebyte.host)';

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline';
  responseTime?: number;
  statusCode?: number;
}

interface GameServerStatus extends ServiceStatus {
  ip: string;
}

interface WebServiceStatus extends ServiceStatus {
  url: string;
}

/**
 * Try to resolve hostname via DNS
 */
async function checkDNS(ip: string): Promise<boolean> {
  try {
    // Try to resolve the IP - this tests basic network connectivity
    const result = await dns.reverse(ip);
    return result.length > 0;
  } catch {
    // Even if reverse DNS fails, it means the host is reachable
    return true;
  }
}

/**
 * Try to connect to a port on the game server
 * Accepts both IP addresses and hostnames (including reverse DNS)
 */
async function checkTCPConnection(ip: string, port: number = 25565): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 2000;

    socket.setTimeout(timeout);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });

    socket.connect(port, ip);
  });
}

/**
 * Ping a game server IP or hostname to check if it's online
 * Supports both IP addresses and hostnames (including reverse DNS from Hetzner, etc)
 */
async function pingGameServer(name: string, ip: string): Promise<GameServerStatus> {
  try {
    const start = Date.now();
    
    // Try multiple methods to check if server is online
    // Method 1: Try TCP connection (most reliable in containers)
    const tcpSuccess = await checkTCPConnection(ip);
    
    if (tcpSuccess) {
      const responseTime = Date.now() - start;
      logger.debug(`Game server online (TCP check)`, {
        context: 'ServiceStatus',
        server: name,
        ip,
        responseTime,
      });
      
      return {
        name,
        ip,
        status: 'online',
        responseTime,
      };
    }
    
    // Method 2: Try DNS reverse lookup as fallback
    const dnsSuccess = await checkDNS(ip);
    const responseTime = Date.now() - start;
    
    if (dnsSuccess) {
      logger.debug(`Game server online (DNS check)`, {
        context: 'ServiceStatus',
        server: name,
        ip,
        responseTime,
      });
      
      return {
        name,
        ip,
        status: 'online',
        responseTime,
      };
    }
    
    logger.debug(`Game server offline`, {
      context: 'ServiceStatus',
      server: name,
      ip,
      responseTime,
    });
    
    return {
      name,
      ip,
      status: 'offline',
    };
  } catch (err) {
    logger.debug(`Game server check error`, {
      context: 'ServiceStatus',
      server: name,
      ip,
      error: err instanceof Error ? err.message : String(err),
    });
    
    return {
      name,
      ip,
      status: 'offline',
    };
  }
}

/**
 * Check HTTP response status of a web service
 */
async function checkWebService(name: string, url: string): Promise<WebServiceStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const start = Date.now();
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': SERVICE_MONITOR_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const responseTime = Date.now() - start;
    clearTimeout(timeoutId);
    
    const isOnline = response.status >= 200 && response.status < 300;
    
    logger.debug(`Web service check complete`, {
      context: 'ServiceStatus',
      service: name,
      url,
      statusCode: response.status,
      responseTime,
    });
    
    return {
      name,
      url,
      status: isOnline ? 'online' : 'offline',
      statusCode: response.status,
      responseTime,
    };
  } catch (err) {
    logger.debug(`Web service check failed`, {
      context: 'ServiceStatus',
      service: name,
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    
    return {
      name,
      url,
      status: 'offline',
    };
  }
}

/**
 * Check all NodeByte services
 */
export async function checkAllServices(): Promise<{
  gameServers: GameServerStatus[];
  clientServices: GameServerStatus[];
  webServices: WebServiceStatus[];
  timestamp: Date;
}> {
  try {
    // Parse services config from JSON environment variable
    let gameServers: Array<{ name: string; ip: string }> = [];
    let clientServices: Array<{ name: string; ip: string }> = [];
    let webServices: Array<{ name: string; url: string }> = [];

    if (process.env.SERVICES_CONFIG) {
      try {
        const config = JSON.parse(process.env.SERVICES_CONFIG);
        gameServers = config.gameServers || [];
        clientServices = config.clientServices || [];
        webServices = config.webServices || [];
      } catch (parseErr) {
        logger.error('Failed to parse SERVICES_CONFIG JSON', {
          context: 'ServiceStatus',
          error: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
      }
    }

    if (gameServers.length === 0 && clientServices.length === 0 && webServices.length === 0) {
      logger.warn('No services configured - check SERVICES_CONFIG environment variable', {
        context: 'ServiceStatus',
      });
    }

    // Check all services in parallel
    const [gameServerResults, clientServiceResults, webServiceResults] = await Promise.all([
      Promise.all(gameServers.map(server => pingGameServer(server.name, server.ip))),
      Promise.all(clientServices.map(server => pingGameServer(server.name, server.ip))),
      Promise.all(webServices.map(service => checkWebService(service.name, service.url))),
    ]);

    logger.info('Service status check completed', {
      context: 'ServiceStatus',
      gameServersChecked: gameServerResults.length,
      clientServicesChecked: clientServiceResults.length,
      webServicesChecked: webServiceResults.length,
      gameServersOnline: gameServerResults.filter(s => s.status === 'online').length,
      clientServicesOnline: clientServiceResults.filter(s => s.status === 'online').length,
      webServicesOnline: webServiceResults.filter(s => s.status === 'online').length,
    });

    return {
      gameServers: gameServerResults,
      clientServices: clientServiceResults,
      webServices: webServiceResults,
      timestamp: new Date(),
    };
  } catch (err) {
    logger.error('Failed to check all services', {
      context: 'ServiceStatus',
      error: err,
    });

    return {
      gameServers: [],
      clientServices: [],
      webServices: [],
      timestamp: new Date(),
    };
  }
}

/**
 * Format service status for display
 */
export function formatServiceStatus(gameServers: GameServerStatus[], clientServices: GameServerStatus[], webServices: WebServiceStatus[]): string {
  const gameServerText = gameServers
    .map(s => {
      const status = s.status === 'online' ? '✓' : '✗';
      const time = s.responseTime ? ` (${s.responseTime}ms)` : '';
      return `${status} ${s.name}${time}`;
    })
    .join('\n') || 'None';

  const clientServiceText = clientServices
    .map(s => {
      const status = s.status === 'online' ? '✓' : '✗';
      const time = s.responseTime ? ` (${s.responseTime}ms)` : '';
      return `${status} ${s.name}${time}`;
    })
    .join('\n') || 'None';

  const webServiceText = webServices
    .map(s => {
      const status = s.status === 'online' ? '✓' : '✗';
      const code = s.statusCode ? ` [${s.statusCode}]` : '';
      const time = s.responseTime ? ` (${s.responseTime}ms)` : '';
      return `${status} ${s.name}${code}${time}`;
    })
    .join('\n');

  return `**Game Servers:**\n${gameServerText}\n\n**Client Services:**\n${clientServiceText}\n\n**Web Services:**\n${webServiceText}`;
}
