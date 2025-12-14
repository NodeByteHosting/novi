# NodeBot-v2 (TypeScript Discord Bot)

Quick start:

1. Copy `.env.example` to `.env` and fill values.
2. Run `npm install`.
3. For development: `npm run dev` (requires `ts-node`).
4. To build: `npm run build` then `npm start`.

This scaffold includes:
- Slash commands (info, moderation sample)
- PostgreSQL helper (`src/lib/db.ts`) and schema example
- Event handlers for ready, interactions, member joins
- Reaction role select menu example
- Logging to a configured `LOGS_CHANNEL_ID`

See `src/` for implementation details.

Ask Connor for the `.env` stuff.