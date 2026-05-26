# QR Codes On Labels

A Nuxt 4 project for creating QR codes and printing them on labels.

## Environment

Local secrets live in `.env`. Cloudflare Pages local preview uses `.dev.vars`.
Both files are ignored by Git; tracked examples are available in `.env.example` and `.dev.vars.example`.

Required auth/database values:

- `DATABASE_URL`: Neon Postgres connection string.
- `BETTER_AUTH_SECRET`: at least 32 characters, generated with high entropy.
- `BETTER_AUTH_URL`: app origin, such as `http://localhost:3000` locally or your Cloudflare Pages URL in production.
- `BETTER_AUTH_TRUSTED_ORIGINS`: optional comma-separated additional origins for previews or custom domains.

## Setup

Make sure to install the dependencies:

```bash
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
bun run dev
```

## Auth And Database

Better Auth is mounted at `/api/auth/*` and configured for Neon Postgres.

Useful commands:

```bash
bun run auth:generate
bun run auth:migrate
bun run neon:login
```

Run the Better Auth schema commands after filling in `DATABASE_URL`.

## Cloudflare Pages

Cloudflare Pages support is configured through `wrangler.toml` and the Cloudflare build preset.

```bash
bun run cloudflare:login
bun run cloudflare:build
bun run cloudflare:preview
bun run cloudflare:deploy
```

For Cloudflare Pages Git integration, use `bun run cloudflare:build` as the build command and `dist` as the output directory.

## Production

Build the application for production:

```bash
bun run build
```

Locally preview production build:

```bash
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
