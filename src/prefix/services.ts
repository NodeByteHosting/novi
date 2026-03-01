import { Message, EmbedBuilder } from 'discord.js';
import { checkAllServices } from '../lib/serviceStatus';

export default async (message: Message, args: string[]) => {
  const targetUser = message.reference && message.reference.messageId
    ? await message.channel.messages.fetch(message.reference.messageId).then(m => m.author)
    : null;

  const pingText = targetUser ? `${targetUser.toString()} ` : '';

  // Send initial message indicating we're checking
  const checkingMessage = await message.reply(`${pingText}Checking service status...`);

  try {
    const { gameServers, clientServices, webServices, timestamp } = await checkAllServices();

    const gameServersOnline = gameServers.filter(s => s.status === 'online').length;
    const clientServicesOnline = clientServices.filter(s => s.status === 'online').length;
    const webServicesOnline = webServices.filter(s => s.status === 'online').length;
    const totalOnline = gameServersOnline + clientServicesOnline + webServicesOnline;
    const totalServices = gameServers.length + clientServices.length + webServices.length;

    // Determine color based on status
    const allOnline = totalOnline === totalServices;
    const someOnline = totalOnline > 0;
    const color = allOnline ? 0x3BB98E : someOnline ? 0xFFA500 : 0xFF5555;

    const gameServerText = gameServers
      .map(s => {
        const status = s.status === 'online' ? '✓' : '✗';
        const time = s.responseTime ? ` (${s.responseTime}ms)` : '';
        return `${status} ${s.name}${time}`;
      })
      .join('\n') || 'No game servers configured';

    const dedicatedServerText = clientServices
      .map(s => {
        const status = s.status === 'online' ? '✓' : '✗';
        const time = s.responseTime ? ` (${s.responseTime}ms)` : '';
        return `${status} ${s.name}${time}`;
      })
      .join('\n') || 'No client services configured';

    const webServiceText = webServices
      .map(s => {
        const status = s.status === 'online' ? '✓' : '✗';
        const code = s.statusCode ? ` [${s.statusCode}]` : '';
        const time = s.responseTime ? ` (${s.responseTime}ms)` : '';
        return `${status} ${s.name}${code}${time}`;
      })
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('NodeByte Service Status')
      .addFields(
        { name: 'Game Servers', value: gameServerText, inline: false },
        { name: 'Client Services', value: dedicatedServerText, inline: false },
        { name: 'Web Services', value: webServiceText || 'No services to check', inline: false },
        { name: 'Overall Status', 
          value: `${totalOnline}/${totalServices} services online`,
          inline: false 
        }
      )
      .setFooter({ text: `Last checked at ${timestamp.toLocaleTimeString()}` })
      .setTimestamp();

    await checkingMessage.edit({ content: '', embeds: [embed] });
  } catch (err) {
    await checkingMessage.edit({
      content: `${pingText}Failed to check service status. Please try again later.`,
    });
  }
};
