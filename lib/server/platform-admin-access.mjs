export async function checkPlatformAdminAccess(user, lookupMembership) {
  if (!user) return 401;
  const { data, error } = await lookupMembership(user.id);
  if (error) throw new Error("Admin authorization could not be checked.");
  return data ? 200 : 403;
}
