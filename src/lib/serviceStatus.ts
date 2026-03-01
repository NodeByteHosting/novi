import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';

const execAsync = promisify(exec);

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
 * Ping a game server IP to check if it's online
 */
async function pingGameServer(name: string, ip: string): Promise<GameServerStatus> {
  try {
    // Use Linux ping command (for Ubuntu/Linux systems)
    const pingCmd = `ping -c 1 -W 1000 ${ip}`;
    
    const start = Date.now();
    await execAsync(pingCmd);
    const responseTime = Date.now() - start;
    
    logger.debug(`Game server ping successful`, {
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
  } catch (err) {
    logger.debug(`Game server ping failed`, {
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
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
  webServices: WebServiceStatus[];
  timestamp: Date;
}> {
  try {
    // Game servers to check
    const gameServers = [
      { name: 'Minecraft Newcastle 1', ip: process.env.MINECRAFT_NEWCASTLE_1_IP || '45.85.88.74' },
      { name: 'Rust Newcastle 1', ip: process.env.RUST_NEWCASTLE_1_IP || '45.85.88.74' },
      { name: 'Hytale Newcastle 1', ip: process.env.HYTALE_NEWCASTLE_1_IP || '45.85.88.74' },
    ];

    // Web services to check
    const webServices = [
      { name: 'Website', url: process.env.WEBSITE_URL || 'https://nodebyte.host' },
      { name: 'Backend', url: process.env.BACKEND_URL || 'https://core.nodebyte.host' },
      { name: 'Billing Panel', url: process.env.BILLING_URL || 'https://billing.nodebyte.host' },
      { name: 'Game Panel', url: process.env.GAME_PANEL_URL || 'https://panel.nodebyte.host' },
    ];

    // Check all services in parallel
    const [gameServerResults, webServiceResults] = await Promise.all([
      Promise.all(gameServers.map(server => pingGameServer(server.name, server.ip))),
      Promise.all(webServices.map(service => checkWebService(service.name, service.url))),
    ]);

    logger.info('Service status check completed', {
      context: 'ServiceStatus',
      gameServersChecked: gameServerResults.length,
      webServicesChecked: webServiceResults.length,
      gameServersOnline: gameServerResults.filter(s => s.status === 'online').length,
      webServicesOnline: webServiceResults.filter(s => s.status === 'online').length,
    });

    return {
      gameServers: gameServerResults,
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
      webServices: [],
      timestamp: new Date(),
    };
  }
}

/**
 * Format service status for display
 */
export function formatServiceStatus(gameServers: GameServerStatus[], webServices: WebServiceStatus[]): string {
  const gameServerText = gameServers
    .map(s => {
      const status = s.status === 'online' ? '✓' : '✗';
      const time = s.responseTime ? ` (${s.responseTime}ms)` : '';
      return `${status} ${s.name}${time}`;
    })
    .join('\n');

  const webServiceText = webServices
    .map(s => {
      const status = s.status === 'online' ? '✓' : '✗';
      const code = s.statusCode ? ` [${s.statusCode}]` : '';
      const time = s.responseTime ? ` (${s.responseTime}ms)` : '';
      return `${status} ${s.name}${code}${time}`;
    })
    .join('\n');

  return `**Game Servers:**\n${gameServerText}\n\n**Web Services:**\n${webServiceText}`;
}
