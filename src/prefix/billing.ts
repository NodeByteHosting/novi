import { Message } from 'discord.js';
import { PrefixCommandMetadata } from '../lib/prefixCommands';

export const metadata: PrefixCommandMetadata = {
  name: 'billing',
  description: 'Billing, invoices, renewals, and plan questions for hosting customers',
  category: '💼 Sales',
  aliases: ['billing', 'b']
};

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`${pingText}### Billing & Orders
Need help with plans, invoices, renewals, or payments? Our sales team can help.

**We can help with**
- VPS plans and upgrades
- Game server plans and renewals
- Billing questions, invoices, and payment issues
- Account changes before launch or expansion

**Open a ticket**
[billing.nodebyte.host](https://billing.nodebyte.host/tickets/create)`);
};