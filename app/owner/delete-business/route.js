import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const BUSINESS_ASSETS_BUCKET = "business-assets";

function getOwnedStoragePath(value, userId, businessId) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const marker = `/object/public/${BUSINESS_ASSETS_BUCKET}/`;
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;

    const path = decodeURIComponent(url.pathname.slice(index + marker.length));
    const [pathUserId, pathBusinessId] = path.split("/");
    return pathUserId === userId && pathBusinessId === businessId ? path : null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in to delete a business." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const businessId = typeof body?.businessId === "string" ? body.businessId.trim() : "";

  if (!businessId || body?.confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm business deletion." }, { status: 400 });
  }

  const { data: business, error: lookupError } = await supabase
    .from("businesses")
    .select("id, category, logo_url, cover_image_url")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (lookupError || !business) {
    return NextResponse.json({ error: "That business could not be found or is not owned by you." }, { status: 404 });
  }

  const mediaPaths = [business.logo_url, business.cover_image_url]
    .map((url) => getOwnedStoragePath(url, user.id, business.id))
    .filter(Boolean);

  if (mediaPaths.length) {
    const { error: storageError } = await supabase.storage
      .from(BUSINESS_ASSETS_BUCKET)
      .remove([...new Set(mediaPaths)]);

    if (storageError) {
      if (process.env.NODE_ENV !== "production") console.error("Business media cleanup failed", storageError.message);
      return NextResponse.json({ error: "Business media could not be cleaned up. The business was not deleted." }, { status: 500 });
    }
  }

  const { error: deleteError } = await supabase
    .from("businesses")
    .delete()
    .eq("id", business.id)
    .eq("owner_id", user.id);

  if (deleteError) {
    if (process.env.NODE_ENV !== "production") console.error("Business deletion failed", deleteError.message);
    return NextResponse.json({ error: "Unable to delete this business. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, category: business.category });
}
