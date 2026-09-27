import { SUPPORT_CATEGORIES, SUPPORT_EMAIL } from "../support-contact.mjs";

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

export function validateSupportPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (typeof payload.website !== "undefined" && typeof payload.website !== "string") return null;
  if (payload.website?.trim()) return null; // Hidden honeypot field.
  if (!SUPPORT_CATEGORIES.includes(payload.category)) return null;
  const subject = cleanField(payload.subject, 140);
  const message = cleanField(payload.message, 2_000, true);
  const email = cleanField(payload.email, 254);
  if (!subject || !message || !email || !EMAIL_PATTERN.test(email)) return null;
  return { category: payload.category, subject, message, email };
}

export function createSupportEmail(validated) {
  return {
    from: FROM_EMAIL,
    to: [SUPPORT_EMAIL],
    reply_to: validated.email,
    subject: `Spotnera Support Request: ${validated.subject}`,
    text: ["Spotnera Support Request", "", `Topic: ${validated.category}`,
      `Subject: ${validated.subject}`, `Reply email: ${validated.email}`, "", "Message:", validated.message].join("\n"),
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

export async function handleSupportRequest(request, { apiKey, fetchImpl = fetch } = {}) {
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
  const validated = validateSupportPayload(payload);
  if (!validated) return jsonResult({ error: "Please check your message and try again." }, 400);
  if (!apiKey?.trim()) return jsonResult({ error: "Unable to send message." }, 503);

  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(createSupportEmail(validated)),
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
