import { redirect } from "next/navigation";
import { ProfileAccountView } from "@/components/profile-account-view";
import { SpotneraBottomNav } from "@/components/spotnera-bottom-nav";
import { createClient } from "@/utils/supabase/server";

export default async function MePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: profile }, { count: ownedBusinessCount }] = await Promise.all([
    supabase.from("profiles").select("username, first_name, last_name, city, country, phone, date_of_birth, gender, address, onboarding_completed").eq("id", user.id).maybeSingle(),
    supabase.from("businesses").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
  ]);

  if (!profile?.onboarding_completed || !profile?.city || !profile?.country) redirect("/onboarding");

  return <main className="spotnera-app-shell"><section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8"><header className="spotnera-surface z-20 flex items-center gap-3 rounded-[28px] px-4 py-3"><img src="/icons/spotnera-icon.svg" alt="Spotnera" className="spotnera-brand-mark shrink-0 object-cover" /><div><p className="spotnera-kicker text-white/55">Account</p><h1 className="mt-1 text-[1.35rem] font-semibold leading-tight sm:text-2xl">Me</h1></div></header><ProfileAccountView profile={profile} userId={user.id} ownedBusinessCount={ownedBusinessCount ?? 0} /><SpotneraBottomNav /></section></main>;
}
