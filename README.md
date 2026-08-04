# BuildOrders

AoE4 build order analyzer — ingest a build order URL, normalize it into a
structured model, and browse it as a timeline, cheatsheet, or branching
scenarios. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design.

## Stack

- **Front**: Astro (static output) + React islands + shadcn/ui (stock CLI components, Tailwind v4).
- **Backend parsing**: Supabase Edge Function (Deno), stubbed for now.
- **DB/Auth/Storage**: Supabase (not yet wired — the app currently runs on mock data).

## Local development

```sh
pnpm install
pnpm dev       # http://localhost:4321
```

## Build

```sh
pnpm build     # outputs static site to ./dist
pnpm preview   # preview the production build locally
```

Type-check Astro/TSX files:

```sh
pnpm astro check
```

## Environment variables

Copy `.env.example` to `.env` and fill in your Supabase project credentials:

| Variable                    | Description                        |
| ---------------------------- | ----------------------------------- |
| `PUBLIC_SUPABASE_URL`        | Supabase project URL                |
| `PUBLIC_SUPABASE_ANON_KEY`   | Supabase anonymous/public API key   |

Both are optional in stub mode — the app runs on mock data (see
`src/lib/mock-data.ts`) when they're unset.

## Deploy

The site builds to a static `dist/` folder served by nginx in a multi-stage
`Dockerfile`. `deploy/docker-compose.yml` runs it behind Traefik with TLS via
Let's Encrypt, routed to `buildorders.aperture-agency.org` on the external
`web` network:

```sh
docker compose -f deploy/docker-compose.yml up -d --build
```
