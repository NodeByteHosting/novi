import { Client, GuildMember, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

export default async (client: Client, member: GuildMember) => {
  const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
  const logsChannelId = process.env.LOGS_CHANNEL_ID;
  const memberRoleId = process.env.MEMBER_ROLE_ID;

  // Auto-assign member role
  if (memberRoleId) {
    try {
      await member.roles.add(memberRoleId);
      console.log(`Assigned member role to ${member.user.tag}`);
    } catch (err) {
      console.error(`Failed to assign member role to ${member.user.tag}:`, err);
    }
  }

  const welcome = member.guild.channels.cache.get(welcomeChannelId as string);
  const logs = member.guild.channels.cache.get(logsChannelId as string);

  // Welcome embed for general channel
  const welcomeEmbed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle('Welcome to the Server!')
    .setDescription(`Welcome ${member.user.toString()}! to NodeByte!.`)
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() || undefined });

  // Log embed for mod channel
  const logEmbed = new EmbedBuilder()
    .setColor(0x3256d9)
    .setTitle('Member joined')
    .setDescription(
      `**User:** ${member.user.toString()} (@${member.user.username})\n` +
      `**User ID:** ${member.user.id}\n` +
      `**Account created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n` +
      `**Member count:** ${member.guild.memberCount}`
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp()
    .setFooter({ text: `ID: ${member.user.id} | \u00a9Copyright 2024 - 2025 NodeByte LTD` });

  if (welcome && 'send' in (welcome as any)) (welcome as any).send({ embeds: [welcomeEmbed] }).catch(() => null);
  if (logs && 'send' in (logs as any)) (logs as any).send({ embeds: [logEmbed] }).catch(() => null);
};
