import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField, EmbedBuilder, TextChannel } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Delete multiple messages at once')
  .addIntegerOption(option =>
    option.setName('amount')
      .setDescription('Number of messages to delete (1-100)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .addUserOption(option =>
    option.setName('user')
      .setDescription('Only delete messages from this user (optional)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // Check permissions
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Permission Denied')
      .setDescription('You need the **Manage Messages** permission to use this command.')
      .setFooter({ text: '\u00a9Copyright 2024 - 2025 NodeByte LTD' })
      .setTimestamp();

    return interaction.reply({ embeds: [errorEmbed], flags: [64] });
  }

  const amount = interaction.options.getInteger('amount', true);
  const targetUser = interaction.options.getUser('user');
  const channel = interaction.channel as TextChannel;

  if (!channel || !channel.isTextBased()) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Invalid Channel')
      .setDescription('This command can only be used in text channels.')
      .setFooter({ text: '\u00a9Copyright 2024 - 2025 NodeByte LTD' })
      .setTimestamp();

    return interaction.reply({ embeds: [errorEmbed], flags: [64] });
  }

  await interaction.deferReply({ flags: [64] });

  try {
    let deleted = 0;

    if (targetUser) {
      // Fetch messages and filter by user
      const messages = await channel.messages.fetch({ limit: 100 });
      const userMessages = messages.filter(msg => msg.author.id === targetUser.id).first(amount);
      
      if (userMessages.length === 0) {
        const noMessagesEmbed = new EmbedBuilder()
          .setColor(0xFFFF00)
          .setTitle('⚠️ No Messages Found')
          .setDescription(`No messages from ${targetUser.toString()} found in the last 100 messages.`)
          .setFooter({ text: '\u00a9Copyright 2024 - 2025 NodeByte LTD' })
          .setTimestamp();

        return interaction.editReply({ embeds: [noMessagesEmbed] });
      }

      // Delete messages one by one if older than 14 days
      for (const msg of userMessages) {
        try {
          await msg.delete();
          deleted++;
        } catch (err) {
          console.error('Failed to delete message', err);
        }
      }
    } else {
      // Bulk delete messages
      const deletedMessages = await channel.bulkDelete(amount, true);
      deleted = deletedMessages.size;
    }

    const successEmbed = new EmbedBuilder()
      .setColor(0x3256d9)
      .setTitle('🗑️ Messages Purged')
      .setDescription(
        `Successfully deleted **${deleted}** message${deleted !== 1 ? 's' : ''}` +
        (targetUser ? ` from ${targetUser.toString()}` : '') +
        ` in ${channel.toString()}`
      )
      .addFields(
        { name: 'Moderator:', value: interaction.user.toString(), inline: true },
        { name: 'Amount:', value: `${deleted}`, inline: true },
        { name: 'Channel:', value: channel.toString(), inline: true }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: `Moderator ID: ${interaction.user.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

    // Log to moderation logs channel
    const logsChannelId = process.env.LOGS_CHANNEL_ID;
    if (logsChannelId) {
      const logsChannel = interaction.guild?.channels.cache.get(logsChannelId) as TextChannel;
      if (logsChannel && 'send' in logsChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(0x3256d9)
          .setTitle('🗑️ Purge Command Used')
          .setDescription(`${interaction.user.toString()} purged messages in ${channel.toString()}`)
          .addFields(
            { name: 'Moderator:', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
            { name: 'Messages Deleted:', value: `${deleted}`, inline: true },
            { name: 'Channel:', value: channel.toString(), inline: true }
          )
          .setFooter({ text: `Moderator ID: ${interaction.user.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` })
          .setTimestamp();

        if (targetUser) {
          logEmbed.addFields({ name: 'Target User', value: `${targetUser.tag} (${targetUser.id})`, inline: false });
        }

        await logsChannel.send({ embeds: [logEmbed] });
      }
    }

  } catch (err) {
    console.error('Failed to purge messages', err);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Purge Failed')
      .setDescription('Failed to delete messages. Messages older than 14 days cannot be bulk deleted.')
      .setFooter({ text: '\u00a9Copyright 2024 - 2025 NodeByte LTD' })
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
