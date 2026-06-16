import { redirect } from "next/navigation";
import { GoogleLoginButton } from "@/components/google-login-button";
import { SpotneraDashboard } from "@/components/spotnera-dashboard";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

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

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, city, interests")
      .eq("id", user.id)
      .maybeSingle();

    profile = data;

    if (
      !profile?.username ||
      !profile?.city ||
      !Array.isArray(profile?.interests) ||
      profile.interests.length < 3
    ) {
      redirect("/onboarding");
    }

    const { data: businessRows, error: businessesError } = await supabase
      .from("businesses")
      .select(
        `
          id,
          name,
          category,
          description,
          city,
          address,
          latitude,
          longitude
        `,
      )
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (businessesError) {
      console.error("Supabase businesses query failed", businessesError);
    }

    const { data: dealRows, error: dealsError } = await supabase
      .from("deals")
      .select(
        `
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
        `,
      )
      .eq("status", "active")
      .eq("businesses.is_active", true)
      .order("created_at", { ascending: false });

    if (dealsError) {
      console.error("Supabase deals query failed", dealsError);
    }

    console.log(
      `Supabase returned ${businessRows?.length ?? 0} active businesses`,
    );
    console.log(`Supabase returned ${dealRows?.length ?? 0} active deals`);

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
