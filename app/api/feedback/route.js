import { handleFeedbackRequest } from "@/lib/server/support-email.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  return handleFeedbackRequest(request, { apiKey: process.env.RESEND_API_KEY });
}
