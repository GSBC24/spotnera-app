import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL(
  "../../supabase/migrations/20260923010000_cleanup_duplicate_business_policies.sql",
  import.meta.url,
), "utf8");

test("business policy cleanup fails closed around only three duplicate drops", () => {
  assert.match(migration, /^begin;[\s\S]*commit;\s*$/i);
  assert.match(migration, /to_regclass\('public\.businesses'\)/);
  assert.match(migration, /c\.relrowsecurity/);
  assert.equal((migration.match(/\bdo \$\$/g) ?? []).length, 2);

  const drops = [...migration.matchAll(/^drop policy "([^"]+)" on public\.businesses;$/gm)]
    .map((match) => match[1]);
  assert.deepEqual(drops, [
    "Users can read their own businesses",
    "Users can update their own businesses",
    "Users can delete their own businesses",
  ]);
  assert.equal((migration.match(/^drop policy /gm) ?? []).length, 3);
  assert.doesNotMatch(migration, /\b(?:create|alter)\s+policy\b/i);
  assert.doesNotMatch(migration, /\b(?:deals|favorites|reviews|storage|notification|timed_deal)\b/i);
});

test("cleanup checks every policy definition and exact command counts before and after", () => {
  for (const name of [
    "Public users can read active businesses",
    "Users can insert owned businesses",
    "Business owners can update businesses",
    "Business owners can delete businesses",
  ]) {
    assert.equal(migration.split(`'${name}'`).length - 1, 2);
  }

  for (const name of [
    "Users can read their own businesses",
    "Users can update their own businesses",
    "Users can delete their own businesses",
  ]) {
    assert.equal(migration.split(`'${name}'`).length - 1, 1);
  }

  assert.match(migration, /policy_counts\.select_count <> 2[\s\S]*policy_counts\.insert_count <> 1[\s\S]*policy_counts\.update_count <> 2[\s\S]*policy_counts\.delete_count <> 2[\s\S]*policy_counts\.all_count <> 0/);
  assert.match(migration, /policy_counts\.select_count <> 1[\s\S]*policy_counts\.insert_count <> 1[\s\S]*policy_counts\.update_count <> 1[\s\S]*policy_counts\.delete_count <> 1[\s\S]*policy_counts\.all_count <> 0/);
  assert.equal((migration.match(/p\.permissive <> 'PERMISSIVE'/g) ?? []).length, 2);
  assert.equal((migration.match(/p\.roles @> e\.roles and p\.roles <@ e\.roles/g) ?? []).length, 2);
  assert.equal((migration.match(/p\.qual/g) ?? []).length, 2);
  assert.equal((migration.match(/p\.with_check/g) ?? []).length, 2);
  assert.match(migration, /'is_activeorowner_id=auth\.uid'/);
  assert.match(migration, /'owner_id=auth\.uid'/);
});
