import { Client, EmbedBuilder, TextChannel, ThreadChannel, User } from 'discord.js';
import db from './db';
import { logger } from './logger';
import { generateTranscriptHTML, generateTranscriptSlug } from './transcriptGenerator';
import { createTranscriptUrl } from './transcriptServer';

export async function performTicketClose(
  ticketThread: ThreadChannel,
  closedBy: User,
  closeReason: string,
  client: Client
): Promise<{ success: boolean; error?: string }> {
  try {
    const ticket = await db.getTicket(ticketThread.id);
    if (!ticket) {
      return { success: false, error: '❌ Ticket not found.' };
    }

    const config = await db.getGuildConfig(ticketThread.guild!.id);
    const guild = ticketThread.guild!;
    const guildName = guild.name;

    // Generate HTML transcript
    let transcriptSlug = '';
    try {
      const messages = await ticketThread.messages.fetch({ limit: 100 });
      const sortedMessages = Array.from(messages.values());

      const htmlContent = await generateTranscriptHTML(
        ticketThread,
        guildName,
        ticketThread.name,
        sortedMessages,
        closedBy.tag,
        ticket.closeMsg || undefined,
        ticket.category,
        ticket.createMsg || undefined
      );

      transcriptSlug = generateTranscriptSlug();

      await db.createTranscript(
        guild.id,
        ticketThread.id,
        ticketThread.id,
        ticket.userId,
        ticket.category,
        transcriptSlug,
        htmlContent
      );

      logger.debug('Ticket HTML transcript generated and saved', {
        context: 'TicketClose',
        threadId: ticketThread.id,
        slug: transcriptSlug
      });
    } catch (transcriptErr) {
      logger.error('Failed to generate HTML transcript', {
        context: 'TicketClose',
        error: transcriptErr,
        threadId: ticketThread.id
      });
    }

    // Send to ticket logs channel
    try {
      const ticketLogsChannelId = config?.ticketLogChannelId;
      if (ticketLogsChannelId) {
        const logsChannel = guild.channels.cache.get(ticketLogsChannelId) as TextChannel;
        if (logsChannel && 'send' in logsChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x3256d9)
            .setTitle('🔒 Ticket Closed')
            .addFields(
              { name: 'Ticket', value: ticketThread.name, inline: true },
              { name: 'Category', value: ticket.category, inline: true },
              { name: 'Closed By', value: closedBy.toString(), inline: true },
              { name: 'Thread ID', value: ticketThread.id, inline: true },
              { name: 'Close Reason', value: closeReason, inline: false }
            )
            .setThumbnail(closedBy.displayAvatarURL())
            .setTimestamp();

          if (transcriptSlug) {
            logEmbed.addFields({
              name: 'Transcript Link',
              value: `[View Transcript](${createTranscriptUrl(transcriptSlug)})`,
              inline: false
            });
          }

          await logsChannel.send({ embeds: [logEmbed] }).catch(err => {
            logger.error('Failed to send logs to ticket logs channel', {
              context: 'TicketClose',
              error: err,
              logsChannelId: ticketLogsChannelId
            });
          });
        }
      }
    } catch (logsErr) {
      logger.warn('Error processing ticket logs channel', { context: 'TicketClose', error: logsErr });
    }

    // DM ticket creator
    try {
      const creatorUser = await client.users.fetch(ticket.userId);
      const dmEmbed = new EmbedBuilder()
        .setColor(0x3256d9)
        .setTitle('🎫 Your Ticket Has Been Closed')
        .setDescription(`Your **${ticket.category}** support ticket has been closed.`)
        .addFields(
          { name: 'Closed By:', value: closedBy.tag, inline: true },
          { name: 'Reason:', value: closeReason, inline: false }
        )
        .setTimestamp();

      if (transcriptSlug) {
        dmEmbed.addFields({
          name: '📄 View Your Transcript',
          value: `[Click here to view transcript](${createTranscriptUrl(transcriptSlug)})`,
          inline: false
        });
      }

      await creatorUser.send({ embeds: [dmEmbed] }).catch(dmErr => {
        logger.warn('Failed to send DM to user after ticket close', {
          context: 'TicketClose',
          error: dmErr,
          userId: ticket.userId
        });
      });
    } catch (userFetchErr) {
      logger.warn('Failed to fetch ticket creator for DM', {
        context: 'TicketClose',
        error: userFetchErr,
        userId: ticket.userId
      });
    }

    // Close DB record and archive thread
    await db.closeTicket(ticketThread.id, closedBy.id, closeReason);

    // Remove the ticket creator's permission override from the parent channel
    try {
      const parentChannel = ticketThread.parent as TextChannel;
      if (parentChannel) {
        await parentChannel.permissionOverwrites.delete(
          ticket.userId,
          `Ticket ${ticketThread.id} closed`
        );
      }
    } catch (permErr) {
      logger.warn('Failed to remove permission override for ticket creator', {
        context: 'TicketClose',
        error: permErr,
        threadId: ticketThread.id,
        userId: ticket.userId
      });
    }

    await ticketThread.send({
      content: `🔒 Ticket closed by ${closedBy.toString()}. This thread will be archived in 5 seconds.`
    });

    logger.info('Ticket closed successfully', {
      context: 'TicketClose',
      threadId: ticketThread.id,
      closedBy: closedBy.id,
      guildId: guild.id
    });

    setTimeout(async () => {
      try {
        await ticketThread.setArchived(true);
      } catch (archiveErr) {
        logger.error('Failed to archive ticket thread', {
          context: 'TicketClose',
          error: archiveErr,
          threadId: ticketThread.id
        });
      }
    }, 5000);

    return { success: true };
  } catch (err) {
    logger.error('Failed to close ticket', {
      context: 'TicketClose',
      error: err,
      threadId: ticketThread.id
    });
    return { success: false, error: '❌ Failed to close ticket.' };
  }
}
