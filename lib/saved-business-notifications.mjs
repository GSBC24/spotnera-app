export async function saveBusinessDealNotificationPreference(
  supabase,
  { businessId, userId, enabled },
) {
  const { data, error } = await supabase
    .from("favorites")
    .update({ deal_notifications_enabled: enabled })
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .select("business_id, deal_notifications_enabled");

  if (error || data?.length !== 1 || data[0].business_id !== businessId ||
      data[0].deal_notifications_enabled !== enabled) {
    throw new Error("Unable to save deal notification setting.");
  }
  return enabled;
}
