const SOCIAL_PROFILES = [
  {
    field: "facebook_url",
    label: "Facebook",
    hosts: ["facebook.com", "www.facebook.com", "fb.com", "www.fb.com"],
    buildUrl: (handle) => `https://www.facebook.com/${handle}`,
    handlePattern: /^[A-Za-z0-9.]{3,80}$/,
  },
  {
    field: "instagram_url",
    label: "Instagram",
    hosts: ["instagram.com", "www.instagram.com"],
    buildUrl: (handle) => `https://www.instagram.com/${handle}`,
    handlePattern: /^[A-Za-z0-9._]{1,30}$/,
  },
  {
    field: "tiktok_url",
    label: "TikTok",
    hosts: ["tiktok.com", "www.tiktok.com"],
    buildUrl: (handle) => `https://www.tiktok.com/@${handle}`,
    handlePattern: /^[A-Za-z0-9._]{2,24}$/,
  },
  {
    field: "snapchat_url",
    label: "Snapchat",
    hosts: ["snapchat.com", "www.snapchat.com"],
    buildUrl: (handle) => `https://www.snapchat.com/add/${handle}`,
    handlePattern: /^[A-Za-z0-9._-]{3,30}$/,
  },
];

function getDisplayValue(value) {
  return String(value ?? "").trim() || null;
}

export function getWebsiteUrl(value) {
  const rawValue = getDisplayValue(value);
  if (!rawValue) return null;
  const urlCandidate = /^[a-z][a-z\d+.-]*:/i.test(rawValue)
    ? rawValue
    : `https://${rawValue}`;
  try {
    const url = new URL(urlCandidate);
    return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function getSocialUrl(value, profile) {
  const rawValue = getDisplayValue(value);
  if (!rawValue) return null;
  const lowerRawValue = rawValue.toLowerCase();
  const schemelessUrl = profile.hosts.some(
    (host) => lowerRawValue === host || lowerRawValue.startsWith(`${host}/`),
  );
  const urlCandidate = schemelessUrl ? `https://${rawValue}` : rawValue;
  try {
    const url = new URL(urlCandidate);
    if (!["http:", "https:"].includes(url.protocol) ||
      !profile.hosts.includes(url.hostname.toLowerCase()) ||
      !url.pathname.split("/").filter(Boolean).length) return null;
    return url.toString();
  } catch {
    const handle = rawValue.replace(/^@+/, "").replace(/^\/+/, "").split("/").filter(Boolean)[0];
    return handle && profile.handlePattern.test(handle) ? profile.buildUrl(handle) : null;
  }
}

export function getSocialLinks(business) {
  return SOCIAL_PROFILES.map((profile) => {
    const href = getSocialUrl(business[profile.field], profile);
    if (!href) return null;
    const url = new URL(href);
    return {
      label: profile.label,
      href,
      detail: `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}${url.search}`,
    };
  }).filter(Boolean);
}
