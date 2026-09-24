import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { saveBusinessDealNotificationPreference } from "./saved-business-notifications.mjs";

const migration = readFileSync(new URL("../supabase/migrations/20260924030000_add_saved_business_deal_notification_control.sql", import.meta.url), "utf8");
const previous = readFileSync(new URL("../supabase/migrations/20260922000000_phase4_timed_deal_push.sql", import.meta.url), "utf8");
const olderFavoritePolicy = readFileSync(new URL("../supabase/migrations/20260616013000_allow_owner_review_favorite_analytics.sql", import.meta.url), "utf8");
const aggregateMigration = readFileSync(new URL("../supabase/migrations/20260923000000_reconcile_current_architecture.sql", import.meta.url), "utf8");
const worker = readFileSync(new URL("../app/api/internal/notifications/process/route.js", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../components/spotnera-dashboard.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/page.js", import.meta.url), "utf8");

function scanner(source, name) {
  const match = source.match(new RegExp(`create(?: or replace)? function public\\.${name}\\([\\s\\S]*?\\$\\$;`, "i"));
  assert.ok(match, `${name} exists`);
  return match[0];
}

function mockClient(result) {
  const calls = [];
  const chain = {
    update(value) { calls.push(["update", value]); return this; },
    eq(key, value) { calls.push(["eq", key, value]); return this; },
    select(value) { calls.push(["select", value]); return Promise.resolve(result); },
  };
  return { calls, client: { from(table) { calls.push(["from", table]); return chain; } } };
}

test("Saved notification writes only target the current user's business relationship", async () => {
  for (const enabled of [false, true]) {
    const { calls, client } = mockClient({ data: [{ business_id: "business-a", deal_notifications_enabled: enabled }], error: null });
    assert.equal(await saveBusinessDealNotificationPreference(client, {
      businessId: "business-a", userId: "user-a", enabled,
    }), enabled);
    assert.deepEqual(calls, [
      ["from", "favorites"],
      ["update", { deal_notifications_enabled: enabled }],
      ["eq", "business_id", "business-a"],
      ["eq", "user_id", "user-a"],
      ["select", "business_id, deal_notifications_enabled"],
    ]);
  }
});

test("failed, missing, mismatched, and ambiguous writes never confirm a preference", async () => {
  for (const result of [
    { data: null, error: new Error("network") },
    { data: [], error: null },
    { data: [{ business_id: "business-b", deal_notifications_enabled: false }], error: null },
    { data: [{ business_id: "business-a", deal_notifications_enabled: true }], error: null },
    { data: [{ business_id: "business-a", deal_notifications_enabled: false }, { business_id: "business-a", deal_notifications_enabled: false }], error: null },
  ]) {
    const { client } = mockClient(result);
    await assert.rejects(saveBusinessDealNotificationPreference(client, {
      businessId: "business-a", userId: "user-a", enabled: false,
    }));
  }
});

test("existing and new favorites default on, while only each customer can read and update the setting", () => {
  assert.match(olderFavoritePolicy, /businesses\.owner_id = auth\.uid\(\)/);
  assert.match(migration, /add column deal_notifications_enabled boolean not null default true/);
  assert.doesNotMatch(migration, /update public\.favorites/i);
  assert.match(migration, /create policy "Users can read their own favorites"[\s\S]*?for select to authenticated\s+using \(user_id = auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /businesses\.owner_id\s*=\s*auth\.uid\(\)/);
  assert.match(migration, /grant update \(deal_notifications_enabled\) on public\.favorites to authenticated/);
  assert.match(migration, /revoke update on public\.favorites from public, anon, authenticated/);
  assert.match(migration, /for update to authenticated\s+using \(user_id = auth\.uid\(\)\)\s+with check \(user_id = auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /grant (?:select|update).*to anon/i);
  assert.match(aggregateMigration, /get_owner_business_favorite_counts\(\)[\s\S]*?count\(f\.id\)::bigint/);
  assert.match(page, /select\("business_id, deal_notifications_enabled"\)/);
  assert.match(dashboard, /\.from\("favorites"\)\.insert\(\{\s*business_id: business\.id,\s*user_id: userId/);
});

test("New Deal and both timed events retain every prior scanner rule plus the Saved gate", () => {
  for (const [name, business] of [
    ["scan_new_deal_push_audience", "event_row"],
    ["scan_timed_push_audience", "e"],
  ]) {
    const before = scanner(previous, name);
    const after = scanner(migration, name);
    const normalized = after
      .replace(/create or replace function public\.scan_timed_push_audience/, "create function public.scan_timed_push_audience")
      .replace(new RegExp(`where f\\.deal_notifications_enabled = true\\s+and f\\.business_id = ${business}\\.business_id`), `where f.business_id = ${business}.business_id`);
    assert.equal(normalized, before);
    assert.match(after, /f\.deal_notifications_enabled = true/);
  }
  assert.match(migration, /p\.saved_business_new_deals = true/);
  assert.match(migration, /p\.saved_business_deal_starting_soon = true/);
  assert.match(migration, /p\.saved_business_deal_ending_soon = true/);
  assert.equal((worker.match(/deal_notifications_enabled !== true/g) ?? []).length, 2);
  assert.equal((worker.match(/select\("id, deal_notifications_enabled"\)/g) ?? []).length, 2);
});

test("Saved control retains business actions and confirms state after persistence", () => {
  assert.match(dashboard, /role="switch"[\s\S]*?aria-checked=\{business\.dealNotificationsEnabled === true\}/);
  assert.match(dashboard, /await saveBusinessDealNotificationPreference\([\s\S]*?updateBusiness\(business\.id/);
  assert.match(dashboard, /notificationWriteRef\.current = business\.id/);
  assert.match(dashboard, /setNotificationToggleError\(business\.id\)/);
  assert.match(dashboard, /View business/);
  assert.match(dashboard, /View deals/);
  assert.match(dashboard, /active \$\{liveDeals\.length === 1/);
});
