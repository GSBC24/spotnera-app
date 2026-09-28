import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildNewDealEmail, buildWeeklyEmail } from "../lib/server/customer-email.mjs";

const output = await mkdtemp(join(tmpdir(), "spotnera-email-preview-"));
const now = new Date("2026-09-28T07:05:00Z");
const business = { id: "preview-business", slug: "preview-cafe", name: "Example Café",
  is_active: true };
const deal = { id: "preview-deal", business_id: business.id,
  title: "Coffee and cake", description: "Enjoy a weekday treat.",
  is_active: true, status: "active", starts_at: null, ends_at: null,
  availability_mode: "continuous" };
const messages = {
  "new-deal": buildNewDealEmail({ business, deal, to: "preview@example.org" }, now),
  "weekly-summary": buildWeeklyEmail({ items: [{ business, deal }],
    to: "preview@example.org" }, now),
};

for (const [name, message] of Object.entries(messages)) {
  await writeFile(join(output, `${name}.html`), message.html, "utf8");
  await writeFile(join(output, `${name}.txt`), message.text, "utf8");
}

process.stdout.write(`Local email previews: ${output}\n`);
