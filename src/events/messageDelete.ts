import { Client, Message, EmbedBuilder, PartialMessage } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

export default async (client: Client, message: Message | PartialMessage) => {
  if (!message.guild) return;
  const logsId = process.env.LOGS_CHANNEL_ID;
  if (!logsId) return;
  const ch = message.guild.channels.cache.get(logsId as string);
  if (!ch || !('send' in (ch as any))) return;

  const createdTimestamp = message.createdTimestamp ? Math.floor(message.createdTimestamp / 1000) : null;
  
  // Get message content - handle partial messages
  let content = '[Message not cached - content unavailable]';
  if (message.content) {
    content = message.content.slice(0, 1024);
  } else if (message.partial) {
    content = '[Partial message - content not cached]';
  } else if (message.attachments && message.attachments.size > 0) {
    content = `[${message.attachments.size} attachment(s)]`;
  } else if (message.embeds && message.embeds.length > 0) {
    content = `[${message.embeds.length} embed(s)]`;
  }
  
  const embed = new EmbedBuilder()
    .setColor(0x3256d9)
    .setTitle('🗑️ Message Deleted')
    .setDescription(
      `**Channel:** ${message.channel.toString()}\n` +
      `**Message ID:** ${message.id}\n` +
      `**Author:** ${message.author ? message.author.toString() + ` (@${message.author.username})` : 'Unknown'}\n` +
      (createdTimestamp ? `**Created:** <t:${createdTimestamp}:R>` : '**Created:** Unknown')
    )
    .addFields(
      { name: 'Content', value: content || '[Empty message]', inline: false }
    )
    .setThumbnail(message.author?.displayAvatarURL() || null)
    .setFooter({ text: `Author ID: ${message.author?.id || 'Unknown'} | \u00a9Copyright 2024 - 2025 NodeByte LTD` })
    .setTimestamp();

  // Add attachment info if available
  if (message.attachments && message.attachments.size > 0) {
    const attachmentList = message.attachments.map(a => `[${a.name}](${a.url})`).join('\n').slice(0, 1024);
    embed.addFields({ name: 'Attachments', value: attachmentList, inline: false });
  }

  (ch as any).send({ embeds: [embed] }).catch(() => null);
};
