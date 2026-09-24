function clean(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function getBusinessAddressLines(business) {
  const street = clean(business?.address);
  const existingParts = street.split(",").map((part) => part.trim().toLocaleLowerCase());
  const locality = [];
  for (const value of [business?.city, business?.country]) {
    const part = clean(value);
    const normalized = part.toLocaleLowerCase();
    if (!part || locality.some((item) => item.toLocaleLowerCase() === normalized)) continue;
    if (existingParts.some((item) => item === normalized || item.endsWith(` ${normalized}`))) continue;
    locality.push(part);
  }
  return [street, locality.join(", ")].filter(Boolean);
}

export function getCopyableBusinessAddress(business) {
  if (!clean(business?.address)) return "";
  return getBusinessAddressLines(business).join(", ");
}

export function getBusinessDirectionsUrl(business) {
  const latitude = business?.latitude;
  const longitude = business?.longitude;
  const hasCoordinates = latitude !== null && latitude !== undefined && latitude !== "" &&
    longitude !== null && longitude !== undefined && longitude !== "" &&
    Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const destination = hasCoordinates
    ? `${Number(latitude)},${Number(longitude)}`
    : getCopyableBusinessAddress(business);
  return destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
    : null;
}

export async function copyBusinessAddress(address, {
  clipboard = globalThis.navigator?.clipboard,
  documentRef = globalThis.document,
  secureContext = globalThis.isSecureContext,
} = {}) {
  if (!address) return false;
  if (secureContext && clipboard?.writeText) {
    try {
      await clipboard.writeText(address);
      return true;
    } catch {
      // Try the selection-based fallback below.
    }
  }
  if (!documentRef?.body || typeof documentRef.createElement !== "function" ||
    typeof documentRef.execCommand !== "function") return false;
  const previousFocus = documentRef.activeElement;
  let field;
  try {
    field = documentRef.createElement("textarea");
    field.value = address;
    field.readOnly = true;
    field.style.position = "fixed";
    field.style.left = "-9999px";
    documentRef.body.appendChild(field);
    field.focus();
    field.select();
    return Boolean(documentRef.execCommand("copy"));
  } catch {
    return false;
  } finally {
    try { field?.remove?.(); } catch { /* Clipboard failure must not interrupt the page. */ }
    try { previousFocus?.focus?.(); } catch { /* Focus may have moved elsewhere. */ }
  }
}
