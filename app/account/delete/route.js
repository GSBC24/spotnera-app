import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

const BUSINESS_ASSETS_BUCKET = "business-assets";

function getStoragePathFromPublicUrl(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const marker = `/object/public/${BUSINESS_ASSETS_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

function getOwnedMediaPaths(userId, businesses) {
  const ownedBusinessIds = new Set(businesses.map((business) => business.id));
  const paths = new Set();

  for (const business of businesses) {
    for (const url of [business.logo_url, business.cover_image_url]) {
      const path = getStoragePathFromPublicUrl(url);

      if (!path) {
        continue;
      }

      const [pathUserId, pathBusinessId] = path.split("/");

      if (pathUserId === userId && ownedBusinessIds.has(pathBusinessId)) {
        paths.add(path);
      }
    }
  }

  return [...paths];
}

async function deleteByFilter(query, label) {
  const { error } = await query;

  if (error) {
    throw new Error(`${label} cleanup failed.`);
  }
}

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in to delete your account." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  if (body?.confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm account deletion." }, { status: 400 });
  }

  let admin;

  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Account deletion is not configured yet. Contact Spotnera support." },
      { status: 500 },
    );
  }

  const { data: ownedBusinesses, error: businessesError } = await admin
    .from("businesses")
    .select("id, logo_url, cover_image_url")
    .eq("owner_id", user.id);

  if (businessesError) {
    return NextResponse.json({ error: "Unable to prepare account deletion." }, { status: 500 });
  }

  const mediaPaths = getOwnedMediaPaths(user.id, ownedBusinesses ?? []);

  try {
    if (mediaPaths.length) {
      const { error: storageError } = await admin.storage
        .from(BUSINESS_ASSETS_BUCKET)
        .remove(mediaPaths);

      if (storageError) {
        throw new Error("Business media cleanup failed.");
      }
    }

    await deleteByFilter(
      admin.from("favorites").delete().eq("user_id", user.id),
      "Favorites",
    );
    await deleteByFilter(
      admin.from("reviews").delete().eq("user_id", user.id),
      "Reviews",
    );
    await deleteByFilter(
      admin.from("businesses").delete().eq("owner_id", user.id),
      "Owned businesses",
    );
    await deleteByFilter(
      admin.from("profiles").delete().eq("id", user.id),
      "Profile",
    );

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);

    if (authDeleteError) {
      throw new Error("Auth account deletion failed.");
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Account deletion failed", {
        userId: user.id,
        message: error.message,
      });
    }

    return NextResponse.json(
      { error: "Account deletion failed before completion. Your account may still be active. Try again or contact support." },
      { status: 500 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    deletedOwnedBusinessCount: ownedBusinesses?.length ?? 0,
  });

  response.cookies.delete("sb-access-token");
  response.cookies.delete("sb-refresh-token");

  return response;
}
