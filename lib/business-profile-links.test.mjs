import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSocialLinks, getWebsiteUrl } from "./business-profile-links.mjs";

const profile = readFileSync(new URL("../app/business/[id]/page.js", import.meta.url), "utf8");
const actions = readFileSync(new URL("../components/business-contact-actions.js", import.meta.url), "utf8");
const feedback = readFileSync(new URL("../components/use-business-copy-feedback.js", import.meta.url), "utf8");
const share = readFileSync(new URL("../components/business-share-actions.js", import.meta.url), "utf8");
const location = readFileSync(new URL("../components/business-location-actions.js", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../components/spotnera-bottom-nav.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("website links retain full safe URLs and reject unsafe schemes", () => {
  assert.equal(getWebsiteUrl("example.com/menu?q=1"), "https://example.com/menu?q=1");
  assert.equal(getWebsiteUrl("https://example.com/path"), "https://example.com/path");
  for (const value of [null, "", "javascript:alert(1)", "data:text/html,bad", "ftp://example.com", "localhost"]) {
    assert.equal(getWebsiteUrl(value), null);
  }
  assert.match(profile, /label: "Website"[\s\S]*?action: "Visit website"[\s\S]*?detail: websiteUrl[\s\S]*?href: websiteUrl/);
});

test("configured social accounts map to their real validated URLs", () => {
  const links = getSocialLinks({
    facebook_url: "facebook.com/spotnera",
    instagram_url: "@spotnera.oslo",
    tiktok_url: "https://www.tiktok.com/@spotnera",
    snapchat_url: "snapchat.com/add/spotnera",
  });
  assert.deepEqual(links.map(({ label, href }) => [label, href]), [
    ["Facebook", "https://facebook.com/spotnera"],
    ["Instagram", "https://www.instagram.com/spotnera.oslo"],
    ["TikTok", "https://www.tiktok.com/@spotnera"],
    ["Snapchat", "https://snapchat.com/add/spotnera"],
  ]);
  assert.equal(links[1].detail, "instagram.com/spotnera.oslo");
});

test("missing accounts and unsafe social URLs never become links", () => {
  assert.deepEqual(getSocialLinks({}), []);
  assert.deepEqual(getSocialLinks({ x_url: "https://x.com/example" }), []);
  assert.deepEqual(getSocialLinks({
    facebook_url: "javascript:alert(1)",
    instagram_url: "https://instagram.com.evil.example/spotnera",
    tiktok_url: "data:text/html,bad",
    snapchat_url: "https://snapchat.com/",
  }), []);
});

test("external cards open safely and copy only the validated full link", () => {
  assert.match(profile, /<BusinessContactActions key=\{action\.href\} business=\{business\} action=\{action\}/);
  assert.match(profile, /<BusinessContactActions key=\{link\.label\} business=\{business\} action=\{\{/);
  assert.match(profile, /action: `Open \$\{link\.label\}`/);
  assert.match(actions, /const copyValue = action\.external \? action\.href : action\.detail/);
  assert.match(actions, /target=\{action\.external \? "_blank" : undefined\}/);
  assert.match(actions, /rel=\{action\.external \? "noopener noreferrer" : undefined\}/);
  assert.match(actions, /aria-live="polite"/);
  assert.match(feedback, /showFeedback\(copied \? successMessage : "Could not copy/);
});

test("profile image and action groups retain responsive wrapping and visible navigation", () => {
  assert.match(profile, /min-h-\[280px\] bg-cover bg-center sm:min-h-\[360px\]/);
  assert.match(profile, /relative flex min-h-\[280px\][\s\S]*?sm:min-h-\[360px\]/);
  assert.match(profile, /object-contain object-center p-2/);
  assert.match(profile, /overflow-x-hidden/);
  assert.match(share, /flex flex-wrap items-start gap-2/);
  assert.match(actions, /mt-3 flex flex-wrap gap-2/);
  assert.match(location, /flex min-w-0 flex-wrap gap-2/);
  assert.match(navigation, /w-\[min\(97vw,620px\)\]/);
  assert.match(styles, /body:has\(\[data-spotnera-bottom-nav\]\) > footer[\s\S]*?margin-bottom:/);
});
