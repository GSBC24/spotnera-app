import { handleSupportRequest } from "@/lib/server/support-email.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  return handleSupportRequest(request, { apiKey: process.env.RESEND_API_KEY });
}
