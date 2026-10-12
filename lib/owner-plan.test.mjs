import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BUSINESS_LIMIT_MESSAGE, canCreateBusiness, getOwnerPlan, isFreeBusinessLimitError } from "./owner-plan.mjs";

const migration = readFileSync(new URL("../supabase/migrations/20260927030000_phase_g_owner_plans_and_business_limit.sql", import.meta.url), "utf8");
const capMigration = readFileSync(new URL("../supabase/migrations/20261012000000_enforce_five_businesses_for_all_accounts.sql", import.meta.url), "utf8");
const owner = readFileSync(new URL("../app/owner/page.js", import.meta.url), "utf8");
const premium = readFileSync(new URL("../app/owner/premium/page.js", import.meta.url), "utf8");

test("the first through fifth businesses are allowed and a sixth is denied", () => {
  assert.equal(getOwnerPlan(null), "FREE");
  assert.equal(canCreateBusiness(0), true);
  assert.equal(canCreateBusiness(4), true);
  assert.equal(canCreateBusiness(5), false);
  assert.equal(canCreateBusiness(7), false);
});

test("business limit does not depend on plan and plan data remains protected", () => {
  assert.doesNotMatch(owner + premium, /\.from\("owner_account_plans"\)\s*\.upsert|\.from\("owner_account_plans"\)\s*\.update/);
  assert.match(capMigration, /create or replace function public\.enforce_owner_business_limit\(\)/i);
  assert.match(capMigration, /auth\.users where id = new\.owner_id for update/i);
  assert.match(capMigration, /business_count >= 5/i);
  assert.doesNotMatch(capMigration, /owner_account_plans|current_plan|PREMIUM/i);
  assert.doesNotMatch(capMigration, /grant |revoke |alter policy|delete from public\.businesses/i);
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

test("limit error uses the account cap and retains owner dashboard access", () => {
  assert.equal(isFreeBusinessLimitError({ message: "FREE_BUSINESS_LIMIT_REACHED" }), true);
  assert.equal(isFreeBusinessLimitError({ message: "other" }), false);
  assert.match(owner, /isFreeBusinessLimitError\(error\)/);
  assert.equal(BUSINESS_LIMIT_MESSAGE, "You've reached the maximum of 5 businesses allowed per account. To add a new business, you'll need to remove an existing one.");
  assert.match(owner, /Business limit reached/);
  assert.match(owner, /\{BUSINESS_LIMIT_MESSAGE\}/);
  assert.doesNotMatch(owner, /View my businesses/);
  assert.match(owner, /ownerSection === "businesses" && !businessesError && !canCreateAnotherBusiness[\s\S]*?Business limit reached[\s\S]*?\{BUSINESS_LIMIT_MESSAGE\}/);
  assert.match(owner, /showCreateBusiness && canCreateAnotherBusiness/);
  assert.match(owner, /\.select\("id", \{ count: "exact", head: true \}\)[\s\S]*?\.eq\("owner_id", user\.id\)/);
  assert.match(owner, /if \(!canCreateBusiness\(businessCount\)\)/);
  assert.match(owner, /if \(isFreeBusinessLimitError\(error\)\)/);
  const businessSection = owner.slice(owner.indexOf('{ownerSection === "businesses" && canCreateAnotherBusiness'), owner.indexOf('{ownerSection === "deals" ? ('));
  assert.doesNotMatch(businessSection, /Premium|upgrade|subscription|current plan/i);
  assert.match(owner, /ownerSection !== "businesses"/);
  assert.match(owner, /href="\/owner\/premium"/);
  assert.match(premium, /Coming soon/);
  for (const benefit of ["Advanced Analytics", "Customer Segmentation", "Multiple Locations / Branch Management", "Advanced Deal Scheduling & Automation", "Advanced Promotion Tools"]) {
    assert.ok(premium.includes(benefit));
  }
  assert.match(premium, /<PremiumInquiryForm \/>/);
  assert.match(premium, /<PremiumContactActions email=\{SUPPORT_EMAIL\} \/>/);
});
