import { Message } from 'discord.js';
import { PrefixCommandMetadata } from '../lib/prefixCommands';

export const metadata: PrefixCommandMetadata = {
  name: 'java',
  description: 'Java version requirements for different Minecraft versions',
  category: '🔧 Server Configuration'
};

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`${pingText}**Java Version Requirements**

**Minecraft Version → Required Java:**
- **1.16 & below**: Java 8
- **1.17 - 1.20**: Java 16+
- **1.20.5+**: Java 21+

**Check Your Current Java:**
- Open game panel → Server Settings → Startup
- Look for \`JAVA_VERSION\` variable
- Current version: shown in the value field

**Updating Java:**
1. **In game panel**, go to Server Settings → Startup
2. Find the \`JAVA_VERSION\` parameter
3. Change version number (e.g., \`8\` → \`17\`)
4. Save and **Restart**

**Available Versions:**
- Java 8 (legacy)
- Java 11
- Java 16
- Java 17 (recommended for 1.20)
- Java 21 (latest, for 1.20.5+)

**Why Java Matters:**
- Wrong version = server won't start
- Too old = performance issues
- Each version has major speed improvements

**If Server Won't Start After Update:**
1. Check logs (\`!logs\`)
2. Verify Java version matches Minecraft version
3. Rollback Java if needed
4. Restart

**Performance Tip:** Java 17+ is 20-30% faster than Java 8!`);
};
