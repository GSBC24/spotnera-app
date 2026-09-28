import { SUPPORT_CATEGORIES, SUPPORT_EMAIL } from "../support-contact.mjs";
import { FEEDBACK_QUESTIONS } from "../feedback.mjs";
import { internalContactHtml } from "./internal-contact-email.mjs";

const FROM_EMAIL = "Spotnera Support <noreply@spotnera.com>";
const MAX_BODY_BYTES = 8_192;
const EMAIL_PATTERN = /^[^\s@<>:,;]+@(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}$/i;

function cleanField(value, limit, allowNewlines = false) {
  if (typeof value !== "string" || value.length > limit + 20) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > limit || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(trimmed)) return null;
  if (!allowNewlines && /[\r\n]/.test(trimmed)) return null;
  return trimmed;
}

export function cleanOptionalPhone(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return null;
  const phone = value.trim();
  if (!phone) return "";
  const digitCount = (phone.match(/\d/g) ?? []).length;
  return phone.length <= 40 && /^\+?[0-9][0-9 ().-]*$/.test(phone)
    && digitCount >= 6 && digitCount <= 20 ? phone : null;
}

function validHoneypot(payload) {
  return typeof payload.website === "undefined" ||
    typeof payload.website === "string" && !payload.website.trim();
}

export function validateSupportPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (!validHoneypot(payload)) return null;
  if (!SUPPORT_CATEGORIES.includes(payload.category)) return null;
  const subject = cleanField(payload.subject, 140);
  const message = cleanField(payload.message, 2_000, true);
  const email = cleanField(payload.email, 254);
  const phone = cleanOptionalPhone(payload.phone);
  if (!subject || !message || !email || !EMAIL_PATTERN.test(email) || phone === null) return null;
  return { category: payload.category, subject, message, email, ...(phone ? { phone } : {}) };
}

export function validatePremiumPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      !validHoneypot(payload)) return null;
  const contactName = cleanField(payload.contactName, 120);
  const businessName = cleanField(payload.businessName, 120);
  const email = cleanField(payload.email, 254);
  const message = cleanField(payload.message, 2_000, true);
  const phone = cleanOptionalPhone(payload.phone);
  if (!contactName || !businessName || !email || !EMAIL_PATTERN.test(email) ||
      !message || phone === null) return null;
  return { contactName, businessName, email, message, ...(phone ? { phone } : {}) };
}

export function validateFeedbackPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !validHoneypot(payload)) return null;
  for (const key of ["contactName", "email"]) {
    if (payload[key] !== undefined && payload[key] !== null && typeof payload[key] !== "string") return null;
  }
  const businessName = cleanField(payload.businessName, 120);
  const contactName = payload.contactName?.trim() ? cleanField(payload.contactName, 120) : "";
  const email = payload.email?.trim() ? cleanField(payload.email, 254) : "";
  const phone = cleanOptionalPhone(payload.phone);
  if (!businessName || contactName === null || email === null ||
      (email && !EMAIL_PATTERN.test(email)) || phone === null ||
      !payload.answers || typeof payload.answers !== "object" || Array.isArray(payload.answers)) return null;
  const answers = {};
  for (const question of FEEDBACK_QUESTIONS) {
    const answer = cleanField(payload.answers[question.id], 500, question.type === "text");
    if (!answer || (question.type === "choice" && !question.options.includes(answer))) return null;
    answers[question.id] = answer;
  }
  return { businessName, contactName, email, phone, answers };
}

export function createFeedbackEmail(validated, submittedAt = new Date()) {
  const questions = FEEDBACK_QUESTIONS.map((question, index) =>
    [`${index + 1}. ${question.label}`, validated.answers[question.id]]);
  const submitted = submittedAt.toISOString();
  return {
    from: FROM_EMAIL,
    to: [SUPPORT_EMAIL],
    ...(validated.email ? { reply_to: validated.email } : {}),
    subject: `[Spotnera] Business Feedback — ${validated.businessName}`,
    text: ["BUSINESS FEEDBACK", "", `Business: ${validated.businessName}`,
      ...(validated.contactName ? [`Contact name: ${validated.contactName}`] : []),
      ...(validated.email ? [`Email: ${validated.email}`] : []),
      ...(validated.phone ? [`Phone: ${validated.phone}`] : []), "",
      ...questions.flatMap(([label, answer]) => [label, answer, ""]),
      `Submitted: ${submitted}`, "", "© 2026 Spotnera"].join("\n"),
    html: internalContactHtml({ label: "BUSINESS FEEDBACK", heading: "New business feedback",
      rows: [["Business", validated.businessName],
        ...(validated.contactName ? [["Contact name", validated.contactName]] : []),
        ...(validated.email ? [["Email", validated.email]] : []),
        ...(validated.phone ? [["Phone", validated.phone]] : []),
        ["Submitted", submitted]],
      details: questions, replyHint: Boolean(validated.email) }),
  };
}

export function createSupportEmail(validated) {
  return {
    from: FROM_EMAIL,
    to: [SUPPORT_EMAIL],
    reply_to: validated.email,
    subject: `Spotnera Support — ${validated.category} — ${validated.subject}`,
    text: ["SUPPORT", "", `Topic: ${validated.category}`,
      `Email: ${validated.email}`, ...(validated.phone ? [`Phone: ${validated.phone}`] : []),
      `Subject: ${validated.subject}`, "", "Message:", validated.message].join("\n"),
    html: internalContactHtml({ label: "SUPPORT", rows: [
      ["Topic", validated.category], ["Email", validated.email],
      ...(validated.phone ? [["Phone", validated.phone]] : []),
      ["Subject", validated.subject],
    ], message: validated.message }),
  };
}

export function createPremiumEmail(validated) {
  return {
    from: FROM_EMAIL,
    to: [SUPPORT_EMAIL],
    reply_to: validated.email,
    subject: `Spotnera Premium inquiry — ${validated.businessName}`,
    text: ["PREMIUM INQUIRY", "", `Business: ${validated.businessName}`,
      `Contact name: ${validated.contactName}`, `Email: ${validated.email}`,
      ...(validated.phone ? [`Phone: ${validated.phone}`] : []),
      "", "Message:", validated.message].join("\n"),
    html: internalContactHtml({ label: "PREMIUM INQUIRY", rows: [
      ["Business", validated.businessName], ["Contact name", validated.contactName],
      ["Email", validated.email], ...(validated.phone ? [["Phone", validated.phone]] : []),
    ], message: validated.message }),
  };
}

function jsonResult(body, status) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function readLimitedJson(request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) throw new Error("Payload too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing payload");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("Payload too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

async function handleContactRequest(request, { apiKey, fetchImpl = fetch } = {},
  validate, createEmail) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return jsonResult({ error: "Unable to send message." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResult({ error: "Please check your message and try again." }, 400);
  }

  let payload;
  try {
    payload = await readLimitedJson(request);
  } catch {
    return jsonResult({ error: "Please check your message and try again." }, 400);
  }
  const validated = validate(payload);
  if (!validated) return jsonResult({ error: "Please check your message and try again." }, 400);
  if (!apiKey?.trim()) return jsonResult({ error: "Unable to send message." }, 503);

  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(createEmail(validated)),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return jsonResult({ error: "Unable to send message." }, 503);
    const result = await response.json();
    if (typeof result?.id !== "string" || !result.id) {
      return jsonResult({ error: "Unable to send message." }, 503);
    }
    return jsonResult({ sent: true }, 200);
  } catch {
    return jsonResult({ error: "Unable to send message." }, 503);
  }
}

export function handleSupportRequest(request, options) {
  return handleContactRequest(request, options, validateSupportPayload, createSupportEmail);
}

export function handlePremiumRequest(request, options) {
  return handleContactRequest(request, options, validatePremiumPayload, createPremiumEmail);
}

export function handleFeedbackRequest(request, options) {
  return handleContactRequest(request, options, validateFeedbackPayload, createFeedbackEmail);
}
