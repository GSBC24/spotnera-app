const ACTIONS = new Set([
  "BUSINESS_VERIFIED", "BUSINESS_VERIFICATION_REMOVED",
  "BUSINESS_SUSPENDED", "BUSINESS_RESTORED",
  "DEAL_DISABLED", "DEAL_RESTORED", "REVIEW_HIDDEN", "REVIEW_RESTORED",
]);
const REASONS = new Set([
  "Misleading information", "Spam", "Inappropriate content",
  "Fake business", "Terms violation", "Other",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NEEDS_REASON = new Set(["BUSINESS_SUSPENDED", "DEAL_DISABLED", "REVIEW_HIDDEN"]);

export function validateAdminAction(body) {
  const action = body?.action;
  const targetId = body?.targetId;
  const reason = body?.reason ?? null;
  const note = body?.note ?? null;
  if (!ACTIONS.has(action) || typeof targetId !== "string" || !UUID.test(targetId) ||
    (NEEDS_REASON.has(action) && !REASONS.has(reason)) ||
    (note !== null && (typeof note !== "string" || note.length > 500))) return null;
  return { action, targetId, reason: NEEDS_REASON.has(action) ? reason : null, note };
}
