# WA Bot Studio

WA Bot Studio is a dashboard and WhatsApp bot that lets owners configure an AI assistant, test replies, and monitor conversations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required secret: `OPENAI_API_KEY` — direct OpenAI access for AI replies
- Optional env: `WHATSAPP_BOT_ENABLED=false` disables the Baileys worker

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/wa-bot-studio/src/` — dashboard routes, shell, and UI
- `artifacts/api-server/src/routes/bot.ts` — bot configuration, dashboard data, test chat
- `artifacts/api-server/src/routes/whatsapp.ts` — TwiML-compatible webhook
- `artifacts/api-server/src/whatsapp-bot.ts` — Baileys QR session and WhatsApp commands
- `lib/db/src/schema/bot.ts` — config, conversations, messages, and activity tables
- `lib/api-spec/openapi.yaml` — source of truth for API contracts

## Architecture decisions

- The dashboard and WhatsApp worker share the same PostgreSQL conversation history.
- The user-provided Baileys bot is used for QR-based personal WhatsApp login; the Twilio webhook remains available for an official provider path.
- Direct OpenAI access uses the project secret rather than exposing a key in the browser.
- The bot only processes dot-prefixed commands in WhatsApp to avoid replying to unrelated personal messages.

## Product

- Overview of bot health, activity, message volume, and response rate.
- Conversation inbox with searchable threads and message details.
- Bot settings for identity, behavior, greetings, fallback, model, and active state.
- Private test chat backed by the same AI configuration.
- WhatsApp commands from the provided package: `.ai`, `.resetai`, `.menu`, `.ping`, `.calc`, `.quote`, `.tr`, `.sticker`, `.toimg`, and `.owner`.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
