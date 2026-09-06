import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { SpotneraDashboard } from "@/components/spotnera-dashboard";
import { getLiveDeals } from "@/lib/deals";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

const BUSINESS_SELECT = `
  id,
  owner_id,
  name,
  category,
  country,
  description,
  city,
  address,
  phone,
  email,
  website_url,
  facebook_url,
  instagram_url,
  tiktok_url,
  snapchat_url,
  latitude,
  longitude,
  is_active
`;

const DEAL_SELECT = `
  id,
  business_id,
  title,
  description,
  promotion_type,
  status,
  is_active,
  starts_at,
  ends_at,
  businesses!inner (
    is_active
  )
`;

const REVIEW_SELECT = `
  id,
  business_id,
  user_id,
  rating,
  comment,
  created_at,
  updated_at
`;

export default async function Home({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const accountDeleted = resolvedSearchParams?.accountDeleted === "1";
  const initialSearchOpen = resolvedSearchParams?.search === "1";
  const initialAuthOpen = resolvedSearchParams?.auth === "1";
  const initialTab = initialSearchOpen
    ? "map"
    : ["map", "pulse", "saved"].includes(resolvedSearchParams?.tab)
    ? resolvedSearchParams.tab
    : "map";

  if (!hasSupabaseEnv()) {
    return (
      <main className="spotnera-auth-shell flex min-h-screen items-center justify-center px-6 py-12">
        <section className="spotnera-card w-full max-w-md rounded-[28px] p-8">
          <div className="flex items-center gap-3">
            <img src="/icons/logo.png" alt="Spotnera" className="spotnera-brand-mark object-contain" />
            <div>
              <p className="spotnera-kicker text-zinc-500">Spotnera</p>
              <p className="text-sm font-bold text-zinc-950">Live local discovery</p>
            </div>
          </div>
          <h1 className="mt-6 text-2xl font-semibold">
            Configure Supabase
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Add your Supabase project URL and anon key to{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-1 text-xs">
              .env.local
            </code>{" "}
            to enable Google login.
          </p>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let businesses = [];
  let supabaseBusinessCount = 0;
  let supabaseDealCount = 0;
  let queryErrors = [];

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, first_name, last_name, city, country, phone, date_of_birth, gender, address, onboarding_completed, onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle();

    profile = data;

    console.log("Profile city:", profile?.city ?? null);
    console.log("Profile data:", {
      username: profile?.username ?? null,
      city: profile?.city ?? null,
    });

    if (!profile?.onboarding_completed || !profile?.city || !profile?.country) {
      redirect("/onboarding");
    }

  }

  console.log("Supabase client context:", {
      urlHost: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
        : null,
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      client: "createServerClient from @supabase/ssr with anon key and auth cookies",
    });

  console.log(
      "Supabase businesses query:",
      {
        from: "businesses",
        select: BUSINESS_SELECT.replace(/\s+/g, " ").trim(),
        filters: {
          is_active: true,
          city: null,
          latitude: null,
          longitude: null,
        },
        order: "name ascending",
      },
  );

    const { data: businessRows, error: businessesError } = await supabase
      .from("businesses")
      .select(BUSINESS_SELECT)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (businessesError) {
      queryErrors.push({
        query: "businesses",
        message: businessesError.message,
        code: businessesError.code,
        details: businessesError.details,
        hint: businessesError.hint,
      });
      if (process.env.NODE_ENV !== "production") {
        console.error("Supabase businesses query failed", businessesError.message);
      }
    }

  console.log(
      "Supabase deals query:",
      {
        from: "deals",
        select: DEAL_SELECT.replace(/\s+/g, " ").trim(),
        filters: {
          is_active: true,
          live_window: true,
          businesses_is_active: true,
          city: null,
          latitude: null,
          longitude: null,
        },
        order: "created_at descending",
      },
  );

  const now = new Date();
    const { data: dealRows, error: dealsError } = await supabase
      .from("deals")
      .select(DEAL_SELECT)
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now.toISOString()}`)
      .or(`ends_at.is.null,ends_at.gt.${now.toISOString()}`)
      .eq("businesses.is_active", true)
      .order("created_at", { ascending: false });

    if (dealsError) {
      queryErrors.push({
        query: "deals",
        message: dealsError.message,
        code: dealsError.code,
        details: dealsError.details,
        hint: dealsError.hint,
      });
      if (process.env.NODE_ENV !== "production") {
        console.error("Supabase deals query failed", dealsError.message);
      }
    }

    supabaseBusinessCount = businessRows?.length ?? 0;
    const liveDealRows = getLiveDeals(dealRows ?? [], now);

    supabaseDealCount = liveDealRows.length;

    console.log(
      `Supabase returned ${supabaseBusinessCount} active businesses`,
    );
    console.log(`Supabase returned ${supabaseDealCount} active deals`);
    console.log("Supabase business rows:", businessRows ?? []);
    console.log("Supabase deal rows:", liveDealRows);
    console.log(
      "Supabase active business rows:",
      (businessRows ?? []).map(({ id, name, city, latitude, longitude }) => ({
        id,
        name,
        city,
        latitude,
        longitude,
      })),
    );

    const businessIds = (businessRows ?? []).map((business) => business.id);
    let reviewRows = [];
    let favoriteRows = [];

    if (businessIds.length) {
      console.log(
        "Supabase reviews query:",
        {
          from: "reviews",
          select: REVIEW_SELECT.replace(/\s+/g, " ").trim(),
          filters: {
            business_id: businessIds,
          },
          order: "created_at descending",
        },
      );

      const { data: reviews, error: reviewsError } = await supabase
        .from("reviews")
        .select(REVIEW_SELECT)
        .in("business_id", businessIds)
        .order("created_at", { ascending: false });

      if (reviewsError) {
        queryErrors.push({
          query: "reviews",
          message: reviewsError.message,
          code: reviewsError.code,
          details: reviewsError.details,
          hint: reviewsError.hint,
        });
        console.error("Supabase reviews query failed", reviewsError);
      }

      reviewRows = reviews ?? [];

      console.log(
        "Supabase favorites query:",
        {
          from: "favorites",
          select: "business_id",
          filters: {
            user_id: user?.id ?? null,
            business_id: businessIds,
          },
        },
      );

      const { data: favorites, error: favoritesError } = user
        ? await supabase
            .from("favorites")
            .select("business_id")
            .eq("user_id", user.id)
            .in("business_id", businessIds)
        : { data: [], error: null };

      if (favoritesError) {
        queryErrors.push({
          query: "favorites",
          message: favoritesError.message,
          code: favoritesError.code,
          details: favoritesError.details,
          hint: favoritesError.hint,
        });
        console.error("Supabase favorites query failed", favoritesError);
      }

      favoriteRows = favorites ?? [];
    }

    const dealsByBusinessId = new Map();
    for (const deal of liveDealRows) {
      const businessDeals = dealsByBusinessId.get(deal.business_id) ?? [];
      businessDeals.push({
        id: deal.id,
        title: deal.title,
        description: deal.description,
        promotion_type: deal.promotion_type,
        status: deal.status,
        is_active: deal.is_active,
        starts_at: deal.starts_at,
        ends_at: deal.ends_at,
      });
      dealsByBusinessId.set(deal.business_id, businessDeals);
    }

    const reviewsByBusinessId = new Map();
    for (const review of reviewRows) {
      const businessReviews = reviewsByBusinessId.get(review.business_id) ?? [];
      businessReviews.push({
        id: review.id,
        user_id: user ? review.user_id : null,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        updated_at: review.updated_at,
      });
      reviewsByBusinessId.set(review.business_id, businessReviews);
    }

    const favoriteBusinessIds = new Set(
      favoriteRows.map((favorite) => favorite.business_id),
    );

    businesses = (businessRows ?? []).map((business) => ({
      ...business,
      deals: dealsByBusinessId.get(business.id) ?? [],
      reviews: reviewsByBusinessId.get(business.id) ?? [],
      isFavorite: favoriteBusinessIds.has(business.id),
    }));

  if (!user) {
    return (
      <SpotneraDashboard
        businesses={businesses}
        profile={null}
        userId={null}
        userEmail={null}
        supabaseBusinessCount={supabaseBusinessCount}
        supabaseDealCount={supabaseDealCount}
        queryErrors={queryErrors}
        initialTab={initialTab}
        initialSearchOpen={initialSearchOpen}
        initialAuthOpen={initialAuthOpen}
      />
    );
  }

  return (
    <>
      {user ? (
        <SpotneraDashboard
          businesses={businesses}
          profile={profile}
          userId={user.id}
          userEmail={user.email}
          supabaseBusinessCount={supabaseBusinessCount}
          supabaseDealCount={supabaseDealCount}
          queryErrors={queryErrors}
          initialTab={initialTab}
          initialSearchOpen={initialSearchOpen}
        />
      ) : (
        <main className="spotnera-auth-shell px-5 py-6 sm:px-8">
          <section className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="hidden lg:block">
              <div className="max-w-xl">
                <div className="flex items-center gap-3">
                  <img src="/icons/logo.png" alt="Spotnera" className="spotnera-brand-mark object-contain" />
                  <div>
                    <p className="spotnera-kicker text-zinc-500">Spotnera</p>
                    <p className="text-sm font-bold text-zinc-950">Live local discovery</p>
                  </div>
                </div>
                <h1 className="mt-8 max-w-lg text-6xl font-semibold leading-[0.98]">
                  Discover what is happening around you.
                </h1>
                <p className="mt-5 max-w-md text-lg leading-8 text-zinc-600">
                  Live deals, local businesses, restaurants and cafes in one premium map-first experience.
                </p>
                <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
                  {["Live deals", "Local maps", "Business profiles"].map((item) => (
                    <div
                      key={item}
                      className="spotnera-card rounded-[22px] px-4 py-3 text-sm font-bold text-zinc-800"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="spotnera-card mx-auto w-full max-w-md rounded-[30px] p-5 sm:p-7">
              <div className="mb-6 lg:hidden">
                <div className="flex items-center gap-3">
                  <img src="/icons/logo.png" alt="Spotnera" className="spotnera-brand-mark object-contain" />
                  <div>
                    <p className="spotnera-kicker text-zinc-500">Spotnera</p>
                    <p className="text-sm font-bold text-zinc-950">Live local discovery</p>
                  </div>
                </div>
              </div>
              <p className="spotnera-kicker text-zinc-500">Live local discovery</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight">
                Sign in to Spotnera
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Discover live deals around you and keep your local profile in sync.
              </p>
              {accountDeleted ? (
                <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Your Spotnera account has been deleted.
                </p>
              ) : null}
              <div className="mt-6">
                <AuthPanel />
              </div>
            </div>
          </section>
        </main>
      )}
    </>
  );
}
