import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

const PROFILE_COUNTRIES = [
  "Norway",
  "Sweden",
  "Denmark",
  "Finland",
  "Iceland",
  "United Kingdom",
  "Ireland",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Belgium",
  "Switzerland",
  "Austria",
  "Poland",
  "Portugal",
  "Greece",
  "United States",
  "Canada",
  "Australia",
  "New Zealand",
  "Japan",
  "South Korea",
  "Singapore",
  "India",
  "Brazil",
  "Mexico",
  "South Africa",
  "Other",
];

function isCompleteProfile(profile) {
  return Boolean(profile?.onboarding_completed && profile?.city && profile?.country);
}

function getString(formData, key) {
  return String(formData.get(key) ?? "").trim();
}

function getNullableString(formData, key) {
  const value = getString(formData, key);
  return value || null;
}

function normalizePhone(value) {
  const phone = String(value ?? "").trim().replace(/\s+/g, " ");

  if (!phone) {
    return { value: null };
  }

  if (!/^\+?[0-9][0-9\s().-]{5,24}$/.test(phone)) {
    return { error: "Enter a valid phone number." };
  }

  return { value: phone };
}

function getProviderNames(user) {
  const metadata = user.user_metadata ?? {};
  const fullName = String(metadata.full_name ?? metadata.name ?? "").trim();
  const [firstFromFullName, ...lastFromFullName] = fullName.split(/\s+/);

  return {
    firstName: metadata.given_name ?? metadata.first_name ?? firstFromFullName ?? "",
    lastName: metadata.family_name ?? metadata.last_name ?? lastFromFullName.join(" "),
  };
}

function buildUsername(user, firstName, lastName) {
  const base =
    `${firstName}_${lastName}` ||
    user.email?.split("@")[0] ||
    `user_${user.id.slice(0, 8)}`;
  const normalized = base
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 16);

  return `${normalized || "spotnera"}_${user.id.slice(0, 6)}`.slice(0, 24);
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
    .select("username, first_name, last_name, phone, date_of_birth, gender, address, city, country, onboarding_completed, onboarding_completed_at")
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

    const firstName = getString(formData, "first_name");
    const lastName = getString(formData, "last_name");
    const country = getString(formData, "country");
    const city = getString(formData, "city");
    const phone = normalizePhone(formData.get("phone"));
    const dateOfBirth = getNullableString(formData, "date_of_birth");
    const gender = getNullableString(formData, "gender") ?? "Prefer not to say";
    const address = getNullableString(formData, "address");

    if (!firstName || !lastName || !country || !city) {
      return { error: "First name, last name, country, and city are required." };
    }

    if (!PROFILE_COUNTRIES.includes(country)) {
      return { error: "Choose a valid country." };
    }

    if (phone.error) {
      return { error: phone.error };
    }

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        username: buildUsername(user, firstName, lastName),
        first_name: firstName,
        last_name: lastName,
        phone: phone.value,
        date_of_birth: dateOfBirth,
        gender,
        address,
        city,
        country,
        email: user.email,
        full_name: user.user_metadata?.full_name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) {
      console.error("Profile onboarding save failed", error);
      return { error: "Unable to save profile. Try again." };
    }

    redirect("/");
  }

  const providerNames = getProviderNames(user);
  const defaultValues = {
    ...profile,
    first_name: profile?.first_name ?? providerNames.firstName,
    last_name: profile?.last_name ?? providerNames.lastName,
  };

  return (
    <main className="spotnera-auth-shell overflow-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 pb-6 pt-8 sm:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icons/spotnera-icon.svg" alt="Spotnera" className="spotnera-brand-mark object-cover" />
            <div>
              <p className="spotnera-kicker text-zinc-500">Spotnera</p>
              <p className="text-sm font-bold text-zinc-950">Live local discovery</p>
            </div>
          </div>
          <div className="rounded-full border border-zinc-200/80 bg-white/70 px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm backdrop-blur">
            Step 1 of 1
          </div>
        </header>

        <section className="grid flex-1 items-end gap-8 py-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div className="mb-2 lg:mb-0">
            <div className="mb-5 flex gap-2">
              <span className="h-1.5 flex-1 rounded-full bg-zinc-950" />
              <span className="h-1.5 flex-1 rounded-full bg-zinc-300" />
              <span className="h-1.5 flex-1 rounded-full bg-zinc-300" />
            </div>
            <p className="text-sm font-semibold text-zinc-500">
              Welcome{providerNames.firstName ? `, ${providerNames.firstName}` : ""}
            </p>
            <h1 className="mt-3 max-w-sm text-4xl font-semibold leading-[1.02] text-zinc-950 sm:text-5xl">
              Finish your local profile.
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-zinc-600">
              Set the private profile details Spotnera uses for your local dashboard.
            </p>
          </div>

          <div className="spotnera-card rounded-[30px] p-4 sm:p-5">
            <OnboardingForm
              action={saveProfile}
              defaultValues={defaultValues}
              countries={PROFILE_COUNTRIES}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
