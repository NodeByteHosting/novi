# Novi

Novi is a modern Discord bot built for NodeByte, providing comprehensive support tools, server management utilities, and community engagement features.

## Features

### Support & Documentation
- **Knowledge Base Integration** - Direct links to comprehensive guides for Minecraft, Hytale, and Rust servers
- **Troubleshooting Commands** - Built-in diagnostics for server lag, crashes, and performance issues
- **Log Management** - Easy access to server logs with paste.gg integration for sharing
- **FAQ System** - Common questions and answers for quick reference

### Server Management
- **Malware Protection** - Automated detection and blocking of malicious links
- **Moderation Tools** - Warning, kick, and ban functionality with case tracking
- **Transcript System** - Generate beautiful HTML transcripts of support tickets with responsive design
- **Server Configuration Management** - Java version switching, plugin management, mod installation guides

### Community Features
- **Fun Commands** - Magic 8 ball, coin flip, dice roll, jokes, memes, avatars, and more
- **Server Information** - Real-time data on server status, user info, role info, and channel details
- **Performance Monitoring** - Uptime tracking and bot health checks

## Technical Stack

- **Runtime**: Node.js 18+
- **Framework**: Discord.js 14.25.1
- **Language**: TypeScript 5.5.0
- **Database**: PostgreSQL with Prisma ORM 5.8.0
- **Web Server**: Express 5.2.1 (transcript viewer)
- **Task Runner**: Bun

## Installation

### Prerequisites
- Node.js 18 or higher
- PostgreSQL database
- Discord bot token and client ID
- Environment variables configured

### Setup

1. Clone the repository
```bash
git clone <repository-url>
cd client
```

2. Install dependencies
```bash
npm install
# or with Bun
bun install
```

3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your values:
# - BOT_TOKEN: Your Discord bot token
# - CLIENT_ID: Your Discord application ID
# - GUILD_ID: Your test guild ID
# - TRANSCRIPT_PORT: Port for transcript viewer (default: 3000)
# - DATABASE_URL: PostgreSQL connection string
# - MODERATION_LOG_CHANNEL_ID: Channel for moderation logs
```

4. Set up the database
```bash
npx prisma migrate dev
```

5. Start the bot
```bash
npm run dev
# or with Bun
bun dev
```

## Commands

### Documentation
- `!docs` - Knowledge base with guides for all game types
- `!faq` - Frequently asked questions
- `!help` - Complete command reference

### Troubleshooting
- `!lag` - Fix server lag and low TPS
- `!crash` - Diagnose server crashes
- `!logs` - Access and share crash logs
- `!status` - Check server status and uptime

### Configuration
- `!java` - Java version requirements
- `!update` - Update server version
- `!mods` - Mod installation and management
- `!plugins` - Plugin installation and management

### Server Support
- `!vps` - Game server support
- `!minecraft` - Minecraft-specific help
- `!hytale` - Hytale server support
- `!rust` - Rust server support

### Utilities
- `!panel` - Link to game panel
- `!billing` - Link to billing panel
- `!ping` - Bot latency
- `!botinfo` - Bot information
- `!serverinfo` - Server information

### Fun
- `!8ball` - Magic 8 ball
- `!coinflip` - Flip a coin
- `!roll` - Roll a dice
- `!joke` - Random joke
- `!meme` - Random meme
- `!avatar` - Show user avatar
- `!hug` - Give someone a hug

## Prefix Commands

All support commands use the `!` prefix. You can reply to a user's message with a command to automatically ping them in your response.

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BOT_TOKEN` | Discord bot token | Yes |
| `CLIENT_ID` | Discord application client ID | Yes |
| `GUILD_ID` | Guild ID for development | Yes |
| `TRANSCRIPT_PORT` | Port for transcript viewer | No (default: 3000) |
| `TRANSCRIPT_BASE_URL` | Base URL for transcripts | No (defaults to localhost) |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `MODERATION_LOG_CHANNEL_ID` | Channel ID for moderation logs | No |

### Database

Novi uses Prisma ORM with PostgreSQL. The schema includes:
- Tickets and transcripts
- Moderation cases (warnings, kicks, bans)
- Server configuration storage

Run migrations with:
```bash
npx prisma migrate dev
npx prisma studio  # View database UI
```

## Security

- **Malware Protection**: Automatic detection and blocking of known malicious domains and phishing links
- **Moderation Tools**: Comprehensive warning, muting, and ban system
- **Case Tracking**: Full audit trail of moderation actions
- **Message Scanning**: Real-time content analysis for malicious content

## Development

### Project Structure
```
src/
  commands/          # Slash and prefix commands
  events/            # Discord event handlers
  lib/               # Utilities (logger, database, filters)
  prefix/            # Prefix command handlers
  index.ts           # Bot entry point
```

### Building
```bash
# Type check
npm run typecheck

# Build
npm run build

# Development with auto-reload
npm run dev
```

### Testing

Run the type checker:
```bash
npm run typecheck
```

## Transcript Viewer

Novi generates beautiful HTML transcripts of support tickets with:
- Responsive design (mobile-friendly)
- Font Awesome icons
- Proper formatting (code blocks, embeds, mentions)
- Server and channel information
- Message metadata and statistics

Access transcripts at: `http://localhost:3000/transcript/:slug`

## Support

For issues, feature requests, or questions about Novi:
- Create a support ticket in your [Discord server](https://discord.gg/wN58bTzzpW)
- Check the knowledge base at https://nodebyte.host/kb
- Visit the status page at https://nodebytestat.us
