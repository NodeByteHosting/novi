import { Message } from 'discord.js';

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`${pingText}**Plugin Installation & Management**

**Installing Plugins (Bukkit/Spigot/Paper):**

1. **Download** the .jar file
2. **Open File Manager** in game panel
3. Navigate to \`plugins\` folder
4. **Upload** the .jar file
5. **Restart** your server

**Key Differences from Mods:**
- Plugins run on the server ONLY (clients don't need them)
- No modloader needed
- Can install 100+ without issues
- All plugins work together (usually)

**Popular Plugin Sources:**
- https://www.spigotmc.org (verified, safe)
- https://www.curseforge.com (also trusted)
- https://www.bukkit.org (older, but reliable)

**Recommended Plugins:**
- **Admin**: WorldEdit, Essentials
- **Protection**: GriefPrevention, LiteBans
- **Teleport**: Homes, Warps
- **Economy**: Vault + iConomy
- **Chat**: PlaceholderAPI

**Testing New Plugins:**
1. Stop server
2. Upload plugin .jar
3. Restart
4. Check console for errors (\`!logs\`)
5. If error: Remove plugin, restart, try different version

**Plugin Conflicts?**
- In console, type \`/plugins\`
- Disable suspect plugins one by one
- Restart between each test

**Max Safe Plugins:** 50-75
- Beyond that: performance degrades, check \`/tps\``);
};
