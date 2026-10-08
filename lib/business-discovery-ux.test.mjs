import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getBusinessPath, getBusinessUrl } from "./business-url.js";
import { getDealCalendarWindow } from "./deal-calendar.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const dashboard = read("../components/spotnera-dashboard.js");
const profile = read("../app/business/[id]/page.js");
const profileDeals = read("../components/business-profile-deals.js");
const profileReviews = read("../components/business-profile-reviews.js");
const profileFavorite = read("../components/business-profile-favorite.js");
const share = read("../components/business-share-actions.js");

test("Map offers a deal-only panel and direct canonical Business profile navigation", () => {
  const selectedCard = dashboard.slice(dashboard.indexOf("{selectedBusiness && isSelectedCardOpen"),
    dashboard.indexOf("{selectedBusiness && isDetailOpen"));
  const dealPanel = dashboard.slice(dashboard.indexOf("{selectedBusiness && isDetailOpen"),
    dashboard.indexOf("{activeTab === \"pulse\""));
  assert.match(selectedCard, /View deals/);
  assert.match(selectedCard, />\s*Profile\s*<\/Link>/);
  assert.match(selectedCard, /href=\{getBusinessPath\(selectedBusiness\)\}/);
  assert.doesNotMatch(selectedCard, /View profile|View details|View public profile/);
  assert.match(selectedCard, /<BusinessLocationActions/);
  assert.match(selectedCard, /<FavoriteButton/);
  assert.match(dealPanel, /<MapActiveDeals/);
  assert.match(dealPanel, /<MapUpcomingDeals/);
  assert.doesNotMatch(dealPanel, /<form|<ContactActions|<SocialLinks|View public profile/);
  assert.equal(getBusinessPath({ slug: "transport", id: "private-id" }), "/business/transport");
});

test("Map and profile deals reach the same Deal Details and Phase 6 calendar path", () => {
  const dialog = read("../components/deal-details-dialog.js");
  assert.match(dashboard, /<DealDetailsDialog business=\{selectedDeal\.business\} deal=\{selectedDeal\.deal\}/);
  assert.match(profileDeals, /<DealDetailsDialog business=\{business\} deal=\{selectedDeal\}/);
  assert.match(profileDeals, /partitionPublicProfileDeals\(deals, now\)/);
  assert.match(profileDeals, /Active Deals[\s\S]*Upcoming Deals/);
  assert.match(profileDeals, /View deal/);
  assert.match(dialog, /<DealCalendarActions business=\{business\} deal=\{deal\}/);
  const deal = { id: "deal", is_active: true, availability_mode: "continuous",
    starts_at: "2026-09-29T00:00:00Z", ends_at: "2026-09-30T00:00:00Z" };
  assert.equal(getDealCalendarWindow(deal, new Date("2026-09-29T12:00:00Z"))?.kind, "remaining");
});

test("public profile retains identity, opening hours, description, location, contact and social links", () => {
  for (const field of ["name", "category", "description", "is_active", "business_opening_hours",
    "address", "phone", "email", "website_url"]) {
    assert.match(profile, new RegExp(`\\b${field}\\b`), field);
  }
  assert.match(profile, /<BusinessOpeningStatus hours=\{business\.business_opening_hours\}/);
  assert.match(profile, /<BusinessOpeningHoursPanel/);
  assert.match(profile, /<BusinessLocationActions business=\{business\}/);
  assert.match(profile, /getContactActions\(business\)/);
  assert.match(profile, /`tel:\$\{normalizedPhone\}`/);
  assert.match(profile, /`mailto:\$\{publicEmail\}`/);
  assert.match(profile, /const websiteUrl = getWebsiteUrl\(business\.website_url\)/);
  assert.match(profile, /<BusinessEventLink[\s\S]*?href=\{action\.href\}/);
  assert.match(profile, /getSocialLinks\(business\)/);
  assert.match(profile, /href="#reviews"/);
});

test("review reading and authenticated star selection reuse the existing reviews upsert", () => {
  assert.match(profile, /\.from\("reviews"\)[\s\S]*?\.select\(REVIEW_SELECT\)/);
  assert.match(profile, /<BusinessProfileReviews/);
  assert.match(profileReviews, /reviews\.slice\(0, 8\)/);
  assert.match(profileReviews, /Write a review/);
  assert.match(profileReviews, /aria-label=\{`\$\{value\} star rating`\}/);
  assert.match(profileReviews, /maxLength=\{1000\}/);
  assert.match(profileReviews, /\.from\("reviews"\)\.upsert\(/);
  assert.match(profileReviews, /onConflict: "business_id,user_id"/);
  assert.match(profileReviews, /supabase\.auth\.getUser\(\)/);
  assert.match(profileReviews, /Sign in to write a review/);
  assert.doesNotMatch(dashboard, /\.from\("reviews"\)\.upsert\(/);
});

test("Map and public profile share favorites data while Saved owns notification controls", () => {
  assert.match(dashboard, /supabase\.from\("favorites"\)\.insert/);
  assert.match(profileFavorite, /supabase\.from\("favorites"\)\.insert/);
  assert.match(profileFavorite, /\.from\("favorites"\)[\s\S]*?\.delete\(\)/);
  assert.match(profile, /<BusinessProfileFavorite/);
  assert.match(profileFavorite, /isFavorite \? "Saved" : "Save"/);
  assert.match(dashboard, /saveBusinessDealNotificationPreference\(supabase/);
  assert.match(dashboard, /Deal notifications from this business/);
});

test("share and copy use the canonical slug URL without query parameters", () => {
  assert.equal(getBusinessUrl({ slug: "transport", id: "private-id" }),
    "https://app.spotnera.com/business/transport");
  assert.match(profile, /businessSlug=\{business\.slug\}/);
  assert.match(share, /getBusinessUrl\(\{ id: businessId, slug: businessSlug \}\)/);
  assert.doesNotMatch(share, /window\.location\.href/);
  assert.match(share, /navigator\.share/);
  assert.match(share, /navigator\.clipboard\.writeText/);
  assert.match(share, /Share business/);
  assert.match(share, /Link copied|Unable to copy link/);
});

test("QR generation remains an owner tool", () => {
  const owner = read("../app/owner/page.js");
  const ownerMenu = read("../components/owner-business-more-menu.js");
  assert.match(owner, /<OwnerBusinessMoreMenu business=\{business\}/);
  assert.match(ownerMenu, /<BusinessQrCode business=\{business\}/);
  assert.doesNotMatch(profile, /BusinessQrCode|QRCode\.toCanvas/);
});
