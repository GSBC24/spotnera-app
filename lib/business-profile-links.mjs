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
  { field: "x_url", label: "X (Twitter)", openLabel: "X", platform: "x" },
];

const X_PROFILE_HOSTS = ["x.com", "www.x.com", "twitter.com", "www.twitter.com"];
const X_HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const X_RESERVED_PATHS = new Set(["home", "explore", "search", "intent", "share", "i", "messages", "notifications", "settings", "compose", "login", "signup", "hashtag"]);

export function normalizeXProfile(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { value: null };
  const error = { error: "Enter a valid X (Twitter) profile link." };
  if (/^@?[A-Za-z0-9_]{1,15}$/.test(raw)) {
    const handle = raw.replace(/^@/, "");
    return X_RESERVED_PATHS.has(handle.toLowerCase()) ? error : { value: `https://x.com/${handle}` };
  }
  const candidate = X_PROFILE_HOSTS.some((host) => raw.toLowerCase().startsWith(`${host}/`))
    ? `https://${raw}` : raw;
  try {
    const url = new URL(candidate);
    const segments = url.pathname.split("/").filter(Boolean);
    if (!["http:", "https:"].includes(url.protocol) || !X_PROFILE_HOSTS.includes(url.hostname.toLowerCase()) ||
      url.username || url.password || url.port || url.search || url.hash || segments.length !== 1 ||
      !X_HANDLE.test(segments[0]) || X_RESERVED_PATHS.has(segments[0].toLowerCase())) return error;
    url.protocol = "https:";
    return { value: url.toString() };
  } catch {
    return error;
  }
}

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
  if (profile.field === "x_url") return normalizeXProfile(value).value;
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
      openLabel: profile.openLabel ?? profile.label,
      platform: profile.platform ?? profile.label.toLowerCase(),
      href,
      detail: `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}${url.search}`,
    };
  }).filter(Boolean);
}
