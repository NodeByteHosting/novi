import { Message } from 'discord.js';

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`${pingText}**How to Access & Share Logs**

**Server Crash? Here's how to find the logs:**

**Step 1: Access Your Panel**
- Go to your server panel
- Click the "Logs" tab on the left sidebar
- Scroll down to see the latest crash info

**Step 2: Share the Crash Log**
- Copy the error (usually the last 50–100 lines)
- Paste at **paste.gg** or **pastebin.com**
- Share the link in any support channel

**Step 3: What We Need**
- The full error message (not just "crash")
- Mod/plugin version numbers if applicable
- The entire stack trace (starts with "Exception" or "Error")

**Common Log Locations (if manual access needed):**
- Latest log: \`logs/latest.log\`
- Previous crashes: \`logs/<date>.log\`
- Access via game panel File Manager → \`logs\` folder

**Pro Tip:** Enable debug mode in game panel startup parameters for more detailed logs if you're troubleshooting mods.`);
};
