import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL(
  "../../supabase/migrations/20260923000000_reconcile_current_architecture.sql",
  import.meta.url,
), "utf8");
const owner = readFileSync(new URL("../../app/owner/page.js", import.meta.url), "utf8");

test("reconciliation leaves existing ownership, deal, and favorites rules intact", () => {
  assert.match(migration, /Ownership schema.*NOT NULL with ON DELETE CASCADE/);
  assert.match(migration, /drop policy if exists "Users can create their own businesses"/);
  assert.doesNotMatch(migration, /drop policy if exists "Users can insert owned businesses"/);
  assert.doesNotMatch(migration, /(?:create|drop|alter) policy [^;]* on public\.(?:deals|favorites)/i);
  assert.doesNotMatch(migration, /alter table public\.(?:businesses|deals)/i);
});

test("storage writes stay in the authenticated user's first folder", () => {
  assert.match(migration, /'business-assets'[\s\S]*?5242880[\s\S]*?image\/jpeg[\s\S]*?image\/png[\s\S]*?image\/webp[\s\S]*?image\/gif/);
  assert.equal((migration.match(/create policy "/g) ?? []).length, 4);
  assert.doesNotMatch(migration, /drop policy[^;]*on storage\.objects/i);
  assert.equal((migration.match(/storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/g) ?? []).length, 4);
  assert.match(migration, /for update[\s\S]*?using \([\s\S]*?\)[\s\S]*?with check \(/);
});

test("favorite-count RPC emits only owned aggregates and has restricted execution", () => {
  assert.match(migration, /returns table \(business_id uuid, favorite_count bigint\)/);
  assert.match(migration, /security definer\s+set search_path = pg_catalog, pg_temp\s+set row_security = off/);
  assert.match(migration, /where auth\.uid\(\) is not null\s+and b\.owner_id = auth\.uid\(\)/);
  assert.match(migration, /left join public\.favorites f on f\.business_id = b\.id/);
  assert.match(migration, /revoke all on function public\.get_owner_business_favorite_counts\(\)\s+from public, anon/);
  assert.match(migration, /grant execute on function public\.get_owner_business_favorite_counts\(\)\s+to authenticated/);
  assert.doesNotMatch(migration, /f\.user_id|ENABLE_TIMED_DEAL_PUSH/);
});

test("owner dashboard uses aggregate RPC and surfaces errors", () => {
  assert.match(owner, /supabase\.rpc\("get_owner_business_favorite_counts"\)/);
  assert.doesNotMatch(owner, /\.from\("favorites"\)/);
  assert.match(owner, /Number\(favorite\.favorite_count\)/);
  assert.match(owner, /favoriteCountsError\s*\?\s*"—"/);
  assert.match(owner, /Favorite counts are unavailable/);
  assert.match(owner, /supabase\.rpc\("get_owner_business_event_counts"/);
});
