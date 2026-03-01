import { Message } from 'discord.js';

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`${pingText}**NodeByte Services Status**

**Check Server Status:**
- **Status Page**: https://status.nodebyte.host
- **Real-time updates** on all NodeByte services
- Incidents reported within 5 minutes

**Your Server Status:**
- Open **game panel**: https://billing.nodebyte.host
- Click your server → view "Online" / "Offline" status
- See player count, CPU/RAM usage, uptime

**If Your Server is Down:**
- First, check our **status page** (are NodeByte systems down?)
- Check **Logs** in game panel (\`!logs\`)
- Verify you have enough **RAM allocated** (\`!lag\`)
- Ensure latest **Java version** is set (\`!java\`)
- If crash loop: remove last added mod/plugin (\`!crash\`)

**Getting More Uptime Info:**
- Game panel → Server Settings → View restart history
- See past 30 days of uptime/downtime
- Automatic restarts happen at set times (if enabled)

**Reporting an Outage:**
- If NodeByte infrastructure is down, check status.nodebyte.host
- Already reported? No action needed, we're working on it
- Not listed? Create a support ticket with details

**Server Not Responding to Ping?**
1. Make sure server is fully started (watch game panel console 10 seconds)
2. Try \`/tps\` in-game — if responds, server is fine
3. Check firewall/port forwarding if connecting from outside`);
};
