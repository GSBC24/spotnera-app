export async function compensateFailedOpeningHoursCreate(supabase, { businessId, userId, uploadedPaths }) {
  let deletion;
  try {
    deletion = await supabase.from("businesses")
      .delete()
      .eq("id", businessId)
      .eq("owner_id", userId)
      .select("id");
  } catch (error) {
    return { outcome: "deletion_unconfirmed", error };
  }

  if (!deletion || deletion.error || deletion.data?.length !== 1 || deletion.data[0].id !== businessId) {
    return { outcome: "deletion_unconfirmed", error: deletion?.error ?? null };
  }

  if (uploadedPaths.length) {
    try {
      const { error } = await supabase.storage.from("business-assets").remove(uploadedPaths);
      if (error) return { outcome: "deleted_images_remain", error };
    } catch (error) {
      return { outcome: "deleted_images_remain", error };
    }
  }

  return { outcome: "deleted" };
}
