# Database

Better Auth schema files can be generated here with:

```bash
bun run auth:generate
```

Fill in `DATABASE_URL` before running Better Auth schema commands.
The Better Auth schema includes the `rateLimit` table used by database-backed
auth rate limiting.

Apply app-owned table migrations before deploying server APIs. Runtime request
handlers verify table readiness but do not create or alter schema.

Run the current app-owned migration with your production or branch database URL:

```bash
psql "$DATABASE_URL" -f database/migrations/2026-05-30-app-owned-tables.sql
```

The SQL snapshots are:

- `saved-qr-schema.sql`
- `credits-schema.sql`
- `dynamic-qr-schema.sql`
