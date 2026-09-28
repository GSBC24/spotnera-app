const EMAIL_PATTERN = /^[^\s@?&#:]+@[^\s@?&#:]+\.[^\s@?&#:]+$/;

export function getPremiumContactEmail(preferred, fallback) {
  for (const value of [preferred, fallback]) {
    const email = String(value ?? "").trim();
    if (EMAIL_PATTERN.test(email)) return email;
  }
  return "";
}

export function getPremiumMailto(email) {
  return `mailto:${email}?subject=${encodeURIComponent("Spotnera Premium")}`;
}

export async function copyPremiumEmail(email, clipboard) {
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(email);
    return true;
  } catch {
    return false;
  }
}

export async function submitPremiumInquiry(payload, fetchImpl = fetch) {
  try {
    const response = await fetchImpl("/api/premium-inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return false;
    return (await response.json())?.sent === true;
  } catch {
    return false;
  }
}
