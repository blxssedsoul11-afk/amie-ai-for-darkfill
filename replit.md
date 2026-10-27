# Amie Discord Bot

Amie is a witty catgirl maid AI companion with text and voice replies for two allowlisted Discord users.

## Run & Operate

- `pnpm --filter @workspace/amie-bot run dev` — run Amie
- `pnpm --filter @workspace/amie-bot run typecheck` — typecheck Amie
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required secrets: `DISCORD_TOKEN`, `MISTRAL_API_KEY`, `FISH_AUDIO_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Discord bot: discord.js 14
- AI replies: Mistral API
- Voice replies: Fish Audio API

## Where things live

- Bot source: `artifacts/amie-bot/src`
- Amie's shared memory is one file for both authorized users; start it empty and do not create per-user memory files.
- The message handler must reject every Discord user except Chakala and Darkfill before reading message content.
- Remove all legacy slash and prefix commands; the bot's ready event clears registered Discord commands.

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
