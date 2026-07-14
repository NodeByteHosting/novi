import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { checkScamMessage } from '../../lib/scamFilter';
import { isMalicious } from '../../lib/malwareFilter';
import { isOcrEligibleAttachment, extractTextFromImage } from '../../lib/imageOcr';

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
  )
  .addSubcommand(sub =>
    sub
      .setName('test-image')
      .setDescription('Run OCR + the scam/malware filters against an image')
      .addAttachmentOption(opt =>
        opt
          .setName('image')
          .setDescription('The image to test')
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

  if (subcommand === 'test-image') {
    const attachment = interaction.options.getAttachment('image', true);

    if (!isOcrEligibleAttachment(attachment)) {
      return interaction.reply({
        content: `❌ That attachment isn't eligible for OCR (must be PNG/JPEG/WEBP/BMP, ≤8MB). Content type: \`${attachment.contentType || 'unknown'}\`, size: ${attachment.size} bytes.`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const ocrText = await extractTextFromImage(attachment.url);

    if (!ocrText) {
      return interaction.editReply({
        content: '⚠️ OCR extracted no readable text from this image (or extraction failed/timed out).',
      });
    }

    const scamResult = checkScamMessage(ocrText);
    const malwareResult = isMalicious(ocrText);
    const wouldBeDeleted = scamResult.isScam || malwareResult.isMalicious;

    const truncatedText = ocrText.length > 1000 ? `${ocrText.slice(0, 1000)}…` : ocrText;

    const embed = new EmbedBuilder()
      .setColor(wouldBeDeleted ? 0xFF5555 : 0x3BB98E)
      .setTitle('Image Filter Test Result')
      .addFields(
        { name: 'Verdict', value: wouldBeDeleted ? '🚨 Would be deleted' : '✅ Would be allowed', inline: true },
        { name: 'Scam Score', value: `${scamResult.score}`, inline: true },
        { name: 'Malware Match', value: malwareResult.isMalicious ? `\`${malwareResult.matched}\`` : 'None', inline: true },
        { name: 'Scam Signals', value: scamResult.reasons.length > 0 ? scamResult.reasons.map(r => `\`${r}\``).join(', ') : 'None', inline: false },
        { name: 'OCR Extracted Text', value: `\`\`\`${truncatedText}\`\`\`` }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
}
