const PAGE_SIZE = 1000;

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
    const result = await admin.from("businesses").select("id, name, owner_id")
      .in("owner_id", ownerIds).order("id").range(offset, offset + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    businesses.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < PAGE_SIZE) break;
  }
  return businesses;
}

export async function getAdminUserDetails(admin, userId) {
  if (!userId) return null;
  const [authResult, profileResult, businesses, membershipResult] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("id, username, full_name, first_name, last_name, phone, created_at").eq("id", userId).maybeSingle(),
    loadOwnedBusinesses(admin, [userId]),
    admin.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  for (const result of [authResult, profileResult, membershipResult]) {
    if (result.error) throw result.error;
  }
  if (!authResult.data?.user) return null;
  return adminPerson(authResult.data.user, profileResult.data,
    businesses.sort((a, b) => a.name.localeCompare(b.name)), Boolean(membershipResult.data));
}

export async function listAdminUsers(admin, query = "") {
  const authResult = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (authResult.error) throw authResult.error;
  const users = authResult.data?.users ?? [];
  if (!users.length) return [];
  const ids = users.map((user) => user.id);
  const [profilesResult, adminsResult] = await Promise.all([
    admin.from("profiles").select("id, username, full_name, first_name, last_name, phone, created_at").in("id", ids),
    admin.from("platform_admins").select("user_id").in("user_id", ids),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (adminsResult.error) throw adminsResult.error;
  const businesses = await loadOwnedBusinesses(admin, ids);
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const adminIds = new Set((adminsResult.data ?? []).map((member) => member.user_id));
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
