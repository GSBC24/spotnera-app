import Link from "next/link";
import { redirect } from "next/navigation";
import { legalConfig } from "@/lib/legal-config";
import { getPremiumContactEmail } from "@/lib/premium-contact.mjs";
import { PremiumContactActions } from "@/components/premium-contact-actions";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

const benefits = [
  ["Advanced Analytics", "Deeper insight into how people discover and engage with your businesses."],
  ["Customer Segmentation", "Understand different audiences and what matters to them."],
  ["Multiple Locations / Branch Management", "Manage branches together when your business grows."],
  ["Advanced Deal Scheduling & Automation", "Plan promotions with more flexible timing tools."],
  ["Advanced Promotion Tools", "More ways to reach your local audience."],
];

export default async function OwnerPremiumPage() {
  if (!hasSupabaseEnv()) redirect("/");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=1&next=/owner/premium");

  const contactEmail = getPremiumContactEmail(
    process.env.NEXT_PUBLIC_SPOTNERA_CONTACT_EMAIL,
    legalConfig.legalContactEmail,
  );

  return (
    <main className="spotnera-owner-shell min-h-screen px-4 py-6 text-white sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <Link href="/owner?section=businesses" className="text-sm font-semibold text-white/65 hover:text-white">← Back to businesses</Link>
        <header className="spotnera-card mt-5 overflow-hidden rounded-[32px] border border-amber-300/20 p-6 sm:p-10">
          <p className="spotnera-kicker text-amber-200">Coming soon</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Spotnera™ Premium</h1>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-white/75">More tools to understand, reach and grow your local audience.</p>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">Premium is being prepared. These capabilities are planned and are not available yet.</p>
        </header>

        <section className="mt-5" aria-labelledby="premium-benefits">
          <h2 id="premium-benefits" className="text-xl font-semibold">What we&apos;re planning</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {benefits.map(([title, description]) => (
              <article key={title} className="spotnera-card rounded-[24px] border border-white/10 p-5">
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="spotnera-card mt-5 rounded-[28px] border border-amber-300/20 p-6">
          <h2 className="text-xl font-semibold">Interested in Premium?</h2>
          <p className="mt-2 text-sm text-white/65">Get in touch with Spotnera about your business needs.</p>
          {contactEmail ? (
            <PremiumContactActions email={contactEmail} />
          ) : (
            <>
              <a href="/terms#contact" className="spotnera-primary-action mt-4 inline-flex min-h-11 items-center justify-center px-5 text-sm">Contact Spotnera</a>
              <p className="mt-3 text-xs text-white/50">Contact email is being set up. See our contact information in the Terms of Service.</p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
