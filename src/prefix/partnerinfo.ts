import { Message } from 'discord.js';
import { PrefixCommandMetadata } from '../lib/prefixCommands';

export const metadata: PrefixCommandMetadata = {
  name: 'partnerinfo',
  description: 'Partnership, sponsorship, and business inquiries for NodeByte hosting',
  category: '💼 Sales',
  aliases: ['newpartner', 'pi']
};

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`${pingText}### Partnership / Sponsorship Info
Thanks for opening a ticket. To review your request properly, please send us the following:

## Please include
- Your platform(s) and links
- Your approximate reach (members, followers, subscribers, average views, etc.)
- A short summary of your community, brand, or project
- Whether you want a **partnership**, **sponsorship**, **affiliate deal**, or **reseller deal**
- What you want from us
- What you can offer us in return
- Any media kit, past sponsorships, or promo examples if you have them

## What approved partners get
Approved partners and sponsors receive a **custom code of their choice** for a **fixed percentage off all products (eg. 10% off)** on our billing panel.

## What we do not offer
- Free services, free servers, or free hosting just for asking
- Free trials unless we specifically decide to offer one
- Giveaways or promotions with no clear benefit to both sides
- Deals with no reach, no audience info, or no proper proposal

Once you send the details above, our team can review the request properly.`);
};