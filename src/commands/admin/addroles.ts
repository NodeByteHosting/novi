import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { logger } from '../../lib/logger';

export const data = new SlashCommandBuilder()
  .setName('addroles')
  .setDescription('Add roles to members missing them')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand(sub =>
    sub
      .setName('members')
      .setDescription('Add member role to all human members missing it')
  )
  .addSubcommand(sub =>
    sub
      .setName('bots')
      .setDescription('Add bot role to all bot members missing it')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has('ManageRoles')) {
    return interaction.reply({ 
      content: 'You need Manage Roles permission.', 
      flags: [64] 
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const subcommand = interaction.options.getSubcommand();
  const memberRoleId = process.env.MEMBER_ROLE_ID;
  const botRoleId = process.env.BOT_ROLE_ID;

  try {
    if (subcommand === 'members') {
      if (!memberRoleId) {
        return interaction.editReply({
          content: 'MEMBER_ROLE_ID is not configured in environment variables.',
        });
      }

      // Fetch all members
      const members = await interaction.guild!.members.fetch();
      
      // Filter for humans (not bots) who don't have the member role
      const humansNeedingRole = members.filter(
        m => !m.user.bot && !m.roles.cache.has(memberRoleId)
      );

      if (humansNeedingRole.size === 0) {
        const embed = new EmbedBuilder()
          .setColor(0x3BB98E)
          .setTitle('Role Assignment Complete')
          .setDescription('All human members already have the member role.')
          .setTimestamp();
        
        return interaction.editReply({ embeds: [embed] });
      }

      let addedCount = 0;
      let failedCount = 0;
      const failedMembers: string[] = [];

      // Add role to each member
      for (const [, member] of humansNeedingRole) {
        try {
          await member.roles.add(memberRoleId);
          addedCount++;
          logger.debug(`Added member role to ${member.user.tag}`, {
            context: 'AddRolesCommand',
            userId: member.user.id,
          });
        } catch (err) {
          failedCount++;
          failedMembers.push(`${member.user.tag} (${member.user.id})`);
          logger.warn(`Failed to add member role to ${member.user.tag}`, {
            context: 'AddRolesCommand',
            userId: member.user.id,
            error: err,
          });
        }
      }

      logger.info('Member role batch assignment completed', {
        context: 'AddRolesCommand',
        totalToAdd: humansNeedingRole.size,
        addedCount,
        failedCount,
        guildId: interaction.guild!.id,
      });

      const embed = new EmbedBuilder()
        .setColor(addedCount > 0 ? 0x3BB98E : 0xFF5555)
        .setTitle('Member Role Assignment')
        .addFields(
          { name: 'Total Members Processed', value: String(humansNeedingRole.size), inline: true },
          { name: 'Successfully Added', value: String(addedCount), inline: true },
          { name: 'Failed', value: String(failedCount), inline: true }
        );

      if (failedMembers.length > 0 && failedMembers.length <= 10) {
        embed.addField('Failed Members', failedMembers.join('\n'), false);
      } else if (failedMembers.length > 10) {
        embed.addField('Failed Members', `${failedMembers.slice(0, 10).join('\n')}\n... and ${failedMembers.length - 10} more`, false);
      }

      embed.setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'bots') {
      if (!botRoleId) {
        return interaction.editReply({
          content: 'BOT_ROLE_ID is not configured in environment variables.',
        });
      }

      // Fetch all members
      const members = await interaction.guild!.members.fetch();
      
      // Filter for bots who don't have the bot role
      const botsNeedingRole = members.filter(
        m => m.user.bot && !m.roles.cache.has(botRoleId)
      );

      if (botsNeedingRole.size === 0) {
        const embed = new EmbedBuilder()
          .setColor(0x3BB98E)
          .setTitle('Role Assignment Complete')
          .setDescription('All bot members already have the bot role.')
          .setTimestamp();
        
        return interaction.editReply({ embeds: [embed] });
      }

      let addedCount = 0;
      let failedCount = 0;
      const failedBots: string[] = [];

      // Add role to each bot
      for (const [, member] of botsNeedingRole) {
        try {
          await member.roles.add(botRoleId);
          addedCount++;
          logger.debug(`Added bot role to ${member.user.tag}`, {
            context: 'AddRolesCommand',
            userId: member.user.id,
          });
        } catch (err) {
          failedCount++;
          failedBots.push(`${member.user.tag} (${member.user.id})`);
          logger.warn(`Failed to add bot role to ${member.user.tag}`, {
            context: 'AddRolesCommand',
            userId: member.user.id,
            error: err,
          });
        }
      }

      logger.info('Bot role batch assignment completed', {
        context: 'AddRolesCommand',
        totalToAdd: botsNeedingRole.size,
        addedCount,
        failedCount,
        guildId: interaction.guild!.id,
      });

      const embed = new EmbedBuilder()
        .setColor(addedCount > 0 ? 0x3BB98E : 0xFF5555)
        .setTitle('Bot Role Assignment')
        .addFields(
          { name: 'Total Bots Processed', value: String(botsNeedingRole.size), inline: true },
          { name: 'Successfully Added', value: String(addedCount), inline: true },
          { name: 'Failed', value: String(failedCount), inline: true }
        );

      if (failedBots.length > 0 && failedBots.length <= 10) {
        embed.addField('Failed Bots', failedBots.join('\n'), false);
      } else if (failedBots.length > 10) {
        embed.addField('Failed Bots', `${failedBots.slice(0, 10).join('\n')}\n... and ${failedBots.length - 10} more`, false);
      }

      embed.setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  } catch (err) {
    logger.error('Error in addroles command', {
      context: 'AddRolesCommand',
      error: err,
      guildId: interaction.guild!.id,
    });

    return interaction.editReply({
      content: 'An error occurred while adding roles. Check logs for details.',
    });
  }
}
