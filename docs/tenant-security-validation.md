# Tenant Security Validation

This document describes the live Supabase security validation flow after `0041_stage6_tenant_rls_security.sql`.

## Required environment variables

Do not store secret values in this document.

Needed for validation:

- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

Needed for live Supabase CLI sync:

- `SUPABASE_CLI_PATH` optional, if the CLI is not on `PATH`
- `SUPABASE_DB_URL` optional, if you want to target a direct Postgres URL instead of the linked project
- `DATABASE_URL` optional alias for `SUPABASE_DB_URL`
- `SUPABASE_ACCESS_TOKEN` optional, if the CLI needs a Supabase account token

## Work order

Run the commands in this order:

1. `npm run supabase:status`
2. `npm run supabase:migrate:live -- --confirm-production`
3. `npm run security:validate:live -- --confirm-production`

## Duplicate migration procedure

If `npm run supabase:status` reports a duplicate migration prefix, do not start any live migration action until it is resolved.

### Scenario A - Migration has not been applied to live yet

If you are sure the duplicated migration is not part of the live Supabase history:

- Rename the later migration file to the first available logical number.
- Keep SQL content unchanged unless a dependency forces a tiny reference update.
- Update any tests or docs that reference the old filename.
- Re-run `npm run supabase:status`.
- Only after local integrity is clean, run `npm run supabase:migrate:live -- --confirm-production`.

### Scenario B - Migration may already exist in live history

If you are not sure whether the duplicated migration was already applied remotely:

- Do not rename blindly.
- Compare local and remote migration histories with Supabase CLI.
- Repair remote migration history first, then re-run the migration flow.

Suggested repair commands:

```bash
supabase migration list --linked
supabase migration repair <version> --status reverted --linked
```

Use `applied` instead of `reverted` only if you are marking a migration as already present remotely and the local file set is the source of truth.

Never use:

- `db reset`
- table drops
- data deletion
- silent history rewrites

## Step 1: Migration status

Command:

```bash
npm run supabase:status
```

What it checks:

- Local `supabase/migrations` against the live Supabase migration history
- Local-only migrations
- Remote-only migrations
- Migration order issues
- The status of `0037`, `0038`, `0039`, `0040`, and `0041`

Expected result:

- Local-only migrations are listed when live is behind
- Remote-only migrations are listed when live has unexpected entries
- Duplicate or out-of-order migration prefixes are reported clearly

If it fails:

- Confirm the Supabase CLI is installed
- Confirm the project is linked or `SUPABASE_DB_URL` is set
- Do not run live migration apply until the history mismatch is understood

## Step 2: Live migration apply

Command:

```bash
npm run supabase:migrate:live -- --confirm-production
```

What it does:

- Re-runs migration status first
- Aborts if remote-only migrations exist
- Aborts if local migration order is broken
- Applies missing local migrations in order with Supabase CLI
- Reloads the PostgREST schema cache
- Verifies visibility for:
  - `pricing_rules`
  - `payments`
  - `drivers`
  - `vehicles`
  - `reservation_assignments`

Safety rules:

- No `db reset`
- No table drops
- No data deletion
- No automatic tenant repair

If it fails:

- Fix the migration history mismatch first
- Re-run only after the live project is confirmed safe

## Step 3: Full security validation

Command:

```bash
npm run security:validate:live -- --confirm-production
```

Execution order:

1. Migration status check
2. Tenant table visibility check
3. Preflight SQL
4. RLS status report
5. Tenant RLS test
6. Policy smoke test
7. Constraint validation, only if preflight issue count is `0`
8. Final summary

Expected output:

- `business_id` orphan issues are reported if present
- Tenant mismatch issues are reported if present
- RLS enabled tables and policy coverage are listed
- Tenant policy tests pass for anon, tenant, and super admin roles
- Constraint validation runs only when the database is clean enough

If preflight finds issues:

- Do not validate constraints
- Do not auto-fix rows
- Investigate the orphan or mismatch records manually

## Service role audit

The codebase still contains some server-side service-role usage. The current classification is:

| File | Classification |
|---|---|
| `supabase/seed-super-admin.mjs` | necessary |
| `lib/business-panel.ts` | can move to user-scoped JWT |
| `lib/analytics.ts` | can move to user-scoped JWT |
| `lib/audit.ts` | should move to RPC |
| `lib/deploy.ts` | necessary |
| `lib/content-translations.ts` | should move to RPC |
| `lib/customers.ts` | can move to user-scoped JWT |
| `lib/business.ts` | necessary |
| `lib/media.ts` | can move to user-scoped JWT |
| `lib/export.ts` | necessary |
| `lib/operations.ts` | should move to RPC |
| `lib/notifications.ts` | can move to user-scoped JWT |
| `lib/payments.ts` | should move to RPC |
| `lib/plans.ts` | necessary |
| `lib/pricing-rules.ts` | should move to RPC |
| `lib/requests.ts` | should move to RPC |
| `lib/publishing.ts` | necessary |
| `lib/reservation-service.ts` | should move to RPC |
| `lib/tasks.ts` | can move to user-scoped JWT |
| `lib/voucher-delivery.ts` | should move to RPC |
| `lib/vouchers.ts` | should move to RPC |
| `app/api/super-admin/businesses/[id]/route.ts` | necessary |
| `app/api/super-admin/businesses/[id]/admin/repair/route.ts` | necessary |
| `app/api/business/reservations/[id]/route.ts` | should move to RPC |

Notes:

- `necessary` means the current server-side bootstrap or admin flow still requires it.
- `can move to user-scoped JWT` means the same operation should be possible with the normal session token later.
- `should move to RPC` means the write path is a good candidate for DB-side validation and tenant-safe stored procedures.

## Manual checks before production

- Confirm live migration history matches local migration files
- Confirm the schema cache reload made the new tables visible
- Confirm the smoke test created and cleaned up temporary tenant data
- Confirm no orphan or mismatch rows remain before validating constraints
- Confirm `SUPABASE_SERVICE_ROLE_KEY` is only used server-side
