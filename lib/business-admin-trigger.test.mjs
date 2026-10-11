import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20261011040000_fix_business_admin_state_trigger_columns.sql", import.meta.url),
  "utf8",
);

test("business moderation trigger resolves only columns on its target table", () => {
  assert.match(migration, /create or replace function public\.protect_admin_moderation_state\(\)/i);
  const insert = migration.split("if tg_op = 'INSERT' then")[1].split("return new;")[0];
  const update = migration.split("if current_user <> (")[1].split("return new;")[0];

  for (const phase of [insert, update]) {
    const business = phase.split("if tg_table_name = 'businesses' then")[1].split("elsif tg_table_name = 'deals' then")[0];
    const deal = phase.split("elsif tg_table_name = 'deals' then")[1].split("elsif tg_table_name = 'reviews' then")[0];
    const review = phase.split("elsif tg_table_name = 'reviews' then")[1];

    assert.match(business, /new\.verified_at/);
    assert.match(business, /new\.suspended_at/);
    assert.doesNotMatch(business, /new\.(admin_disabled_at|admin_hidden_at)/);
    assert.match(deal, /new\.admin_disabled_at/);
    assert.doesNotMatch(deal, /new\.(verified_at|suspended_at|admin_hidden_at)/);
    assert.match(review, /new\.admin_hidden_at/);
    assert.doesNotMatch(review, /new\.(verified_at|suspended_at|admin_disabled_at)/);
  }
});

test("moderation authorization and trigger bindings remain intact", () => {
  assert.match(migration, /current_user <> \(/);
  assert.match(migration, /public\.perform_admin_action\(text,uuid,text,text\)/);
  assert.match(migration, /raise exception 'Administrative business state is read only' using errcode = '42501'/);
  assert.match(migration, /raise exception 'Administrative deal state is read only' using errcode = '42501'/);
  assert.match(migration, /raise exception 'Administrative review state is read only' using errcode = '42501'/);
  assert.doesNotMatch(migration, /\b(grant|revoke|create policy|drop policy|drop trigger)\b/i);
});
