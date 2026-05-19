import { Message } from 'discord.js';
import { PrefixCommandMetadata } from '../lib/prefixCommands';

export const metadata: PrefixCommandMetadata = {
  name: 'faq',
  description: 'Frequently asked questions and common issues',
  category: '📖 Documentation & Resources'
};

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`${pingText}**Frequently Asked Questions**

**How much RAM do I need?**
- 2GB = 5-10 players (vanilla)
- 4GB = 15-25 players
- 8GB+ = 30+ players or heavy mods
See \`!lag\` for optimization tips.

**Can I install mods and plugins together?**
No! Pick ONE: Fabric/Forge mods OR Bukkit/Spigot plugins.

**How do I backup my world?**
- Game panel → Backups → Create Backup
- Download .tar.gz file to keep offline
- Restore anytime from same tab

**Why is my server lagging?**
- Check \`/tps\` (should be 19.8+)
- See \`!lag\` for full diagnostics
- Common causes: too many mods, player count, bad mods

**How do I update my server?**
- See \`!update\` for step-by-step guide
- Always backup first!

**Can I run a modpack?**
- Use modpacks from CurseForge or Modrinth
- Server files available for download
- Extract to mods folder, restart

**My server won't start!**
- Check logs: \`!logs\`
- Most common: wrong Java version (\`!java\`)
- Or corrupted mod/plugin: see \`!crash\`

**How do I transfer my world to NodeByte?**
- Download world from old host
- In game panel, File Manager → delete world folder
- Upload your world folder
- Restart server

**Can I have multiple worlds?**
- Yes! Use a multi-world plugin like Multiverse
- Each world uses extra RAM

**Still stuck? Create a support ticket!**`);
};
