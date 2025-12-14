import { Client, Message, PartialMessage, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

export default async (client: Client, oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
  if (!oldMessage.guild) return;
  if (oldMessage.author?.bot) return;
  
  // Skip if we don't have author information
  if (!oldMessage.author || !newMessage.author) return;
  
  const logsId = process.env.LOGS_CHANNEL_ID;
  if (!logsId) return;
  const ch = oldMessage.guild.channels.cache.get(logsId as string);
  if (!ch || !('send' in (ch as any))) return;

  const createdTimestamp = oldMessage.createdTimestamp ? Math.floor(oldMessage.createdTimestamp / 1000) : null;
  
  const embed = new EmbedBuilder()
    .setColor(0x3256d9)
    .setTitle('📝 Message Edited')
    .setDescription(
      `**Channel:** ${oldMessage.channel.toString()}\n` +
      `**Message ID:** ${oldMessage.id}\n` +
      `**Author:** ${oldMessage.author.toString()} (@${oldMessage.author.username})\n` +
      (createdTimestamp ? `**Created:** <t:${createdTimestamp}:R>` : '**Created:** Unknown')
    )
    .addFields(
      { name: 'Before', value: oldMessage.content?.slice(0, 1024) || '[No content cached]', inline: false },
      { name: 'After', value: newMessage.content?.slice(0, 1024) || '[No content cached]', inline: false }
    )
    .setThumbnail(oldMessage.author.displayAvatarURL())
    .setFooter({ text: `Author ID: ${oldMessage.author.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` })
    .setTimestamp();

  (ch as any).send({ embeds: [embed] }).catch(() => null);
};
