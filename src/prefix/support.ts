import { Message } from 'discord.js';

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`To receive adequate support provide the following:
- 📸 **Screenshots of the issue.**
- 📝 **Detailed description of what's going wrong.**
- 💻 **Server information** (version, world name, player count)
- 🔧 **What you've already tried.**
- 📋 **Any error messages or logs** (paste.gg or pastebin.com)

All screenshots **MUST be FULL SCREEN**. Do not crop or erase anything!`);
};
