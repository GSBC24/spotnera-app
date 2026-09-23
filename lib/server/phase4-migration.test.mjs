import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../supabase/migrations/20260922000000_phase4_timed_deal_push.sql",
  import.meta.url), "utf8");
const owner = readFileSync(new URL("../../app/owner/page.js", import.meta.url), "utf8");

function functionBody(name) {
  const match = migration.match(new RegExp(
    `create(?: or replace)? function public\\.${name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`,
    "i",
  ));
  assert.ok(match, `${name} exists in forward migration`);
  return match[1];
}

test("New Deal audience and claim paths explicitly isolate their event type", () => {
  assert.match(functionBody("scan_new_deal_push_audience"),
    /e\.event_type\s*=\s*'saved_business_new_deal'/);
  assert.match(functionBody("claim_new_deal_push_deliveries"),
    /e\.event_type\s*=\s*'saved_business_new_deal'/);
  assert.match(functionBody("scan_new_deal_push_audience"),
    /p\.saved_business_new_deals\s*=\s*true/);
  assert.match(functionBody("claim_new_deal_push_deliveries"),
    /d\.attempts\s*<\s*4/);
});

test("timed audience is gated by toggle and allowed lead, with terminal rows protected", () => {
  const body = functionBody("scan_timed_push_audience");
  assert.match(body, /p\.saved_business_deal_starting_soon\s*=\s*true/);
  assert.match(body, /p\.starting_soon_minutes\s+in\s*\(30, 60, 120\)/);
  assert.match(body, /p\.saved_business_deal_ending_soon\s*=\s*true/);
  assert.match(body, /d\.status\s*=\s*'pending'/);
  assert.match(body, /d\.attempts\s*<\s*4/);
  assert.match(body, /greatest\(d\.next_attempt_at,/);
  assert.match(migration, /unique index notification_deliveries_logical_alert_idx/);
  assert.match(functionBody("claim_timed_push_deliveries"),
    /d\.deadline_at\s*>\s*now\(\)/);
});

test("owner saves use a leased atomic RPC; overlap, failure, and recovery fail safe", () => {
  const begin = functionBody("begin_owner_deal_edit");
  const save = functionBody("save_owner_deal");
  assert.match(begin, /pg_try_advisory_xact_lock/);
  assert.match(begin, /d\.timed_edit_expires_at\s+is\s+null\s+or\s+d\.timed_edit_expires_at\s*<=/);
  assert.match(begin, /owner_id\s*=\s*auth\.uid\(\)/);
  assert.match(save, /pg_try_advisory_xact_lock/);
  assert.match(save, /for update of d nowait/);
  assert.match(save, /old_deal\.timed_edit_token_hash\s+is distinct from md5\(p_edit_token::text\)/);
  assert.match(save, /timed_edit_token_hash\s*=\s*null,\s*timed_edit_expires_at\s*=\s*null/);
  assert.match(save, /delete from public\.deal_schedules/);
  assert.match(save, /insert into public\.deal_schedules/);
  assert.match(migration, /revoke insert, update, delete on public\.deal_schedules from authenticated/);
  assert.match(migration, /revoke insert, update on public\.deals from authenticated/);
  assert.equal((owner.match(/rpc\("save_owner_deal"/g) ?? []).length, 2);
  assert.equal((owner.match(/"begin_owner_deal_edit"/g) ?? []).length, 1);
  assert.doesNotMatch(migration, /timed_edit_pending/);
});

test("edit lease checks current business and save checks current plus destination ownership", () => {
  const begin = functionBody("begin_owner_deal_edit");
  const save = functionBody("save_owner_deal");
  assert.match(begin, /join public\.businesses current_business on current_business\.id = d\.business_id\s+where d\.id = p_deal_id and d\.owner_id = auth\.uid\(\)\s+and current_business\.owner_id = auth\.uid\(\)/);
  assert.match(begin, /update public\.deals d[\s\S]*?where d\.id = p_deal_id and d\.owner_id = auth\.uid\(\)[\s\S]*?current_business\.id = d\.business_id\s+and current_business\.owner_id = auth\.uid\(\)/);
  assert.match(save, /destination_business := \(p_payload->>'business_id'\)::uuid;[\s\S]*?from public\.businesses\s+where id = destination_business and owner_id = owner_uuid/);
  assert.match(save, /select d\.\* into old_deal from public\.deals d\s+join public\.businesses current_business on current_business\.id = d\.business_id\s+where d\.id = p_deal_id and d\.owner_id = owner_uuid\s+and current_business\.owner_id = owner_uuid\s+for update of d nowait/);
});

test("edit-generation suppression protects terminal alerts across identity shifts", () => {
  const scan = functionBody("scan_timed_push_audience");
  const claim = functionBody("claim_timed_push_deliveries");
  assert.match(migration, /primary key \(deal_id, event_type, device_id, timed_edit_generation\)/);
  assert.match(scan, /old_delivery\.status in \('sent', 'uncertain'\)/);
  assert.match(scan, /old_delivery\.timed_edit_generation\s*<\s*e\.timed_edit_generation/);
  assert.match(scan, /suppression\.occurrence_key\s*=\s*e\.occurrence_key/);
  assert.match(scan, /d\.status\s*=\s*'pending'/);
  assert.match(claim, /deal\.timed_edit_token_hash is null/);
  assert.match(claim, /d\.timed_edit_generation = e\.timed_edit_generation/);
  assert.match(migration, /unique index notification_deliveries_logical_alert_idx/);
});

test("discovery cursor comes from the exact bounded returned batch", () => {
  const body = functionBody("next_timed_discovery_deals");
  assert.match(body, /array_agg\(batch\.id order by batch\.id\) into batch_ids/);
  assert.match(body, /cursor_deal_id\s*=\s*batch_ids\[array_length\(batch_ids, 1\)\]/);
  assert.match(body, /return query select unnest\(batch_ids\)/);
  assert.equal((body.match(/from public\.deals d/g) ?? []).length, 1);
});
