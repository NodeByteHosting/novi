import { Message } from 'discord.js';
import { PrefixCommandMetadata } from '../lib/prefixCommands';

export const metadata: PrefixCommandMetadata = {
  name: 'bytesend',
  description: 'ByteSend documentation - Email delivery, SMTP, self-hosting, and guides',
  category: '📖 Documentation & Resources'
};

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  await message.reply(`${pingText}**ByteSend Documentation**

**Getting Started:**
- Quick Start: <https://docs.bytesend.cloud/get-started/smtp>

**Self-Hosting:**
- Overview: <https://docs.bytesend.cloud/self-hosting/overview>
- SMTP Server: <https://docs.bytesend.cloud/self-hosting/smtp-server>
- Certificates: <https://docs.bytesend.cloud/self-hosting/certificates>
- Firewall: <https://docs.bytesend.cloud/self-hosting/firewall>
- Reverse Proxy: <https://docs.bytesend.cloud/self-hosting/reverse-proxy>
- Security: <https://docs.bytesend.cloud/self-hosting/security>

**Guides:**
- Webhooks: <https://docs.bytesend.cloud/guides/webhooks>
- Double Opt-In: <https://docs.bytesend.cloud/guides/double-opt-in>
- Campaign Personalization: <https://docs.bytesend.cloud/guides/campaign-personalization>
- React Email Integration: <https://docs.bytesend.cloud/guides/use-with-react-email>

:point_right: **Website**: [bytesend.cloud](https://bytesend.cloud)`);
};
