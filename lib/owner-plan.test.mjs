import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canCreateBusiness, getOwnerPlan, isFreeBusinessLimitError } from "./owner-plan.mjs";

const migration = readFileSync(new URL("../supabase/migrations/20260927030000_phase_g_owner_plans_and_business_limit.sql", import.meta.url), "utf8");
const owner = readFileSync(new URL("../app/owner/page.js", import.meta.url), "utf8");
const premium = readFileSync(new URL("../app/owner/premium/page.js", import.meta.url), "utf8");

test("missing plan defaults to FREE and permits the first through fifth businesses", () => {
  assert.equal(getOwnerPlan(null), "FREE");
  assert.equal(canCreateBusiness(null, 0), true);
  assert.equal(canCreateBusiness("FREE", 4), true);
  assert.equal(canCreateBusiness("FREE", 5), false);
  assert.equal(canCreateBusiness("FREE", 7), false);
});

test("PREMIUM bypasses the Free limit without a customer activation flow", () => {
  assert.equal(canCreateBusiness("PREMIUM", 5), true);
  assert.equal(canCreateBusiness("PREMIUM", 12), true);
  assert.doesNotMatch(owner + premium, /\.from\("owner_account_plans"\)\s*\.upsert|\.from\("owner_account_plans"\)\s*\.update/);
});

test("database trigger protects direct inserts and serializes concurrent creates", () => {
  assert.match(migration, /before insert on public\.businesses\s+for each row execute function public\.enforce_owner_business_limit\(\)/i);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  const lock = migration.indexOf("for update;");
  const count = migration.indexOf("select count(*) into business_count");
  assert.ok(lock > -1 && count > lock);
  assert.match(migration, /business_count >= 5/);
  assert.match(migration, /where owner_id = new\.owner_id/);
  assert.match(migration, /coalesce\(current_plan, 'FREE'\) = 'PREMIUM'/);
  assert.doesNotMatch(migration, /delete from public\.businesses|update public\.businesses/i);
});

test("normal browser permissions cannot self-upgrade", () => {
  assert.match(migration, /revoke all on public\.owner_account_plans from public, anon, authenticated/i);
  assert.match(migration, /grant select on public\.owner_account_plans to authenticated/i);
  assert.match(migration, /for select to authenticated\s+using \(owner_id = \(select auth\.uid\(\)\)\)/i);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete|all) on public\.owner_account_plans to authenticated/i);
});

test("limit error and Premium discovery routes are wired into owner flow", () => {
  assert.equal(isFreeBusinessLimitError({ message: "FREE_BUSINESS_LIMIT_REACHED" }), true);
  assert.equal(isFreeBusinessLimitError({ message: "other" }), false);
  assert.match(owner, /isFreeBusinessLimitError\(error\)/);
  assert.match(owner, /createLimit=1/);
  assert.match(owner, /You&apos;ve reached the limit of \{FREE_BUSINESS_LIMIT\} businesses for your current plan\./);
  assert.match(owner, /showCreateBusiness && canCreateAnotherBusiness/);
  assert.match(owner, /href="\/owner\/premium"/);
  assert.match(premium, /Coming soon/);
  for (const benefit of ["Advanced Analytics", "Customer Segmentation", "Multiple Locations / Branch Management", "Advanced Deal Scheduling & Automation", "Advanced Promotion Tools"]) {
    assert.ok(premium.includes(benefit));
  }
  assert.match(premium, /<PremiumInquiryForm \/>/);
  assert.match(premium, /<PremiumContactActions email=\{SUPPORT_EMAIL\} \/>/);
});
