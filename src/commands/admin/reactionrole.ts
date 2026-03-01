import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ChannelType, TextChannel, PermissionsBitField } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('reactionrole')
  .setDescription('Post a role selection menu')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('The channel to send the role selection menu to')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has('ManageRoles'))
    return interaction.reply({ content: 'You need Manage Roles permission.', flags: [64] });

  const targetChannel = interaction.options.getChannel('channel', true) as TextChannel;

  if (!targetChannel || !('send' in targetChannel)) {
    return interaction.reply({ content: '❌ Invalid channel selected.', flags: [64] });
  }

  const embed = new EmbedBuilder()
    .setColor(0x3256d9)
    .setTitle('🎭 Role Selection')
    .setThumbnail(interaction.client.user?.displayAvatarURL() || '')
    .setDescription('**Choose your notification roles below!**\n\nClick the dropdown to add roles. Roles you select will be **added** to your current roles.\n\n**Available Roles:**\n✨ **Updates** - Server updates\n📊 **Status** - Server status notifications\n🔔 **Notified** - General notifications\n📝 **Applications** - Application updates\n⛏️ **Minecraft Alerts** - Minecraft server alerts\n🖥️ **VPS Alerts** - VPS server alerts\n\n*Note: Selecting a role you already have won\'t remove it*')
    .setFooter({ text: '\u00a9Copyright 2024 - 2025 NodeByte LTD' })
    .setTimestamp();

  const menu = new StringSelectMenuBuilder()
    .setCustomId('rr_select_1')
    .setPlaceholder('Click here to choose your roles...')
    .setMinValues(0)
    .setMaxValues(6)
    .addOptions([
      { 
        label: 'Updates', 
        description: 'Get notified about server updates',
        value: 'updates',
        emoji: '✨'
      },
      { 
        label: 'Status', 
        description: 'Get server status notifications',
        value: 'status',
        emoji: '📊'
      },
      { 
        label: 'Notified', 
        description: 'Get general notifications',
        value: 'notified',
        emoji: '🔔'
      },
      { 
        label: 'Applications', 
        description: 'Get notified about applications',
        value: 'applications',
        emoji: '📝'
      },
      { 
        label: 'Minecraft Alerts', 
        description: 'Get Minecraft server alerts',
        value: 'minecraft_alerts',
        emoji: '⛏️'
      },
      { 
        label: 'VPS Alerts', 
        description: 'Get VPS server alerts',
        value: 'vps_alerts',
        emoji: '🖥️'
      }
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

  await targetChannel.send({ embeds: [embed], components: [row] });
  
  await interaction.reply({ 
    content: `✅ Role selection menu has been posted in ${targetChannel.toString()}`, 
    flags: [64] 
  });
}
