import { Client, ActivityType, EmbedBuilder, TextChannel } from 'discord.js';

export default async (client: Client) => {
  console.log(`Ready: ${client.user?.tag}`);
  
  // Set bot status
  client.user?.setPresence({
    activities: [
      {
        name: 'NodeByte Services',
        type: ActivityType.Watching
      }
    ],
    status: 'online'
  });

  // Send ready embed to logs channel
  const logsChannelId = process.env.LOGS_CHANNEL_ID;
  if (logsChannelId) {
    for (const [guildId, guild] of client.guilds.cache) {
      const logsChannel = guild.channels.cache.get(logsChannelId) as TextChannel;
      if (logsChannel && 'send' in logsChannel) {
        const embed = new EmbedBuilder()
          .setColor(0x3256d9)
          .setTitle('✅ Bot Online')
          .setThumbnail(client.user?.displayAvatarURL() || '')
          .setDescription(`${client.user?.tag} is now online and ready!`)
          .setThumbnail(client.user?.displayAvatarURL() || '')
          .setTimestamp()
          .setFooter({ text: `Please don't the delete bot or restart the bot unnecessarily. | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

        try {
          await logsChannel.send({ embeds: [embed] });
        } catch (err) {
          console.error('Failed to send ready embed to logs channel', err);
        }
        break; // Only send to one guild's logs channel
      }
    }
  }
};
