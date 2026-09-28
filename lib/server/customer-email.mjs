import { getBusinessUrl, SPOTNERA_APP_URL } from "../business-url.js";
import { getDealAvailabilityLabel, getDealStatus, DEAL_STATUS } from "../deals.js";

export const EMAIL_BATCH_SIZE = 3;
export const MAX_SUMMARY_DEALS = 10;
export const MANAGE_NOTIFICATIONS_URL = `${SPOTNERA_APP_URL}/me`;
const SUPPORT_URL = `${SPOTNERA_APP_URL}/help#contact-support`;
const SPOTNERA_LOGO_URL = `${SPOTNERA_APP_URL}/icons/spotnera-icon-192.png`;
const FROM = "Spotnera <noreply@spotnera.com>";
const EMAIL_PATTERN = /^[^\s@<>:,;]+@(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}$/i;

export function validCustomerEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value);
}

function publicText(value, max = 500) {
  return String(value ?? "").replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, max);
}

export function escapeEmailHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

export function isEmailDiscoverable(deal, business, now = new Date()) {
  return business?.is_active === true && deal?.status !== "paused" &&
    deal?.status !== "ended" && getDealStatus(deal, now) === DEAL_STATUS.LIVE &&
    (deal.availability_mode !== "weekly" || deal.deal_schedules?.length > 0);
}

function emailHeader() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:#151b1a;border-bottom:1px solid #30413a"><tr><td style="padding:20px 24px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td width="48" valign="middle"><img src="${SPOTNERA_LOGO_URL}" width="48" height="48" alt="Spotnera" style="display:block;width:48px;height:48px;border:0;outline:none;text-decoration:none"></td><td valign="middle" style="padding-left:12px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;line-height:28px">Spotnera<span style="color:#72f0cc;font-size:12px;vertical-align:top">™</span></td></tr></table></td></tr></table>`;
}

function emailFooter() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse"><tr><td style="padding:24px;color:#a9b6b0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;text-align:center"><a href="${MANAGE_NOTIFICATIONS_URL}" style="color:#72f0cc;text-decoration:underline">Manage notifications</a><span style="color:#61736a">&nbsp;&nbsp;·&nbsp;&nbsp;</span><a href="${SUPPORT_URL}" style="color:#c4d1ca;text-decoration:underline">Contact support</a><br><span style="display:inline-block;padding-top:10px">© 2026 Spotnera</span></td></tr></table>`;
}

function emailButton(url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr><td bgcolor="#33d6a6" style="background-color:#33d6a6;border-radius:10px;text-align:center"><a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:13px 22px;color:#092019;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:20px;text-decoration:none">View deal</a></td></tr></table>`;
}

function emailShell(preheader, content) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spotnera</title></head><body style="margin:0;padding:0;background-color:#080b0a;color:#ffffff;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeEmailHtml(preheader)}</div><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#080b0a" style="border-collapse:collapse;background-color:#080b0a"><tr><td align="center" style="padding:20px 12px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#111715;border:1px solid #30413a;border-radius:18px;overflow:hidden"><tr><td>${emailHeader()}</td></tr><tr><td style="padding:28px 24px 12px">${content}</td></tr><tr><td>${emailFooter()}</td></tr></table></td></tr></table></body></html>`;
}

function emailDealCard({ businessName, title, description, availability, url }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:#1b2420;border:1px solid #35473d;border-radius:14px"><tr><td style="padding:20px"><p style="margin:0 0 8px;color:#72f0cc;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;line-height:18px">${escapeEmailHtml(businessName)}</p><h2 style="margin:0 0 10px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;line-height:27px">${escapeEmailHtml(title)}</h2>${description ? `<p style="margin:0 0 12px;color:#c4d1ca;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px">${escapeEmailHtml(description)}</p>` : ""}<p style="margin:0 0 18px;color:#a9b6b0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px">${escapeEmailHtml(availability)}</p>${emailButton(url)}</td></tr></table>`;
}

export function buildNewDealEmail({ business, deal, to }, now = new Date()) {
  const businessName = publicText(business.name, 120);
  const title = publicText(deal.title, 140);
  const description = publicText(deal.description, 500);
  const availability = publicText(getDealAvailabilityLabel(deal, now), 100);
  const url = getBusinessUrl(business);
  const subject = `New deal from ${businessName}: ${title}`.slice(0, 250);
  const lines = [`New deal from ${businessName}`, "", title];
  if (description) lines.push("", description);
  lines.push("", availability, "", `View deal: ${url}`, "",
    `Manage notifications: ${MANAGE_NOTIFICATIONS_URL}`,
    `Contact support: ${SUPPORT_URL}`, "", "© 2026 Spotnera");
  const content = `<h1 style="margin:0 0 10px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:700;line-height:33px">New deal from ${escapeEmailHtml(businessName)}</h1><p style="margin:0 0 22px;color:#a9b6b0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px">A business you saved has something new for you.</p>${emailDealCard({ businessName, title, description, availability, url })}`;
  return { from: FROM, to: [to], subject, text: lines.join("\n"),
    html: emailShell(`New deal from ${businessName}: ${title}`, content) };
}

export function selectWeeklyDeals(items, now = new Date()) {
  return items.filter(({ business, deal }) => isEmailDiscoverable(deal, business, now))
    .sort((a, b) => {
      const available = Number(getDealAvailabilityLabel(b.deal, now) === "Available now") -
        Number(getDealAvailabilityLabel(a.deal, now) === "Available now");
      if (available) return available;
      const endA = a.deal.ends_at ? Date.parse(a.deal.ends_at) : Infinity;
      const endB = b.deal.ends_at ? Date.parse(b.deal.ends_at) : Infinity;
      return endA - endB || a.business.name.localeCompare(b.business.name) ||
        a.deal.title.localeCompare(b.deal.title) || a.deal.id.localeCompare(b.deal.id);
    });
}

export function buildWeeklyEmail({ items, to }, now = new Date()) {
  const selected = selectWeeklyDeals(items, now);
  if (!selected.length) return null;
  const listed = selected.slice(0, MAX_SUMMARY_DEALS);
  const text = ["Your weekly deals", "", "Fresh deals from businesses you saved.", ""];
  const cards = [];
  for (const { business, deal } of listed) {
    const name = publicText(business.name, 120);
    const title = publicText(deal.title, 140);
    const availability = publicText(getDealAvailabilityLabel(deal, now), 100);
    const url = getBusinessUrl(business);
    text.push(name, `- ${title} (${availability})`, url, "");
    cards.push(`<tr><td style="padding-bottom:12px">${emailDealCard({ businessName: name,
      title, availability, url })}</td></tr>`);
  }
  if (selected.length > listed.length) {
    text.push(`Explore more deals: ${SPOTNERA_APP_URL}`, "");
    cards.push(`<tr><td style="padding:4px 0 8px"><a href="${SPOTNERA_APP_URL}" style="color:#72f0cc;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;text-decoration:underline">Explore more deals</a></td></tr>`);
  }
  text.push(`Manage notifications: ${MANAGE_NOTIFICATIONS_URL}`,
    `Contact support: ${SUPPORT_URL}`, "", "© 2026 Spotnera");
  const content = `<h1 style="margin:0 0 10px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:700;line-height:33px">Your weekly deals</h1><p style="margin:0 0 22px;color:#a9b6b0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px">Fresh deals from businesses you saved.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">${cards.join("")}</table>`;
  return { from: FROM, to: [to], subject: "Your weekly Spotnera deals",
    text: text.join("\n"), html: emailShell("Your weekly deals from saved businesses", content) };
}

export function osloWeeklyWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo",
    weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (values.weekday !== "Mon" || Number(values.hour) < 9) return null;
  return `${values.year}-${values.month}-${values.day}`;
}

export function activationTime(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value ?? "")) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

async function required(result) {
  if (result.error) throw new Error("Email data unavailable");
  return result.data;
}

async function loadNewDeal(admin, delivery, now) {
  const event = await required(await admin.from("notification_events")
    .select("event_type, deal_id, business_id, created_at")
    .eq("id", delivery.event_id).maybeSingle());
  if (event?.event_type !== "saved_business_new_deal") return null;
  const eventTime = Date.parse(event.created_at);
  if (!Number.isFinite(eventTime) || now.getTime() - eventTime > 24 * 60 * 60_000 ||
      eventTime > now.getTime()) return null;
  const [deal, business, favorite, preference] = await Promise.all([
    required(await admin.from("deals").select("id, business_id, title, description, is_active, status, starts_at, ends_at, availability_mode, availability_timezone")
      .eq("id", event.deal_id).maybeSingle()),
    required(await admin.from("businesses").select("id, slug, name, is_active")
      .eq("id", event.business_id).maybeSingle()),
    required(await admin.from("favorites").select("id, deal_notifications_enabled")
      .eq("user_id", delivery.user_id).eq("business_id", event.business_id).maybeSingle()),
    required(await admin.from("notification_preferences").select("new_deal_email")
      .eq("user_id", delivery.user_id).maybeSingle()),
  ]);
  if (!deal || deal.business_id !== event.business_id || !business ||
      favorite?.deal_notifications_enabled !== true || preference?.new_deal_email !== true) return null;
  if (deal.availability_mode === "weekly") {
    deal.deal_schedules = await required(await admin.from("deal_schedules")
      .select("day_of_week, start_time, end_time, spans_midnight")
      .eq("deal_id", deal.id).limit(21));
  }
  return isEmailDiscoverable(deal, business, now) ? { business, deal } : null;
}

async function loadWeeklyItems(admin, userId, now) {
  const preference = await required(await admin.from("notification_preferences")
    .select("weekly_deals_email").eq("user_id", userId).maybeSingle());
  if (preference?.weekly_deals_email !== true) return [];
  const favorites = await required(await admin.from("favorites")
    .select("business_id").eq("user_id", userId)
    .eq("deal_notifications_enabled", true).order("business_id").limit(500));
  if (!favorites.length) return [];
  const ids = favorites.map((favorite) => favorite.business_id);
  const [businesses, deals] = await Promise.all([
    required(await admin.from("businesses").select("id, slug, name, is_active")
      .in("id", ids).eq("is_active", true)),
    required(await admin.from("deals")
      .select("id, business_id, title, description, is_active, status, starts_at, ends_at, availability_mode, availability_timezone")
      .in("business_id", ids).eq("is_active", true).order("id").limit(1000)),
  ]);
  const businessById = new Map(businesses.map((business) => [business.id, business]));
  const weeklyIds = deals.filter((deal) => deal.availability_mode === "weekly")
    .map((deal) => deal.id);
  const schedules = weeklyIds.length ? await required(await admin.from("deal_schedules")
    .select("deal_id, day_of_week, start_time, end_time, spans_midnight")
    .in("deal_id", weeklyIds).limit(1000)) : [];
  const scheduleByDeal = new Map();
  for (const schedule of schedules) {
    if (!scheduleByDeal.has(schedule.deal_id)) scheduleByDeal.set(schedule.deal_id, []);
    scheduleByDeal.get(schedule.deal_id).push(schedule);
  }
  return selectWeeklyDeals(deals.map((deal) => ({ business: businessById.get(deal.business_id),
    deal: { ...deal, deal_schedules: scheduleByDeal.get(deal.id) ?? [] } }))
    .filter((item) => item.business), now);
}

async function finalize(admin, delivery, values) {
  const { data, error } = await admin.from("notification_email_deliveries")
    .update({ ...values, claim_token: null, lease_expires_at: null })
    .eq("id", delivery.delivery_id).eq("claim_token", delivery.claim_token)
    .eq("status", "sending").select("id");
  return !error && data?.length === 1;
}

export async function sendResendEmail(message, deliveryId, apiKey, fetchImpl = fetch) {
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json", "Idempotency-Key": `spotnera-email-${deliveryId}` },
      body: JSON.stringify(message), signal: AbortSignal.timeout(10_000),
    });
    // A server error could be returned after acceptance. Only an explicit
    // rate-limit rejection is safe to retry automatically.
    if (!response.ok) return { kind: response.status === 429 ? "retry" :
      response.status >= 500 ? "uncertain" : "failed" };
    const data = await response.json();
    return typeof data?.id === "string" && data.id ? { kind: "sent", id: data.id } :
      { kind: "uncertain" };
  } catch {
    return { kind: "uncertain" };
  }
}

export async function processCustomerEmail(admin, delivery, apiKey, now = new Date(),
  fetchImpl = fetch) {
  let message;
  try {
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(delivery.user_id);
    if (authError) throw authError;
    const to = authData?.user?.email;
    if (!validCustomerEmail(to) || !authData?.user?.email_confirmed_at) {
      return await finalize(admin, delivery, { status: "skipped" })
      ? "skipped" : "uncertain";
    }
    if (delivery.kind === "new_deal") {
      const item = await loadNewDeal(admin, delivery, now);
      if (item) message = buildNewDealEmail({ ...item, to }, now);
    } else if (delivery.kind === "weekly_summary") {
      if (delivery.week_start === osloWeeklyWindow(now)) {
        const items = await loadWeeklyItems(admin, delivery.user_id, now);
        message = buildWeeklyEmail({ items, to }, now);
      }
    }
  } catch {
    const status = delivery.attempts >= 4 ? "failed" : "pending";
    return await finalize(admin, delivery, { status,
      next_attempt_at: new Date(now.getTime() + 60_000).toISOString() })
      ? status === "pending" ? "retried" : "failed" : "uncertain";
  }
  if (!message) return await finalize(admin, delivery, { status: "skipped" })
    ? "skipped" : "uncertain";
  const result = await sendResendEmail(message, delivery.delivery_id, apiKey, fetchImpl);
  if (result.kind === "sent") return await finalize(admin, delivery, {
    status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.id,
  }) ? "sent" : "uncertain";
  if (result.kind === "uncertain") {
    await finalize(admin, delivery, { status: "uncertain" });
    return "uncertain";
  }
  const retry = result.kind === "retry" && delivery.attempts < 4;
  return await finalize(admin, delivery, { status: retry ? "pending" : "failed",
    next_attempt_at: new Date(now.getTime() + Math.min(60 * 2 ** delivery.attempts, 900) * 1000).toISOString(),
  }) ? retry ? "retried" : "failed" : "uncertain";
}

export async function processCustomerEmailBatch(admin, { apiKey, startAt, now = new Date(),
  fetchImpl = fetch } = {}) {
  const activation = activationTime(startAt);
  if (!apiKey?.trim() || !activation) return { disabled: true };
  const { error: expireError } = await admin.rpc("expire_customer_email_claims", {
    p_limit: EMAIL_BATCH_SIZE });
  if (expireError) throw new Error("Email claim expiry unavailable");
  const weekStart = osloWeeklyWindow(now);
  if (weekStart && now.getTime() >= Date.parse(activation)) {
    const { error } = await admin.rpc("enqueue_weekly_email_summaries", {
      p_week_start: weekStart });
    if (error) throw new Error("Weekly email enqueue unavailable");
  }
  const { data, error } = await admin.rpc("claim_customer_email_deliveries", {
    p_limit: EMAIL_BATCH_SIZE, p_not_before: activation });
  if (error) throw new Error("Email claims unavailable");
  const outcomes = await Promise.all((data ?? []).map((delivery) =>
    processCustomerEmail(admin, delivery, apiKey, now, fetchImpl)
      .catch(() => "uncertain")));
  return { processed: outcomes.length, sent: outcomes.filter((value) => value === "sent").length,
    retried: outcomes.filter((value) => value === "retried").length,
    skipped: outcomes.filter((value) => value === "skipped").length,
    failed: outcomes.filter((value) => value === "failed").length,
    uncertain: outcomes.filter((value) => value === "uncertain").length };
}
