export const SUPPORT_EMAIL = "support@spotnera.com";
export const SUPPORT_CATEGORIES = Object.freeze([
  "Customer", "Business", "Account", "Deal", "Notifications", "Other",
]);

export async function submitSupportForm(payload, fetchImpl = fetch) {
  try {
    const response = await fetchImpl("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result?.sent === true;
  } catch {
    return false;
  }
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
