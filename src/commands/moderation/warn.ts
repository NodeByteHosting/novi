import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionsBitField, TextChannel } from 'discord.js';
import db from '../../lib/db';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Warn a user')
  .addUserOption((o) => o.setName('target').setDescription('User to warn').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers))
    return interaction.reply({ content: '❌ You lack permission to warn members.', flags: [64] });

  const target = interaction.options.getUser('target', true);
  const reason = interaction.options.getString('reason', true);

  if (target.id === interaction.user.id)
    return interaction.reply({ content: '❌ You cannot warn yourself.', flags: [64] });

  if (target.bot)
    return interaction.reply({ content: '❌ You cannot warn bots.', flags: [64] });

  const member = await interaction.guild?.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ Member not found in guild.', flags: [64] });

  try {
    // Add warning to database
    await db.addWarning(interaction.guild!.id, target.id, interaction.user.id, reason);

    // Log to database
    await db.logModeration('warn', interaction.guild!.id, interaction.user.id, target.id, reason);

    // Send DM to user
    const dmSent = await db.sendDM(target, 'warned', interaction.guild?.name || 'Unknown Server', reason, interaction.user);

    // Send to mod logs channel
    const logsChannelId = process.env.LOGS_CHANNEL_ID;
    const logsChannel = interaction.guild?.channels.cache.get(logsChannelId as string) as TextChannel;
    await db.sendModLog(logsChannel, 'warn', interaction.user, target, reason);

    // Get total warnings
    const warnings = await db.getWarnings(interaction.guild!.id, target.id);

    await interaction.reply({ 
      content: `⚠️ Warned **${target.tag}** — ${reason}\n📊 Total warnings: ${warnings.length}${!dmSent ? '\n⚠️ Could not DM user.' : ''}` 
    });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: '❌ Failed to warn user.', flags: [64] });
  }
}
