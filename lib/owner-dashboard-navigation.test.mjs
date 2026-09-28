import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OWNER_SECTIONS, ownerSectionHref } from "./owner-navigation.mjs";

const page = readFileSync(new URL("../app/owner/page.js", import.meta.url), "utf8");
const deleteButton = readFileSync(new URL("../components/delete-business-button.js", import.meta.url), "utf8");

function actionBody(name, nextName) {
  return page.slice(page.indexOf(`async function ${name}(`),
    page.indexOf(`async function ${nextName}(`));
}

test("business edit is directly after its own card and only the selected business opens", () => {
  const portfolio = page.slice(page.indexOf("businesses\n                .filter("),
    page.indexOf('{ownerSection === "deals" ? ('));
  assert.match(portfolio, /<Fragment key=\{business\.id\}>[\s\S]*?<article[\s\S]*?<\/article>\s*\{ownerSection === "businesses" && editingBusinessId === business\.id \? \(/);
  assert.match(portfolio, /<BusinessForm action=\{updateBusiness\} business=\{business\}/);
  assert.equal((portfolio.match(/<BusinessForm action=\{updateBusiness\}/g) ?? []).length, 1);
  assert.match(page, /const editingBusinessId = resolvedSearchParams\?\.editBusiness \?\? ""/);
  assert.match(portfolio, /scroll=\{false\}[\s\S]*?aria-controls=\{`edit-business-\$\{business\.id\}`\}/);
});

test("business create and edit success return to Businesses; failures retain form context", () => {
  const create = actionBody("createBusiness", "updateBusiness");
  const edit = actionBody("updateBusiness", "createDeal");
  assert.match(create, /redirect\("\/owner\?section=businesses&businessCreated=1"\)/);
  assert.match(edit, /redirect\(ownerSectionHref\("businesses"\)\)/);
  assert.match(create, /redirectWithBusinessFormError\(/);
  assert.match(edit, /redirectWithBusinessFormError\([\s\S]*?\{ businessId \}/);
  assert.match(page, /params\.set\("editBusiness", businessId\)/);
  assert.match(page, /params\.set\("createBusiness", "1"\)/);
});

test("deal create and edit success return to Deals; failures retain form context", () => {
  const create = actionBody("createDeal", "updateDeal");
  const edit = actionBody("updateDeal", "deleteDeal");
  const remove = page.slice(page.indexOf("async function deleteDeal("),
    page.indexOf("function Field("));
  assert.match(create, /redirect\(ownerSectionHref\("deals", \{ dealCreated: 1 \}\)\)/);
  assert.match(edit, /redirect\(ownerSectionHref\("deals", \{ dealUpdated: 1 \}\)\)/);
  assert.match(remove, /redirect\(ownerSectionHref\("deals"\)\)/);
  assert.match(create, /redirectWithError\([\s\S]*?"deals", \{ createDeal: 1 \}\)/);
  assert.match(edit, /redirectWithError\([\s\S]*?"deals", \{ editDeal: dealId \}\)/);
});

test("cleaning edit and create parameters retains the active section", () => {
  assert.equal(ownerSectionHref("businesses"), "/owner?section=businesses");
  assert.equal(ownerSectionHref("deals"), "/owner?section=deals");
  assert.equal(ownerSectionHref("businesses", { editBusiness: "business-b" }),
    "/owner?section=businesses&editBusiness=business-b");
  assert.equal(ownerSectionHref("deals", { editDeal: "deal-b" }),
    "/owner?section=deals&editDeal=deal-b");
});

test("all five owner sections remain navigable and analytics deletion stays in Analytics", () => {
  assert.deepEqual(OWNER_SECTIONS,
    ["overview", "businesses", "deals", "analytics", "reviews"]);
  for (const section of OWNER_SECTIONS) {
    assert.equal(ownerSectionHref(section), `/owner?section=${section}`);
  }
  assert.match(page, /href=\{`\/owner\?section=\$\{key\}`\}/);
  assert.match(page, /section=\{ownerSection\}/);
  assert.match(deleteButton, /router\.push\(ownerSectionHref\(section, \{ businessDeleted: 1 \}\)/);
});

test("first-time owner has direct next steps without leaving the correct section", () => {
  const overview = page.slice(page.indexOf('{ownerSection === "overview" ? ('),
    page.indexOf('{(ownerSection === "businesses" || ownerSection === "analytics") ? ('));
  const deals = page.slice(page.indexOf('{ownerSection === "deals" ? ('),
    page.indexOf('{ownerSection === "reviews" ? ('));
  assert.match(overview, /No businesses yet[\s\S]*?href="\/owner\?section=businesses&createBusiness=1"/);
  assert.match(page, /businessCreated === "1"[\s\S]*?href="\/owner\?section=deals&createDeal=1"/);
  assert.match(deals, /Create a business before adding deals[\s\S]*?href="\/owner\?section=businesses&createBusiness=1"/);
});
