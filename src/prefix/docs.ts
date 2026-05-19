import { Message } from 'discord.js';
import { PrefixCommandMetadata } from '../lib/prefixCommands';

export const metadata: PrefixCommandMetadata = {
  name: 'docs',
  description: 'Access NodeByte knowledge base with guides for all game types',
  category: '📖 Documentation & Resources'
};

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`${pingText}**NodeByte Knowledge Base**

**Getting Started:**
- Quick Start: <https://nodebyte.host/kb/getting-started/quick-start>
- Game Panel Guide: <https://nodebyte.host/kb/getting-started/game-panel>

**Minecraft Servers:**
- Server Software: <https://nodebyte.host/kb/minecraft/server-software>
- Installing Plugins: <https://nodebyte.host/kb/minecraft/installing-plugins>
- Installing Mods: <https://nodebyte.host/kb/minecraft/installing-mods>
- Player Manager: <https://nodebyte.host/kb/minecraft/player-manager>
- Version Changer: <https://nodebyte.host/kb/minecraft/version-changer>

**Hytale Servers:**
- Setting Up Hytale: <https://nodebyte.host/kb/hytale/setting-up-hytale>
- Setting Server Name: <https://nodebyte.host/kb/hytale/setting-server-name>
- Operating Yourself: <https://nodebyte.host/kb/hytale/operating-yourself>
- Add Mods & Plugins: <https://nodebyte.host/kb/hytale/add-mods-and-plugins>
- Setting MOTD: <https://nodebyte.host/kb/hytale/setting-motd>

**Rust Servers:**
- Getting Started: <https://nodebyte.host/kb/rust/getting-started>
- Oxide Installation: <https://nodebyte.host/kb/rust/oxide-installation>
- Add Additional Ports: <https://nodebyte.host/kb/rust/add-additional-ports>
- Connect to Server: <https://nodebyte.host/kb/rust/connect-to-server>
- Enabling Rust+: <https://nodebyte.host/kb/rust/enabling-rust+>

**Billing:**
- Client Portal: <https://nodebyte.host/kb/billing/client-portal>

**Quick Tips:**
- Check the knowledge base before asking — 90% of questions are answered there
- Use the search feature (Ctrl+F) to find your issue
- Most problems have a dedicated page with solutions

Can't find what you need? Ask in one of our support channels with details!`);
};
