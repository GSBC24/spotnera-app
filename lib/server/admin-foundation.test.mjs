import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isEmailDiscoverable } from "./customer-email.mjs";
import { resolveTimedOccurrences } from "./timed-notifications.mjs";
import { checkPlatformAdminAccess } from "./platform-admin-access.mjs";
import { validateAdminAction } from "./admin-action-validation.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("../../supabase/migrations/20260929010000_admin_foundation.sql");
const page = read("../../app/admin/page.js");
const api = read("../../app/api/admin/action/route.js");
const guard = read("./platform-admin.js");
const profile = read("../../app/business/[id]/page.js");
const home = read("../../app/page.js");
const owner = read("../../app/owner/page.js");
const push = read("../../app/api/internal/notifications/process/route.js");
const timed = read("./timed-discovery.mjs");
const actionForm = read("../../components/admin-action.js");

test("normal users are denied, members allowed, and lookup failures fail closed", async () => {
  assert.equal(await checkPlatformAdminAccess(null, () => { throw new Error("lookup called"); }), 401);
  assert.equal(await checkPlatformAdminAccess({ id: "ordinary" }, async () => ({ data: null, error: null })), 403);
  assert.equal(await checkPlatformAdminAccess({ id: "administrator" }, async () => ({ data: { user_id: "administrator" }, error: null })), 200);
  await assert.rejects(checkPlatformAdminAccess({ id: "ordinary" }, async () => ({ data: null, error: new Error("offline") })),
    /authorization could not be checked/);
});

test("admin page and API both check server-side membership after authenticated identity", () => {
  assert.match(guard, /supabase\.auth\.getUser\(\)/);
  assert.match(guard, /from\("platform_admins"\)/);
  assert.match(page, /getPlatformAdmin\(\)/);
  assert.match(api, /getPlatformAdmin\(\)/);
  assert.match(api, /access\.status !== 200/);
  assert.match(sql, /revoke all on public\.platform_admins from public, anon, authenticated/);
  assert.match(sql, /auth\.uid\(\) is null or not exists/);
});

test("admin requests reject malformed targets, missing reasons, and excessive notes", () => {
  const targetId = "00000000-0000-4000-8000-000000000001";
  assert.deepEqual(validateAdminAction({ action: "BUSINESS_VERIFIED", targetId }),
    { action: "BUSINESS_VERIFIED", targetId, reason: null, note: null });
  assert.equal(validateAdminAction({ action: "BUSINESS_SUSPENDED", targetId }), null);
  assert.equal(validateAdminAction({ action: "DEAL_DISABLED", targetId, reason: "invented" }), null);
  assert.equal(validateAdminAction({ action: "REVIEW_HIDDEN", targetId: "not-a-uuid", reason: "Spam" }), null);
  assert.equal(validateAdminAction({ action: "REVIEW_HIDDEN", targetId, reason: "Spam", note: "x".repeat(501) }), null);
  assert.equal(validateAdminAction({ action: "DELETE_BUSINESS", targetId }), null);
  assert.equal(validateAdminAction({ action: "REVIEW_HIDDEN", targetId, reason: "Spam" })?.reason, "Spam");
});

test("admin state defaults empty, is protected from owner writes, and changes atomically with audit", () => {
  for (const name of ["verified_at", "suspended_at", "admin_disabled_at", "admin_hidden_at"]) {
    assert.match(sql, new RegExp(`add column ${name} timestamptz`));
  }
  assert.match(sql, /before insert or update on public\.businesses/);
  assert.match(sql, /before insert or update on public\.reviews/);
  assert.match(sql, /create function public\.perform_admin_action/);
  assert.match(sql, /get diagnostics changed_count = row_count;\s*if changed_count = 0 then return false/);
  assert.match(sql, /insert into public\.admin_audit_log/);
  assert.match(sql, /p_reason is null or p_reason not in/);
  assert.match(sql, /revoke all on public\.admin_audit_log from public, anon, authenticated/);
  for (const action of ["BUSINESS_VERIFIED", "BUSINESS_VERIFICATION_REMOVED", "BUSINESS_SUSPENDED",
    "BUSINESS_RESTORED", "DEAL_DISABLED", "DEAL_RESTORED", "REVIEW_HIDDEN", "REVIEW_RESTORED"]) {
    assert.match(sql, new RegExp(action));
  }
  assert.match(api, /validateAdminAction\(/);
  assert.match(actionForm, /submissionLock\.current/);
  assert.match(actionForm, /disabled=\{pending\}/);
});

test("suspension, disabling, and review hiding gate public reads and aggregates", () => {
  assert.match(sql, /is_active and suspended_at is null/);
  assert.match(sql, /deals\.admin_disabled_at is null/);
  assert.match(sql, /reviews\.admin_hidden_at is null/);
  assert.match(home, /\.is\("suspended_at", null\)/);
  assert.match(home, /\.is\("businesses\.suspended_at", null\)/);
  assert.match(home, /\.is\("admin_disabled_at", null\)/);
  assert.match(home, /\.is\("admin_hidden_at", null\)/);
  assert.match(profile, /\.is\("suspended_at", null\)/);
  assert.match(profile, /\.is\("admin_disabled_at", null\)/);
  assert.match(profile, /\.is\("admin_hidden_at", null\)/);
  assert.match(owner, /\.is\("admin_hidden_at", null\)/);
  assert.match(profile, /Verified business/);
  assert.match(profile, /Business information not yet verified/);
  assert.match(profile, /does not guarantee quality, prices, safety, reliability/);
});

test("service-role notification paths recheck administrative state before sending", () => {
  assert.match(push, /deal\.admin_disabled_at/);
  assert.match(push, /business\.suspended_at/);
  assert.match(timed, /deal\.admin_disabled_at/);
  assert.match(timed, /business\.suspended_at/);
  const deal = { id: "d", business_id: "b", title: "Test", is_active: true,
    status: "active", availability_mode: "continuous", starts_at: null, ends_at: null };
  const business = { id: "b", name: "Test", is_active: true };
  assert.equal(isEmailDiscoverable(deal, business), true);
  assert.equal(isEmailDiscoverable({ ...deal, admin_disabled_at: "2026-09-29" }, business), false);
  assert.equal(isEmailDiscoverable(deal, { ...business, suspended_at: "2026-09-29" }), false);
  assert.deepEqual(resolveTimedOccurrences({ ...deal, admin_disabled_at: "2026-09-29" }), []);
});
