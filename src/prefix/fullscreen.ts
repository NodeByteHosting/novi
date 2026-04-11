import { Message } from 'discord.js';
import { PrefixCommandMetadata } from '../lib/prefixCommands';

export const metadata: PrefixCommandMetadata = {
  name: 'fullscreen',
  description: 'Open panel in fullscreen mode',
  category: '🎛️ Panel & Billing'
};

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`Please provide a **FULLSCREEN SCREENSHOT**.
:warning: This means literally the entire screen, from corner to corner!
:warning: Do not erase, censor or crop anything out.
:warning: Include the URL at the top (if browser) and clock at the bottom.
:warning: Include the windows taskbar and clock at the bottom.`);
};
