import { Message } from 'discord.js';
import { getAllCategories, getCommandsByCategory, formatCommand, loadPrefixCommandsMetadata } from '../lib/prefixCommands';

export default async (message: Message, args: string[]) => {
  // Load metadata dynamically from actual command files
  await loadPrefixCommandsMetadata();
  
  const categories = getAllCategories();
  
  const fields = categories.map(category => {
    const commands = getCommandsByCategory(category);
    const value = commands
      .map(cmd => formatCommand(cmd))
      .join('\n');
    
    return {
      name: category,
      value: value,
      inline: false
    };
  });

  // Add slash commands reference
  fields.push({
    name: '🌐 Slash Commands',
    value: 'Use `/help` for a complete list of slash commands including:\n• **FiveM Tools**: `/fivemserver`, `/fivemsearch`, `/fivemresources`\n• **Moderation**: `/ban`, `/kick`, `/warn`, `/timeout`, `/purge`, etc.\n• **Admin**: `/config`, `/reactionrole`, `/addroles`, etc.\n• **Fun**: `/8ball`, `/coinflip`, `/roll`, `/joke`, `/meme`, etc.\n• **Info**: `/ping`, `/uptime`, `/botinfo`, `/serverinfo`, etc.',
    inline: false
  });

  const embed = {
    color: 0x3256d9,
    title: '📚 Help - Prefix Commands',
    description: 'Available prefix-based commands. Use `!command` to invoke them. Reply to a user\'s message with a command to ping them!',
    fields: fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: '© Copyright 2024 - 2026 NodeByte LTD'
    }
  };

  await message.reply({ embeds: [embed] });
};
