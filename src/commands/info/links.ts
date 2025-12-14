import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('links')
  .setDescription('Get useful links and services');

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x3256d9)
    .setTitle('🔗 NodeByte Links & Services')
    .setDescription('Here are our official links and services:')
    .addFields(
      { name: '🌐 Website:', value: '[Visit our website](https://nodebyte.host/)', inline: false },
      { name: '🧙‍♂️ LTD Website:', value: '[Visit our ltd website](https://nodebyte.co.uk/)', inline: false },
      { name: '📞 Support Tickets:', value: '[Get Support](https://billing.nodebyte.host/supporttickets.php)', inline: false },
      { name: '📧 Support Email:', value: '[support@nodebyte.host](mailto:support@nodebyte.host)', inline: false },
      { name: '💼 Dashboard:', value: '[Client Dashboard](https://billing.nodebyte.host/)', inline: false },
      { name: '🎮 Game Panel:', value: '[Visit our Panel](https://panel.nodebyte.host/)', inline: false },
      { name: '📚 Documentation:', value: '[View Documentation](https://docs.nodebyte.co.uk/)', inline: false },
      { name: '📖 Blog:', value: '[Read our Blog](https://blog.nodebyte.co.uk/)', inline: false },
      { name: '💬 Discord:', value: '[Join our Discord](https://discord.gg/2UH8XRQeEM)', inline: false },
      { name: '🐦 Twitter/X:', value: '[Follow us on X](https://x.com/@NodeByteHosting)', inline: false }
    )
    .setThumbnail(interaction.client.user?.displayAvatarURL() || '')
    .setTimestamp()
    .setFooter({ text: '\u00a9Copyright 2024 - 2025 NodeByte LTD' });

  await interaction.reply({ embeds: [embed] });
}
