import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { checkScamMessage } from '../../lib/scamFilter';

export const data = new SlashCommandBuilder()
  .setName('scamfilter')
  .setDescription('Manage the crypto/payout giveaway scam filter')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(sub =>
    sub
      .setName('status')
      .setDescription('Check scam filter status')
  )
  .addSubcommand(sub =>
    sub
      .setName('test')
      .setDescription('Test a message against the scam filter')
      .addStringOption(opt =>
        opt
          .setName('message')
          .setDescription('The message text to test')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'status') {
    const embed = new EmbedBuilder()
      .setColor(0x3BB98E)
      .setTitle('Scam Filter Status')
      .addFields(
        { name: 'Status', value: '✅ Active', inline: true },
        { name: 'Detects', value: 'Crypto/payout giveaway scams (e.g. fake MrBeast giveaways, advance-fee wallet scams)', inline: false }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (subcommand === 'test') {
    const message = interaction.options.getString('message', true);
    const result = checkScamMessage(message);

    const embed = new EmbedBuilder()
      .setColor(result.isScam ? 0xFF5555 : 0x3BB98E)
      .setTitle('Scam Filter Test Result')
      .addFields(
        { name: 'Verdict', value: result.isScam ? '🚨 Would be deleted' : '✅ Would be allowed', inline: true },
        { name: 'Score', value: `${result.score}`, inline: true },
        { name: 'Signals', value: result.reasons.length > 0 ? result.reasons.map(r => `\`${r}\``).join(', ') : 'None', inline: false }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
