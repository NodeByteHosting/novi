import { Message } from 'discord.js';
import { PrefixCommandMetadata } from '../lib/prefixCommands';

export const metadata: PrefixCommandMetadata = {
  name: 'crash',
  description: 'Diagnose server crashes and find solutions',
  category: '⚙️ Server Troubleshooting'
};

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`${pingText}**Server Crash Diagnosis**

**If your server keeps crashing, follow these steps:**

**Step 1: Get the Crash Log**
- Open the Game Panel → \`Logs\` tab
- Copy the last 50-100 lines containing the error
- Paste at paste.gg and share the link

**Step 2: Check for Common Culprits**
- **Mod conflicts**: Disable recently added mods, restart, test
- **Plugin issues**: Check for new/broken plugins
- **Out of memory**: Increase RAM in game panel (Server Settings → Startup)
- **Corrupted chunks**: See \`!lag\` for chunk clearing steps

**Step 3: Isolate the Problem**
- Start with mods disabled → enable one at a time
- Do the same with plugins
- This helps identify which mod/plugin causes the crash

**Step 4: Get Help**
Create a support ticket with:
- Crash log (paste.gg link)
- List of mods/plugins
- Java version (\`!java\`)
- RAM allocation

**Stuck in startup loop?**
- In game panel, stop the server
- Delete the \`world\` folder (backup first!)
- Restart — a new world will generate`);
};
