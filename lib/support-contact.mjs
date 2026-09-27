export const SUPPORT_EMAIL = "support@spotnera.com";
export const SUPPORT_CATEGORIES = Object.freeze([
  "Customer", "Business", "Account", "Deal", "Notifications", "Other",
]);

export function prepareSupportMessage({ category, subject, message, replyEmail = "" }) {
  const safeCategory = SUPPORT_CATEGORIES.includes(category) ? category : "Other";
  const safeSubject = String(subject ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 140);
  const safeMessage = String(message ?? "").trim().slice(0, 2000);
  const safeReplyEmail = String(replyEmail ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 254);
  const body = [`Category: ${safeCategory}`, "", safeMessage,
    ...(safeReplyEmail ? ["", `Reply email: ${safeReplyEmail}`] : [])].join("\n");
  return {
    subject: `Spotnera Support — ${safeCategory}: ${safeSubject}`,
    body,
    mailto: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Spotnera Support — ${safeCategory}: ${safeSubject}`)}&body=${encodeURIComponent(body)}`,
    copyText: `To: ${SUPPORT_EMAIL}\nSubject: Spotnera Support — ${safeCategory}: ${safeSubject}\n\n${body}`,
  };
}

export async function copySupportText(text, clipboard) {
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
