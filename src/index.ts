import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import fs from 'fs';
import path from 'path';

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token) {
  console.error('BOT_TOKEN is required in .env');
  process.exit(1);
}

type CommandModule = {
  data: any;
  execute: (interaction: any) => Promise<void>;
};

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMembers, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.Message,
    Partials.Channel
  ]
}) as any;
client.commands = new Collection<string, CommandModule>();

// load commands
const commandsPath = path.join(__dirname, 'commands');
function walkCommands(dir: string) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) walkCommands(full);
    else if (file.endsWith('.js') || file.endsWith('.ts')) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cmd = require(full);
      const name = cmd.data?.name ?? path.basename(file, path.extname(file));
      client.commands.set(name, cmd);
    }
  }
}

if (fs.existsSync(commandsPath)) walkCommands(commandsPath);

// event loader
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath)) {
  if (!file.endsWith('.js') && !file.endsWith('.ts')) continue;
  const eventName = path.basename(file, path.extname(file));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const handler = require(path.join(eventsPath, file)).default;
  if (!handler) continue;

  if (eventName === 'ready') client.once('clientReady', () => handler(client));
  else if (eventName === 'interactionCreate') client.on('interactionCreate', (i: any) => handler(client, i));
  else if (eventName === 'guildMemberAdd') client.on('guildMemberAdd', (m: any) => handler(client, m));
  else client.on(eventName as any, (...args: any[]) => handler(client, ...args));
}

client.login(token).catch((err: any) => console.error('Login failed', err));

process.on('unhandledRejection', (err) => console.error('Unhandled promise rejection', err));
