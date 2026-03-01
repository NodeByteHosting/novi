import { Message } from 'discord.js';

export default async (message: Message, args: string[]) => {
  const embed = {
    color: 0x3256d9,
    title: 'Help - Prefix Commands',
    description: 'Available prefix-based commands. Use `!command` to invoke them. Reply to a user\'s message with a command to ping them!',
    fields: [
      {
        name: '📖 Documentation & Resources',
        value: '**!docs** - Knowledge base with guides for all game types\n**!faq** - Frequently asked questions\n**!support** - General support guidelines',
        inline: false
      },
      {
        name: '⚙️ Server Troubleshooting',
        value: '**!lag** - Fix server lag and low TPS\n**!crash** - Diagnose server crashes\n**!logs** - Access and share crash logs\n**!status** - Check server status and uptime',
        inline: false
      },
      {
        name: '🔍 Service Monitoring',
        value: '**!services** - Check NodeByte infrastructure status (game servers, web services)',
        inline: false
      },
      {
        name: '🔧 Server Configuration',
        value: '**!java** - Java version requirements per MC version\n**!update** - Update Minecraft server version\n**!mods** - Install and manage mods\n**!plugins** - Install and manage plugins',
        inline: false
      },
      {
        name: '🎮 Game Server Support',
        value: '**!vps** - Game server support guidelines (Aliases: !gs, !game, !gameserver)\n**!minecraft** - Minecraft-specific help (Alias: !mc)\n**!hytale** - Hytale server support\n**!rust** - Rust server support',
        inline: false
      },
      {
        name: '🎛️ Panel & Billing',
        value: '**!panel** - Access game panel at panel.nodebyte.host (Aliases: !p)\n**!billing** - Access billing at billing.nodebyte.host (Alias: !b)',
        inline: false
      },
      {
        name: '🎲 Fun Commands',
        value: '**!8ball** - Magic 8 ball\n**!coinflip** - Flip a coin\n**!roll** - Roll a dice\n**!joke** - Random joke\n**!meme** - Random meme\n**!avatar** - Show user avatar\n**!hug** - Give someone a hug',
        inline: false
      },
      {
        name: '💡 Server Info',
        value: '**!ping** - Bot latency\n**!uptime** - Bot uptime\n**!botinfo** - Bot information\n**!serverinfo** - Server information\n**!userinfo** - User information\n**!roleinfo** - Role information\n**!channelinfo** - Channel information\n**!links** - Useful links',
        inline: false
      }
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: '© Copyright 2024 - 2026 NodeByte LTD'
    }
  };

  await message.reply({ embeds: [embed] });
};
