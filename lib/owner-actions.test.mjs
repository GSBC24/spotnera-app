import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getOwnerDealTimingLabel } from "./owner-deal-presentation.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const owner = read("../app/owner/page.js");
const menu = read("../components/owner-business-more-menu.js");
const deleteButton = read("../components/delete-business-button.js");
const map = read("../components/spotnera-dashboard.js");
const location = read("../components/business-location-actions.js");
const now = new Date("2026-09-24T12:00:00Z");

test("map card retains direct deals, profile, bookmark, directions and copy actions", () => {
  const card = map.slice(map.indexOf("{selectedBusiness && isSelectedCardOpen"), map.indexOf("{selectedBusiness && isDetailOpen"));
  assert.match(card, /selectedBusinessLiveDeals\.length \? <button[\s\S]*?View deals/);
  assert.match(card, /href=\{getBusinessPath\(selectedBusiness\)\}[\s\S]*?Profile/);
  assert.match(card, /<FavoriteButton[\s\S]*?handleToggleFavorite\(selectedBusiness\)/);
  assert.match(map, /requestAuth\(getBusinessPath\(business\)\)/);
  assert.match(map, /const nextFavoriteState = !business\.isFavorite/);
  assert.match(location, /getBusinessDirectionsUrl\(business\)/);
  assert.match(location, /copyBusinessAddress\(address\)/);
});

test("owner business card keeps Edit and canonical Profile visible with accessible More actions", () => {
  const card = owner.slice(owner.indexOf("<article\n                    className=\"rounded-[24px]"), owner.indexOf("{ownerSection === \"businesses\" && editingBusinessId === business.id"));
  assert.match(owner, /href=\{`\/owner\?section=businesses&editBusiness=\$\{business\.id\}`\}/);
  assert.match(owner, /href=\{getBusinessPath\(business\)\}/);
  assert.match(owner, /<OwnerBusinessMoreMenu business=\{business\} section=\{ownerSection\}/);
  assert.match(menu, /<details[\s\S]*?<summary[\s\S]*?More/);
  assert.match(menu, /<CopyProfileLinkButton[\s\S]*?<BusinessQrCode[\s\S]*?<DeleteBusinessButton/);
  assert.match(menu, /event\.key === "Escape"/);
  assert.match(menu, /!event\.target\.closest\('\[role="dialog"\]'\)/);
  assert.match(menu, /pointerdown/);
  assert.match(deleteButton, /confirmation === "DELETE" && !isDeleting/);
  assert.match(deleteButton, /Type DELETE to confirm/);
  assert.match(deleteButton, /disabled=\{!canDelete\}/);
  assert.match(deleteButton, /onKeyDown=\{\(event\) => \{ if \(event\.key === "Escape" && !isDeleting\)/);
  assert.ok(card.length > 0);
});

test("owner deals show one status, one relevant timing line and edit action", () => {
  const deals = owner.slice(owner.indexOf('{ownerSection === "deals" ? ('), owner.indexOf('{ownerSection === "reviews" ? ('));
  assert.match(deals, /DEAL_STATUS_META\[status\]\.label/);
  assert.equal((deals.match(/<OwnerDealTimingLabel deal=\{deal\}/g) ?? []).length, 1);
  assert.doesNotMatch(deals, /<DealTimeLabel deal=\{deal\}|<DealAvailabilityLabel deal=\{deal\}/);
  assert.match(deals, /href=\{`\/owner\?section=deals&editDeal=\$\{deal\.id\}`\}[\s\S]*?Edit deal/);
  assert.match(deals, /<DealForm action=\{updateDeal\} deal=\{deal\}/);

  const continuous = { is_active: true, availability_mode: "continuous", starts_at: "2026-09-20T12:00:00Z", ends_at: "2026-09-25T12:00:00Z" };
  assert.match(getOwnerDealTimingLabel(continuous, now), /^Ends /);
  assert.doesNotMatch(getOwnerDealTimingLabel(continuous, now), /Active/);
  assert.match(getOwnerDealTimingLabel({ ...continuous, ends_at: "2026-09-23T12:00:00Z" }, now), /^Ended /);
  assert.match(getOwnerDealTimingLabel({ ...continuous, starts_at: "2026-09-25T12:00:00Z", ends_at: null }, now), /^Starts /);
  assert.equal(getOwnerDealTimingLabel({ ...continuous, is_active: false }, now), "Not visible to customers");
  const weekly = { ...continuous, starts_at: null, ends_at: null, availability_mode: "weekly", deal_schedules: [
    { day_of_week: 5, start_time: "09:00:00", end_time: "11:00:00", spans_midnight: false },
  ] };
  assert.match(getOwnerDealTimingLabel(weekly, now), /^Next available /);
});

test("header actions and feedback routes remain reachable without changing navigation", () => {
  const help = read("../components/help-link.js");
  const logout = read("../components/header-logout.js");
  const account = read("../components/profile-account-view.js");
  const helpPage = read("../app/help/page.js");
  const nav = read("../components/spotnera-bottom-nav.js");
  const search = read("./search-panel.test.mjs");
  assert.match(owner, /href="\/feedback"[\s\S]*?Give feedback<\/Link>/);
  assert.match(owner, /<HelpLink showLabel/);
  assert.match(owner, /<HeaderLogout withIcon/);
  assert.match(help, /href="\/help"/);
  assert.match(logout, /<LogoutButton/);
  assert.match(account, /href="\/feedback"/);
  assert.match(helpPage, /href="\/feedback"/);
  assert.doesNotMatch(nav, /feedback/);
  assert.match(search, /Search opens with filters/);
});
