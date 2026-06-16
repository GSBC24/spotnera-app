import { redirect } from "next/navigation";
import { GoogleLoginButton } from "@/components/google-login-button";
import { SpotneraDashboard } from "@/components/spotnera-dashboard";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

const BUSINESS_SELECT = `
  id,
  name,
  category,
  description,
  city,
  address,
  latitude,
  longitude
`;

const DEAL_SELECT = `
  id,
  business_id,
  title,
  description,
  status,
  starts_at,
  ends_at,
  businesses!inner (
    is_active
  )
`;

export default async function Home() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 py-12 text-zinc-950">
        <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Spotnera</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
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
      .select("username, city, interests")
      .eq("id", user.id)
      .maybeSingle();

    profile = data;

    console.log("Profile city:", profile?.city ?? null);
    console.log("Profile data:", {
      username: profile?.username ?? null,
      city: profile?.city ?? null,
      interests: profile?.interests ?? null,
    });

    if (
      !profile?.username ||
      !profile?.city ||
      !Array.isArray(profile?.interests) ||
      profile.interests.length < 3
    ) {
      redirect("/onboarding");
    }

    console.log("Supabase client context:", {
      urlHost: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
        : null,
      userId: user.id,
      userEmail: user.email,
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
      console.error("Supabase businesses query failed", businessesError);
    }

    console.log(
      "Supabase deals query:",
      {
        from: "deals",
        select: DEAL_SELECT.replace(/\s+/g, " ").trim(),
        filters: {
          status: "active",
          businesses_is_active: true,
          city: null,
          latitude: null,
          longitude: null,
        },
        order: "created_at descending",
      },
    );

    const { data: dealRows, error: dealsError } = await supabase
      .from("deals")
      .select(DEAL_SELECT)
      .eq("status", "active")
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
      console.error("Supabase deals query failed", dealsError);
    }

    supabaseBusinessCount = businessRows?.length ?? 0;
    supabaseDealCount = dealRows?.length ?? 0;

    console.log(
      `Supabase returned ${supabaseBusinessCount} active businesses`,
    );
    console.log(`Supabase returned ${supabaseDealCount} active deals`);
    console.log("Supabase business rows:", businessRows ?? []);
    console.log("Supabase deal rows:", dealRows ?? []);
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

    const dealsByBusinessId = new Map();
    for (const deal of dealRows ?? []) {
      const businessDeals = dealsByBusinessId.get(deal.business_id) ?? [];
      businessDeals.push({
        id: deal.id,
        title: deal.title,
        description: deal.description,
        status: deal.status,
        starts_at: deal.starts_at,
        ends_at: deal.ends_at,
      });
      dealsByBusinessId.set(deal.business_id, businessDeals);
    }

    businesses = (businessRows ?? []).map((business) => ({
      ...business,
      deals: dealsByBusinessId.get(business.id) ?? [],
    }));
  }

  return (
    <>
      {user ? (
        <SpotneraDashboard
          businesses={businesses}
          profile={profile}
          userEmail={user.email}
          supabaseBusinessCount={supabaseBusinessCount}
          supabaseDealCount={supabaseDealCount}
          queryErrors={queryErrors}
        />
      ) : (
        <main className="flex min-h-screen items-center justify-center bg-[#f7f4ef] px-5 py-8 text-zinc-950">
          <section className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-[0_24px_80px_rgba(39,39,42,0.14)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-semibold text-zinc-500">Spotnera</p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">
                Sign in to continue
              </h1>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Use Google to create your profile and personalize local
                recommendations.
              </p>
            </div>
            <GoogleLoginButton />
          </div>
          </section>
        </main>
      )}
    </>
  );
}
