import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { createClient } from "@/utils/supabase/server";

const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+={0,2}$/;
const MAX_REQUEST_BODY_BYTES = 16 * 1024;
const MAX_ENDPOINT_CHARACTERS = 4096;

class RequestBodyTooLargeError extends Error {}

async function readLimitedJson(request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength)) {
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > MAX_REQUEST_BODY_BYTES) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!request.body) throw new SyntaxError("Missing request body.");

  const reader = request.body.getReader();
  const chunks = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    receivedBytes += value.byteLength;
    if (receivedBytes > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
}

async function readJsonOrResponse(request) {
  try {
    return { body: await readLimitedJson(request), response: null };
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return {
        body: null,
        response: NextResponse.json({ error: "Request is too large." }, { status: 413 }),
      };
    }
    return {
      body: null,
      response: NextResponse.json({ error: "Invalid subscription data." }, { status: 400 }),
    };
  }
}

function getSafeEndpoint(value) {
  if (typeof value !== "string") return null;

  const endpoint = value.trim();
  if (!endpoint || Array.from(endpoint).length > MAX_ENDPOINT_CHARACTERS) return null;

  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) {
      return null;
    }
  } catch {
    return null;
  }

  return endpoint;
}

function decodeBase64Url(value) {
  if (typeof value !== "string") return null;
  if (!value || value !== value.trim() || !BASE64_URL_PATTERN.test(value)) return null;

  const unpadded = value.replace(/=+$/, "");
  const suppliedPadding = value.length - unpadded.length;
  if (unpadded.length % 4 === 1) return null;

  const requiredPadding = (4 - (unpadded.length % 4)) % 4;
  if (suppliedPadding !== 0 && suppliedPadding !== requiredPadding) return null;

  try {
    const decoded = Buffer.from(
      `${unpadded}${"=".repeat(requiredPadding)}`.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    );
    return decoded.toString("base64url") === unpadded ? decoded : null;
  } catch {
    return null;
  }
}

function getSafeP256dh(value) {
  const decoded = decodeBase64Url(value);
  return decoded?.length === 65 && decoded[0] === 0x04 ? value : null;
}

function getSafeAuth(value) {
  const decoded = decodeBase64Url(value);
  return decoded?.length === 16 ? value : null;
}

function getSafeExpiration(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= Date.now()) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }

  const { supabase, user } = await getAuthenticatedClient();
  if (!user) {
    return NextResponse.json({ error: "Sign in to enable push on this device." }, { status: 401 });
  }

  const { body, response } = await readJsonOrResponse(request);
  if (response) return response;

  const endpoint = getSafeEndpoint(body?.endpoint);
  const p256dh = getSafeP256dh(body?.keys?.p256dh);
  const auth = getSafeAuth(body?.keys?.auth);
  const expiresAt = getSafeExpiration(body?.expirationTime);

  if (!endpoint || !p256dh || !auth || expiresAt === undefined) {
    return NextResponse.json({ error: "Invalid subscription data." }, { status: 400 });
  }

  const { error } = await supabase.from("notification_devices").upsert(
    {
      user_id: user.id,
      platform: "web",
      provider: "webpush",
      push_token: null,
      endpoint,
      p256dh,
      auth,
      expires_at: expiresAt,
      disabled_at: null,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json(
      { error: "Unable to enable push on this device. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }

  const { supabase, user } = await getAuthenticatedClient();
  if (!user) {
    return NextResponse.json({ error: "Sign in to disable push on this device." }, { status: 401 });
  }

  const { body, response } = await readJsonOrResponse(request);
  if (response) return response;

  const endpoint = getSafeEndpoint(body?.endpoint);
  if (!endpoint) {
    return NextResponse.json({ error: "Invalid subscription data." }, { status: 400 });
  }

  const { error } = await supabase
    .from("notification_devices")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "webpush")
    .eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json(
      { error: "Unable to disable push on this device. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }

  const { supabase, user } = await getAuthenticatedClient();
  if (!user) {
    return NextResponse.json({ error: "Sign in to check this device." }, { status: 401 });
  }

  const { body, response } = await readJsonOrResponse(request);
  if (response) return response;

  const endpoint = getSafeEndpoint(body?.endpoint);
  if (!endpoint) {
    return NextResponse.json({ error: "Invalid subscription data." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("notification_devices")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "webpush")
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Unable to check push on this device. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ownedByCurrentUser: Boolean(data) });
}
