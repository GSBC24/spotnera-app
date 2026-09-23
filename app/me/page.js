import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ProfileAccountView } from "@/components/profile-account-view";
import { SpotneraBottomNav } from "@/components/spotnera-bottom-nav";
import { HeaderLogout } from "@/components/header-logout";
import { createClient } from "@/utils/supabase/server";
import { parseTimedPreference, timedPreference } from "@/lib/notification-preferences.mjs";

const DEFAULT_NOTIFICATION_PREFERENCES = {
  saved_business_new_deals: false,
  saved_business_deal_starting_soon: false,
  saved_business_deal_ending_soon: false,
  starting_soon_minutes: null,
  ending_soon_minutes: null,
  weekly_deals_email: false,
  new_deal_email: false,
};

function getBoolean(formData, key) {
  return formData.get(key) === "on";
}

export default async function MePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=1&next=/me");

  const [
    { data: profile },
    { count: ownedBusinessCount },
    {
      data: savedNotificationPreferences,
      error: notificationPreferencesError,
    },
  ] = await Promise.all([
    supabase.from("profiles").select("username, first_name, last_name, city, country, phone, date_of_birth, gender, address, onboarding_completed").eq("id", user.id).maybeSingle(),
    supabase.from("businesses").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    supabase
      .from("notification_preferences")
      .select("saved_business_new_deals, saved_business_deal_starting_soon, saved_business_deal_ending_soon, starting_soon_minutes, ending_soon_minutes, weekly_deals_email, new_deal_email")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!profile?.onboarding_completed || !profile?.city || !profile?.country) redirect("/onboarding");

  async function saveNotificationPreferences(previousState, formData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Sign in to save notification preferences." };
    }

    const starting = parseTimedPreference(formData, "starting", null);
    const ending = parseTimedPreference(formData, "ending", null);
    if (!starting || !ending) {
      return { error: "Choose a valid lead time for each enabled deal alert." };
    }
    const preferences = {
      user_id: user.id,
      saved_business_new_deals: getBoolean(formData, "saved_business_new_deals"),
      ...starting,
      ...ending,
      weekly_deals_email: getBoolean(formData, "weekly_deals_email"),
      new_deal_email: getBoolean(formData, "new_deal_email"),
    };

    const { error } = await supabase
      .from("notification_preferences")
      .upsert(preferences, { onConflict: "user_id" });

    if (error) {
      return { error: "Unable to save notification preferences. Please try again." };
    }

    revalidatePath("/me");
    return { success: true, savedAt: new Date().toISOString() };
  }

  const notificationPreferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(savedNotificationPreferences ?? {}),
  };
  notificationPreferences.saved_business_deal_starting_soon =
    timedPreference(notificationPreferences, "starting") !== null;
  notificationPreferences.saved_business_deal_ending_soon =
    timedPreference(notificationPreferences, "ending") !== null;

  return <main className="spotnera-app-shell"><section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8"><header className="spotnera-surface z-20 flex items-center gap-3 rounded-[28px] px-4 py-3"><img src="/icons/logo.png" alt="Spotnera" className="spotnera-brand-mark shrink-0 object-contain" /><div><p className="spotnera-kicker text-white/55">Account</p><h1 className="mt-1 text-[1.35rem] font-semibold leading-tight sm:text-2xl">Me</h1></div><div className="relative ml-auto"><HeaderLogout /></div></header><ProfileAccountView profile={profile} userId={user.id} ownedBusinessCount={ownedBusinessCount ?? 0} notificationPreferences={notificationPreferences} notificationPreferencesLoadError={Boolean(notificationPreferencesError)} saveNotificationPreferences={saveNotificationPreferences} /><SpotneraBottomNav /></section></main>;
}
