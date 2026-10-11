import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getAdminReviewAuthors } from "./admin-directory.mjs";
import { checkPlatformAdminAccess } from "./platform-admin-access.mjs";

const page = readFileSync(new URL("../../app/admin/page.js", import.meta.url), "utf8");
const publicPage = readFileSync(new URL("../../app/business/[id]/page.js", import.meta.url), "utf8");
const adminClient = readFileSync(new URL("../../utils/supabase/admin.js", import.meta.url), "utf8");
const actions = readFileSync(new URL("../../app/api/admin/action/route.js", import.meta.url), "utf8");
const foundation = readFileSync(new URL("../../supabase/migrations/20260929010000_admin_foundation.sql", import.meta.url), "utf8");

function fixture(users, profiles, calls = []) {
  return {
    auth: { admin: { async getUserById(id) {
      calls.push(["auth", id]);
      return { data: { user: users.find((user) => user.id === id) ?? null }, error: null };
    } } },
    from(table) {
      assert.equal(table, "profiles");
      return {
        select(columns) { assert.equal(columns, "id, first_name, last_name, full_name, phone"); return this; },
        in(column, ids) {
          assert.equal(column, "id");
          calls.push(["profiles", ids]);
          return Promise.resolve({ data: profiles.filter((profile) => ids.includes(profile.id)), error: null });
        },
      };
    },
  };
}

test("review authors map by user ID with profile names and phones and Auth emails", async () => {
  const calls = [];
  const admin = fixture([
    { id: "author-a", email: "ada@example.com" },
    { id: "author-b", email: "grace@example.com" },
  ], [
    { id: "author-a", first_name: "Ada", last_name: "Lovelace", phone: "+47 111", email: "stale@example.com" },
    { id: "author-b", full_name: "Grace Hopper", phone: "+47 222" },
  ], calls);
  const authors = await getAdminReviewAuthors(admin, ["author-b", "author-a", "author-b"]);
  assert.deepEqual([...authors.keys()], ["author-b", "author-a"]);
  assert.deepEqual(authors.get("author-a"), {
    name: "Ada Lovelace", email: "ada@example.com", phone: "+47 111", lookupFailed: false,
  });
  assert.deepEqual(authors.get("author-b"), {
    name: "Grace Hopper", email: "grace@example.com", phone: "+47 222", lookupFailed: false,
  });
  assert.deepEqual(calls.filter(([kind]) => kind === "auth").map(([, id]) => id), ["author-b", "author-a"]);
  assert.match(page, /authors\.get\(review\.user_id\)\?\.name/);
  assert.match(page, /authors\.get\(review\.user_id\)\?\.email/);
  assert.match(page, /authors\.get\(review\.user_id\)\?\.phone/);
});

test("missing profile fields and deleted accounts have honest fallbacks", async () => {
  const authors = await getAdminReviewAuthors(fixture([
    { id: "no-profile", email: "real@example.com" },
    { id: "no-contact" },
  ], []), ["no-profile", "no-contact", "deleted"]);
  assert.deepEqual(authors.get("no-profile"), {
    name: "Name not provided", email: "real@example.com", phone: "Phone not provided", lookupFailed: false,
  });
  assert.deepEqual(authors.get("no-contact"), {
    name: "Name not provided", email: "Email unavailable", phone: "Phone not provided", lookupFailed: false,
  });
  assert.deepEqual(authors.get("deleted"), {
    name: "Name not provided", email: "Email unavailable", phone: "Phone not provided", lookupFailed: false,
  });
  assert.equal((await getAdminReviewAuthors(fixture([], []), [])).size, 0);
  assert.match(page, /Review date: \{adminDate\(review\.created_at\)\}/);
  assert.match(page, /Technical IDs/);
});

test("a deleted Auth account returns fallbacks without marking the Reviews lookup as failed", async () => {
  const admin = fixture([], []);
  admin.auth.admin.getUserById = async () => ({
    data: null, error: { code: "user_not_found", status: 404, message: "missing account" },
  });
  const original = console.error;
  console.error = () => {};
  let authors;
  try { authors = await getAdminReviewAuthors(admin, ["deleted"]); }
  finally { console.error = original; }
  assert.deepEqual(authors.get("deleted"), {
    name: "Name not provided", email: "Email unavailable", phone: "Phone not provided", lookupFailed: false,
  });
});

test("author lookup errors stay logged safely and do not hide review content", async () => {
  const admin = fixture([], [{ id: "author", first_name: "Ada", phone: null }]);
  admin.auth.admin.getUserById = async () => ({
    data: null, error: { code: "not_admin", status: 403, message: "token and private email" },
  });
  const logs = [];
  const original = console.error;
  console.error = (...entry) => logs.push(entry);
  let authors;
  try { authors = await getAdminReviewAuthors(admin, ["author"]); }
  finally { console.error = original; }
  assert.deepEqual(authors.get("author"), {
    name: "Ada", email: "Email unavailable", phone: "Phone not provided", lookupFailed: true,
  });
  assert.deepEqual(logs, [["Admin directory request failed", {
    operation: "Auth Admin getUserById", code: "not_admin", status: 403, message: "Upstream authorization denied",
  }]]);
  assert.doesNotMatch(JSON.stringify(logs), /private email|token/);
  assert.match(page, /Some author details could not be loaded\. Check server logs\./);
  assert.match(page, /review\.comment \|\| "No comment"/);
  assert.match(page, /review\.admin_hidden_at \? "Hidden by admin" : "Visible"/);
});

test("profile query failures are logged safely while the Reviews panel retains its fallback", async () => {
  const admin = fixture([], []);
  admin.from = () => ({
    select() { return this; },
    in: async () => ({ data: null, error: { code: "42501", status: 403, message: "private profile data" } }),
  });
  const logs = [];
  const original = console.error;
  console.error = (...entry) => logs.push(entry);
  try { await assert.rejects(getAdminReviewAuthors(admin, ["author"])); }
  finally { console.error = original; }
  assert.deepEqual(logs, [["Admin directory request failed", {
    operation: "Review author profiles query", code: "42501", status: 403, message: "Upstream authorization denied",
  }]]);
  assert.match(page, /catch \{ authorLookupFailed = true; \}/);
  assert.match(page, /Name not provided/);
  assert.match(page, /Email unavailable/);
  assert.match(page, /Phone not provided/);
});

test("author details stay behind admin guard and public reviews remain anonymous", async () => {
  assert.equal(await checkPlatformAdminAccess({ id: "ordinary" }, async () => ({ data: null, error: null })), 403);
  assert.ok(page.indexOf("getPlatformAdmin()") < page.indexOf("<Reviews admin={access.admin}"));
  assert.match(page, /if \(access\.status !== 200\) notFound\(\)/);
  assert.match(adminClient, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(publicPage, /publicReviews = reviews\.map\(\(\{ id, rating, comment, created_at \}\) =>/);
  assert.doesNotMatch(publicPage, /getAdminReviewAuthors|auth\.admin\.getUserById/);
  assert.match(page, /REVIEW_RESTORED/);
  assert.match(page, /REVIEW_HIDDEN/);
  assert.match(actions, /access\.supabase\.rpc\("perform_admin_action"/);
  assert.match(foundation, /insert into public\.admin_audit_log/);
});
