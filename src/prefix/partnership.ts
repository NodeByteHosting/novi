import { Message } from 'discord.js';
import { PrefixCommandMetadata } from '../lib/prefixCommands';

export const metadata: PrefixCommandMetadata = {
  name: 'partnership',
  description: 'Partnership, sponsorship, and business inquiries for NodeByte hosting',
  category: '💼 Sales',
  aliases: ['partner', 'partners']
};

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`${pingText}### Partner & Sponsor with NodeByte
We're open to partnerships and sponsorships with communities, creators, and projects that align with what we do.

**What we need from you**
- Your platform(s) and approximate reach (members, subscribers, viewers, etc.)
- A brief description of your project or community
- What you're looking for partnership, sponsorship, or both
- What you can offer us in return (shoutout, logo placement, affiliate link, etc.)

**What you get**
Partners and sponsors receive a **custom discount code of your choice** giving your audience **10% off all products** in our billing panel.

**What we offer**
- VPS hosting for bots, websites, panels, and apps
- Game servers for communities, launches, and private networks
- Practical support from a team that understands hosting workloads

Open a sales/partnership ticket in <#1477220916709818470> and include the details above we'll get back to you!`);
};