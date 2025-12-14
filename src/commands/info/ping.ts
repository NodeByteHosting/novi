import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder().setName('ping').setDescription('Replies with pong');

export async function execute(interaction: ChatInputCommandInteraction) {
  const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
  const ms = (sent as any).createdTimestamp - interaction.createdTimestamp;
  
  const embed = new EmbedBuilder()
    .setColor(0x3256d9)
    .setTitle('🏓 Pong!')
    .setThumbnail(interaction.client.user?.displayAvatarURL() || '')
    .addFields(
      { name: 'API Latency:', value: `${Math.round(ms)}ms`, inline: true },
      { name: 'WebSocket Ping:', value: `${Math.round(interaction.client.ws.ping)}ms`, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: '\u00a9Copyright 2024 - 2025 NodeByte LTD' });

  await interaction.editReply({ content: '', embeds: [embed] });
}
