import { Message } from 'discord.js';
import { PrefixCommandMetadata } from '../lib/prefixCommands';

export const metadata: PrefixCommandMetadata = {
  name: 'mods',
  description: 'Install and manage mods on your server',
  category: '🔧 Server Configuration'
};

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`${pingText}**Mod Installation & Management**

**Before Installing Mods:**
- Verify your Minecraft version matches the mod's version
- All mods must use the SAME modloader (Forge, Fabric, Quilt — pick one!)
- Install a modloader first: https://docs.nodebyte.host/mods

**Installing Mods (General Steps):**

1. **Download** the mod .jar file
2. **Open File Manager** in game panel
3. Navigate to \`mods\` folder (create if missing)
4. **Upload** the .jar file
5. **Restart** your server

**Mod Order Matters:**
- Core mods (like Optifine) should load first
- Utility mods second
- Content mods last
- Rename mod files with numbers if needed: \`00-core.jar\`, \`01-utility.jar\`

**Troubleshooting:**
- **Server won't start**: Remove the last added mod, restart
- **Major lag spike**: Mod is conflicting — disable one at a time
- **Version mismatch**: Mod won't load silently (check logs with \`!logs\`)

**Recommended Sites:**
- https://www.curseforge.com (most trusted)
- https://modrinth.com (newer, fast)
- https://www.spigotmc.org (for Bukkit/Spigot)

**Max Safe Mods:** 50-75 depending on size. More = more lag!`);
};
