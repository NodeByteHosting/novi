import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('coinflip')
  .setDescription('Flip a coin')
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
  const emoji = result === 'Heads' ? '🪙' : '🎰';

  const embed = new EmbedBuilder()
    .setColor(0x3256d9)
    .setTitle('🪙 Coin Flip')
    .setDescription(`${emoji} The coin landed on **${result}**!`)
    .setTimestamp()
    .setFooter({ text: '\u00a9Copyright 2024 - 2025 NodeByte LTD' });

  await interaction.reply({ embeds: [embed] });
}
