# Database

Better Auth schema files can be generated here with:

```bash
bun run auth:generate
```

Fill in `DATABASE_URL` before running Better Auth schema commands.
The Better Auth schema includes the `rateLimit` table used by database-backed
auth rate limiting.

App-owned tables are also created lazily by the server API. The SQL snapshots are:

- `saved-qr-schema.sql`
- `credits-schema.sql`
- `dynamic-qr-schema.sql`
