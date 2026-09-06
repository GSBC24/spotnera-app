import { redirect } from "next/navigation";
import Link from "next/link";
import { ProfileAccountView } from "@/components/profile-account-view";
import { createClient } from "@/utils/supabase/server";

const navItems = [
  { href: "/", label: "Map", icon: "M12 3l7 4v12l-7-4-7 4V7l7-4zm0 2.2L7 8v8.8l5-2.8 5 2.8V8l-5-2.8z" },
  { href: "/?tab=pulse", label: "Pulse", icon: "M4 13h3l2-7 4 12 2-5h5v2h-3.6L13 22 9.2 10.5 8.5 15H4v-2z" },
  { href: "/?tab=saved", label: "Saved", icon: "M6 3h12v18l-6-3.8L6 21V3zm2 2v12.4l4-2.5 4 2.5V5H8z" },
  { href: "/me", label: "Me", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-7 2.1-7 5v1h14v-1c0-2.9-3-5-7-5z" },
];

function BottomNav() {
  return <nav className="fixed bottom-4 left-1/2 z-[85] grid w-[min(92vw,430px)] -translate-x-1/2 grid-cols-4 rounded-[28px] border border-white/14 bg-zinc-950/62 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl">{navItems.map((item) => <Link key={item.href} href={item.href} aria-label={item.label} className={`flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition ${item.label === "Me" ? "bg-white text-zinc-950 shadow-[0_10px_26px_rgba(255,255,255,0.18)]" : "text-white/56 hover:bg-white/10 hover:text-white"}`}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="currentColor" d={item.icon} /></svg><span>{item.label}</span></Link>)}</nav>;
}

export default async function MePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: profile }, { count: ownedBusinessCount }] = await Promise.all([
    supabase.from("profiles").select("username, first_name, last_name, city, country, phone, date_of_birth, gender, address, onboarding_completed").eq("id", user.id).maybeSingle(),
    supabase.from("businesses").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
  ]);

  if (!profile?.onboarding_completed || !profile?.city || !profile?.country) redirect("/onboarding");

  return <main className="spotnera-app-shell"><section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8"><header className="spotnera-surface z-20 flex items-center gap-3 rounded-[28px] px-4 py-3"><img src="/icons/spotnera-icon.svg" alt="Spotnera" className="spotnera-brand-mark shrink-0 object-cover" /><div><p className="spotnera-kicker text-white/55">Account</p><h1 className="mt-1 text-[1.35rem] font-semibold leading-tight sm:text-2xl">Me</h1></div></header><ProfileAccountView profile={profile} userId={user.id} ownedBusinessCount={ownedBusinessCount ?? 0} /><BottomNav /></section></main>;
}
