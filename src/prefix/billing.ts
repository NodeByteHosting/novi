import { Message } from 'discord.js';

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`### Billing Support
    \nFor billing support, please contact our billing team directly through the panel's support ticket system.
    - _*:warning: For privacy concerns billing requests will not be handled in our Discord server.*_
    \n-# Our staff team will never ask for your personal information in server or via a direct message
    \n:point_right: **Panel URL**: [billing.nodebyte.host](https://billing.nodebyte.host)`);
};
