import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('List available commands')
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  const client = interaction.client as any;
  const commands = Array.from(client.commands.values());

  // Categorize commands
  const categories: Record<string, any[]> = {
    'ℹ️ Information': [],    '🎮 Game Servers': [],    '🛡️ Moderation': [],
    '⚙️ Admin': [],
    '🎉 Fun': [],
    '🎫 Tickets': [],
    '👨‍💻 Developer': []
  };

  for (const cmd of commands) {
    const name = (cmd as any).data.name;
    
    // Categorize based on command name or folder
    if (['help', 'ping', 'botinfo', 'serverinfo', 'userinfo', 'uptime', 'roleinfo', 'channelinfo', 'links'].includes(name)) {
      categories['ℹ️ Information'].push(cmd);
    } else if (['fivemserver', 'fivemsearch', 'fivemresources', 'mcserver', 'rustserver', 'hytaleserver'].includes(name)) {
      categories['🎮 Game Servers'].push(cmd);
    } else if (['ban', 'kick', 'warn', 'warnings', 'case', 'unban', 'purge', 'timeout', 'malwarefilter'].includes(name)) {
      categories['🛡️ Moderation'].push(cmd);
    } else if (['reactionrole', 'config', 'setuptickets', 'addroles'].includes(name)) {
      categories['⚙️ Admin'].push(cmd);
    } else if (['8ball', 'coinflip', 'roll', 'avatar', 'hug', 'meme', 'joke'].includes(name)) {
      categories['🎉 Fun'].push(cmd);
    } else if (['clearcache', 'reload'].includes(name)) {
      categories['👨‍💻 Developer'].push(cmd);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0x3256d9)
    .setTitle('📚 Bot Commands')
    .setDescription('Here are all available commands. Use `/command` to execute.')
    .setThumbnail(interaction.client.user?.displayAvatarURL() || '')
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag} | ©Copyright 2024 - 2026 NodeByte LTD`, iconURL: interaction.user.displayAvatarURL() });

  // Add fields for each category
  for (const [category, cmds] of Object.entries(categories)) {
    if (cmds.length > 0) {
      const commandList = cmds.map((cmd: any) => {
        const description = cmd.data.description || 'No description';
        return `\`/${cmd.data.name}\` - ${description}`;
      }).join('\n');

      embed.addFields({ name: category, value: commandList, inline: false });
    }
  }

  // Add ticket system information
  embed.addFields({ 
    name: '🎫 Tickets', 
    value: 'To create a support ticket, DM the bot with the message `help` and a dropdown menu will appear for you to select your ticket category.', 
    inline: false 
  });

  await interaction.reply({ embeds: [embed], flags: [64] });
}
