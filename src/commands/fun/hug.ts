import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('hug')
  .setDescription('Hug someone!')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('The user to hug')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user', true);
  const hugger = interaction.user;

  if (user.id === hugger.id) {
    const embed = new EmbedBuilder()
      .setColor(0x3256d9)
      .setDescription(`🤗 ${hugger.toString()} hugs themselves! How sweet!`)
      .setTimestamp()
      .setFooter({ text: '\u00a9Copyright 2024 - 2025 NodeByte LTD' });

    return await interaction.reply({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setColor(0x3256d9)
    .setDescription(`🤗 ${hugger.toString()} gives ${user.toString()} a big hug!`)
    .setTimestamp()
    .setFooter({ text: '\u00a9Copyright 2024 - 2025 NodeByte LTD' });

  await interaction.reply({ embeds: [embed] });
}
