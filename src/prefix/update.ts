import { Message } from 'discord.js';
import { PrefixCommandMetadata } from '../lib/prefixCommands';

export const metadata: PrefixCommandMetadata = {
  name: 'update',
  description: 'Update your Minecraft server to a different version',
  category: '🔧 Server Configuration'
};

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`${pingText}**Server & Minecraft Updates**

**Updating Your Server Version:**

**Step 1: Backup Your World**
- In game panel, go to \`Backups\`
- Click \`Create Backup\` — this saves everything

**Step 2: Update Java (if needed)**
- See \`!java\` for version requirements
- Minecraft 1.20+ requires Java 17+
- Update in game panel → Server Settings → Startup

**Step 3: Change Minecraft Version**
- Go to game panel → Server Settings → Startup
- Find \`MINECRAFT_VERSION\` variable
- Change version number (e.g., \`1.19.2\` → \`1.20.1\`)
- Save & Restart

**Step 4: Check Compatibility**
- All mods/plugins must support the new version
- Check CurseForge/SpigotMC for compatibility
- Remove unsupported mods/plugins BEFORE updating

**Safe Update Path:**
1.19.2 → 1.20 → 1.20.1 (gradual is safer)
Jump too far and you may lose world data!

**After Update:**
- Verify \`/tps\` is stable
- Test key plugins/mods
- Check player builds — sometimes chunks need regenerating

**Rollback (if broken):**
1. Restore from backup (game panel → Backups)
2. Downgrade version in startup params
3. Restart

**Paper/Spigot Updates:**
Just restart your server — it auto-updates if enabled!`);
};
