const PAGE_SIZE = 1000;
const SAFE_ERROR_CODES = new Set([
  "42703", "42P01", "42501", "PGRST116", "PGRST204",
  "bad_jwt", "not_admin", "unexpected_failure", "user_not_found",
]);

function safeErrorDetails(error, responseStatus, operation) {
  const code = typeof error?.code === "string" && SAFE_ERROR_CODES.has(error.code)
    ? error.code : null;
  const rawStatus = error?.status ?? responseStatus;
  const status = Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : null;
  let message = "Admin directory request failed";
  if (code === "42703") message = "Database column unavailable";
  else if (code === "42P01") message = "Database relation unavailable";
  else if (code === "42501" || status === 401 || status === 403) message = "Upstream authorization denied";
  else if (code?.startsWith("PGRST")) message = "Database API request failed";
  else if (operation.startsWith("Auth Admin")) message = "Auth Admin API request failed";
  else if (status && status >= 500) message = "Upstream service error";
  return { operation, code, status, message };
}

async function readAdminResult(operation, request) {
  let result;
  try {
    result = await request;
    if (result.error) throw result.error;
    return result.data;
  } catch (error) {
    console.error("Admin directory request failed", safeErrorDetails(error, result?.status, operation));
    throw error;
  }
}

export function available(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function adminPerson(authUser, profile, ownedBusinesses = [], isPlatformAdmin = false) {
  const profileName = [profile?.first_name, profile?.last_name].map((part) => available(part, "")).filter(Boolean).join(" ");
  const metadataName = authUser?.user_metadata?.full_name ?? authUser?.user_metadata?.name;
  return {
    id: authUser?.id ?? profile?.id ?? "",
    name: profileName || available(profile?.full_name, "") || available(profile?.username, "") || available(metadataName, "Name unavailable"),
    email: available(authUser?.email, "Email unavailable"),
    phone: available(profile?.phone, available(authUser?.phone, "Phone not provided")),
    createdAt: authUser?.created_at ?? profile?.created_at ?? null,
    businesses: ownedBusinesses,
    isPlatformAdmin,
  };
}

async function loadOwnedBusinesses(admin, ownerIds) {
  const businesses = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await readAdminResult("Businesses query", admin.from("businesses").select("id, name, owner_id")
      .in("owner_id", ownerIds).order("id").range(offset, offset + PAGE_SIZE - 1));
    businesses.push(...(page ?? []));
    if ((page?.length ?? 0) < PAGE_SIZE) break;
  }
  return businesses;
}

export async function getAdminUserDetails(admin, userId) {
  if (!userId) return null;
  const [authData, profile, businesses, membership] = await Promise.all([
    readAdminResult("Auth Admin getUserById", admin.auth.admin.getUserById(userId)),
    readAdminResult("Profiles query", admin.from("profiles")
      .select("id, username, full_name, first_name, last_name, phone, created_at").eq("id", userId).maybeSingle()),
    loadOwnedBusinesses(admin, [userId]),
    readAdminResult("Platform admins query", admin.from("platform_admins")
      .select("user_id").eq("user_id", userId).maybeSingle()),
  ]);
  if (!authData?.user) return null;
  return adminPerson(authData.user, profile,
    businesses.sort((a, b) => a.name.localeCompare(b.name)), Boolean(membership));
}

export async function listAdminUsers(admin, query = "") {
  const authData = await readAdminResult("Auth Admin listUsers", admin.auth.admin.listUsers({ page: 1, perPage: 100 }));
  const users = authData?.users ?? [];
  if (!users.length) return [];
  const ids = users.map((user) => user.id);
  const [profileRows, adminRows] = await Promise.all([
    readAdminResult("Profiles query", admin.from("profiles")
      .select("id, username, full_name, first_name, last_name, phone, created_at").in("id", ids)),
    readAdminResult("Platform admins query", admin.from("platform_admins")
      .select("user_id").in("user_id", ids)),
  ]);
  const businesses = await loadOwnedBusinesses(admin, ids);
  const profiles = new Map((profileRows ?? []).map((profile) => [profile.id, profile]));
  const adminIds = new Set((adminRows ?? []).map((member) => member.user_id));
  const businessesByOwner = new Map();
  for (const business of businesses) {
    const owned = businessesByOwner.get(business.owner_id) ?? [];
    owned.push(business);
    businessesByOwner.set(business.owner_id, owned);
  }
  const people = users.map((user) => adminPerson(user, profiles.get(user.id),
    businessesByOwner.get(user.id) ?? [], adminIds.has(user.id)));
  const search = query.toLocaleLowerCase();
  return search ? people.filter((person) => [person.name, person.email, person.id]
    .some((value) => value.toLocaleLowerCase().includes(search))) : people;
}
