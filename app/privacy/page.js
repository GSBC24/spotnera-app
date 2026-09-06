import Link from "next/link";
import { PrivacySettingsLink } from "@/components/privacy-settings-link";

const sections = [
  {
    title: "Who operates Spotnera",
    body: "Spotnera is operated by [LEGAL ENTITY NAME], organization number [ORGANIZATION NUMBER], business address [BUSINESS ADDRESS]. Complete these placeholders before public launch.",
  },
  {
    title: "Information Users Provide",
    body: "Users may provide account details, profile information, city/country, favorites, reviews, and business-owner listing information. Business owners may add public business contact details, addresses, images, social links, and promotions/deals.",
  },
  {
    title: "Authentication Providers",
    body: "Spotnera supports email/password authentication through Supabase and social sign-in with Google, Facebook, and Apple where configured. These providers process authentication data according to their own terms and privacy notices.",
  },
  {
    title: "Location And Business Information",
    body: "Spotnera stores business location coordinates and address information chosen by business owners. Public users browse businesses by city, country, map position, category, and live deals.",
  },
  {
    title: "Reviews And Favorites",
    body: "Reviews and favorites are connected to signed-in accounts so users can manage their own saved businesses and review content. Public business pages show review content without exposing private account details.",
  },
  {
    title: "Business Engagement Analytics",
    body: "Spotnera records anonymous first-party business engagement counters such as profile views, deal views, contact clicks, shares, and copied profile links. These events do not store customer names, emails, phone numbers, street addresses, IP addresses, auth tokens, or Supabase user IDs.",
  },
  {
    title: "Google Analytics",
    body: "Spotnera uses Google Analytics 4 only if the visitor consents to analytics. Analytics consent is optional and can be accepted, rejected, or withdrawn in Privacy settings.",
  },
  {
    title: "Mapbox",
    body: "Spotnera uses Mapbox for maps and business-owner address search. When maps or address search load, Mapbox may receive technical request information needed to provide those services, such as request metadata, approximate network location, searched address text, map style/tile requests, and the public Mapbox access token.",
  },
  {
    title: "Supabase",
    body: "Spotnera uses Supabase for authentication, session management, database storage, row-level security, profile data, business listings, deals, reviews, favorites, and first-party business engagement events.",
  },
  {
    title: "Purposes And Legal Bases",
    body: "Processing purposes include providing the service, authenticating accounts, securing accounts and data, publishing business profiles and deals, showing reviews/favorites, responding to requests, improving Spotnera, and complying with legal obligations. Legal bases may include contract, legitimate interests, consent, and legal obligation depending on the processing activity. Confirm final legal bases with counsel before launch.",
  },
  {
    title: "Cookies And Storage",
    body: "Necessary cookies and storage support authentication, security, PWA behavior, and saved privacy choices. Optional analytics storage is used only after consent. See the Cookie & Tracking Information page for more detail.",
  },
  {
    title: "Sharing And Processors",
    body: "Spotnera may share data with processors that help operate the service, including Supabase, Mapbox, authentication providers, hosting/infrastructure providers, and Google Analytics after analytics consent. Complete processor and data processing agreement details before launch.",
  },
  {
    title: "International Transfers",
    body: "Some providers may process data outside Norway/EEA. Appropriate safeguards, such as standard contractual clauses or other approved transfer mechanisms where applicable, should be reviewed and documented before launch.",
  },
  {
    title: "Retention And Security",
    body: "Spotnera should retain personal data only as long as needed for the purposes described here or required by law. Technical and organizational security measures should be documented before launch.",
  },
  {
    title: "Your GDPR Rights",
    body: "Depending on the situation, users may request access, rectification, erasure, restriction, objection, and portability. Users may withdraw analytics consent at any time. Requests should be sent to [PRIVACY CONTACT EMAIL].",
  },
  {
    title: "Complaint To Supervisory Authority",
    body: "Users in Norway may contact Datatilsynet. Users in other EEA countries may contact their local data protection authority.",
  },
  {
    title: "Children And Age",
    body: "Spotnera's final minimum-age and parental-consent approach must be confirmed before launch. Do not use this template as the final child privacy policy without legal review.",
  },
  {
    title: "Policy Updates",
    body: "Spotnera may update this policy when the service or processing changes. Material privacy changes may require renewed consent or additional notice.",
  },
  {
    title: "Contact",
    body: "Privacy requests and questions: [PRIVACY CONTACT EMAIL]. Legal entity: [LEGAL ENTITY NAME], [ORGANIZATION NUMBER], [BUSINESS ADDRESS].",
  },
];

export default function PrivacyPage() {
  return (
    <main className="spotnera-owner-shell min-h-screen px-4 py-6 sm:px-6">
      <section className="mx-auto grid w-full max-w-4xl gap-4">
        <header className="spotnera-card rounded-[30px] p-5 sm:p-7">
          <p className="spotnera-kicker text-zinc-500">Legal template</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Privacy Policy</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            This template reflects the current Spotnera implementation and must be reviewed by the owner/legal counsel before public launch.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/cookies" className="spotnera-secondary-action inline-flex min-h-10 items-center px-4 text-xs">
              Cookies
            </Link>
            <Link href="/terms" className="spotnera-secondary-action inline-flex min-h-10 items-center px-4 text-xs">
              Terms
            </Link>
            <PrivacySettingsLink className="spotnera-primary-action inline-flex min-h-10 items-center rounded-full px-4 text-xs" />
          </div>
        </header>

        {sections.map((section) => (
          <section key={section.title} className="spotnera-card rounded-[24px] p-5">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{section.body}</p>
          </section>
        ))}
      </section>
    </main>
  );
}
