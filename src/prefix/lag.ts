import { Message } from 'discord.js';

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`${pingText}**Server Lag Troubleshooting**

**Step 1: Check Server TPS**
In-game, run \`/tps\`. Your server should maintain 19.8+ TPS. If lower:

**Step 2: Identify the Cause**
- Run \`/spark profiler start\` for 10 seconds, then \`/spark profiler stop\`
- Check the report at spark.lucko.me — look for heavy chunks or entities
- Verify player count hasn't exceeded your server limit

**Step 3: Common Fixes**
- **Reduce render distance** in server.properties (8-12 is optimal)
- **Disable unnecessary mods/plugins** — check for conflicts
- **Clear old chunks**: Stop server, delete world/region cache
- **Increase RAM** in game panel: Server Settings → Startup (2GB minimum)
- **Check disk space** — full drives cause lag spikes

**Step 4: Share Diagnostics**
Run \`/tps\` at peak time and share:
- Current TPS
- Player count
- spark profiler results (paste.gg)
- Your RAM allocation
- Active mods/plugins list`);
};
