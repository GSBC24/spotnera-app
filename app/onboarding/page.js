import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

function isCompleteProfile(profile) {
  return Boolean(
    profile?.username &&
      profile?.city &&
      Array.isArray(profile?.interests) &&
      profile.interests.length >= 3,
  );
}

export default async function OnboardingPage() {
  if (!hasSupabaseEnv()) {
    redirect("/");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, city, interests")
    .eq("id", user.id)
    .maybeSingle();

  if (isCompleteProfile(profile)) {
    redirect("/");
  }

  async function saveProfile(previousState, formData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/");
    }

    const username = String(formData.get("username") ?? "")
      .trim()
      .replace(/^@+/, "");
    const city = String(formData.get("city") ?? "").trim();
    const interests = formData
      .getAll("interests")
      .map((interest) => String(interest).trim())
      .filter(Boolean);

    if (username.length < 3 || username.length > 24) {
      return { error: "Choose a username between 3 and 24 characters." };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { error: "Use only letters, numbers, and underscores." };
    }

    if (!city) {
      return { error: "Add your city so Spotnera can tune recommendations." };
    }

    if (interests.length < 3) {
      return { error: "Pick at least three interests." };
    }

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        username,
        city,
        interests,
        email: user.email,
        full_name: user.user_metadata?.full_name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) {
      if (error.code === "23505") {
        return { error: "That username is already taken." };
      }

      return { error: error.message };
    }

    redirect("/");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f4ef] text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-6 pt-8 sm:px-8">
        <header className="flex items-center justify-between">
          <p className="text-sm font-bold tracking-tight">Spotnera</p>
          <div className="rounded-full border border-zinc-200/80 bg-white/70 px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm backdrop-blur">
            Step 1 of 1
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-end py-8">
          <div className="mb-8">
            <div className="mb-5 flex gap-2">
              <span className="h-1.5 flex-1 rounded-full bg-zinc-950" />
              <span className="h-1.5 flex-1 rounded-full bg-zinc-300" />
              <span className="h-1.5 flex-1 rounded-full bg-zinc-300" />
            </div>
            <p className="text-sm font-semibold text-zinc-500">
              Welcome{user.user_metadata?.given_name ? `, ${user.user_metadata.given_name}` : ""}
            </p>
            <h1 className="mt-3 max-w-sm text-4xl font-semibold leading-[1.02] tracking-tight text-zinc-950">
              Shape your local discovery feed.
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-zinc-600">
              Set your public profile and the signals Spotnera should use for
              places, events, and experiences near you.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/72 p-4 shadow-[0_24px_80px_rgba(39,39,42,0.14)] backdrop-blur-xl sm:p-5">
            <OnboardingForm action={saveProfile} defaultValues={profile} />
          </div>
        </section>
      </div>
    </main>
  );
}
