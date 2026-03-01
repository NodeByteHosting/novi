import { Client, Message, PartialMessage, EmbedBuilder, TextChannel } from 'discord.js';
import db from '../lib/db';
import { logger } from '../lib/logger';

export default async (client: Client, oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
  if (!oldMessage.guild) return;
  if (oldMessage.author?.bot) return;
  
  // Skip if we don't have author information
  if (!oldMessage.author || !newMessage.author) return;

  try {
    const config = await db.getGuildConfig(oldMessage.guild.id);
    const logsId = config?.logsChannelId;
    if (!logsId) return;

    const ch = oldMessage.guild.channels.cache.get(logsId as string) as TextChannel;
    if (!ch) {
      logger.warn('Logs channel not found in cache', {
        context: 'MessageUpdate',
        logsId,
        guildId: oldMessage.guild.id
      });
      return;
    }

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
      .setFooter({ text: `Author ID: ${oldMessage.author.id} | \u00a9Copyright 2024 - 2026 NodeByte LTD` })
      .setTimestamp();

    await db.sendLogMessage(ch, embed, 'MessageUpdate');
  } catch (err) {
    logger.error('Error in messageUpdate event handler', {
      context: 'MessageUpdate',
      error: err,
      messageId: oldMessage.id,
      guildId: oldMessage.guild?.id
    });
  }
};
