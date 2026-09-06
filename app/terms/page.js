import Link from "next/link";
import {
  getSoleProprietorshipSentence,
  legalConfig,
} from "@/lib/legal-config";

function getSections() {
  return [
  [
    "Contractual Operator",
    [
      `These Terms govern the use of Spotnera, a service operated by ${legalConfig.legalEntityName} in ${legalConfig.country || "Norway"}.`,
      getSoleProprietorshipSentence(),
      legalConfig.organizationNumber
        ? `Organization number: ${legalConfig.organizationNumber}.`
        : null,
    ].filter(Boolean).join(" "),
  ],
  ["Service Description", "Spotnera helps users discover local businesses, public business profiles, reviews, favorites, maps, and live/scheduled/expired/disabled promotions or deals."],
  ["User Accounts", "Users are responsible for keeping account credentials secure and for the activity that occurs through their account."],
  ["Business-Owner Accounts", "Business owners may create and manage business listings, public contact details, images, and promotions. Owners are responsible for having the rights and authority to publish this information."],
  ["Acceptable Use", "Users must not misuse Spotnera, attempt unauthorized access, interfere with security, submit unlawful content, or use the service in a way that harms other users, businesses, or Spotnera."],
  ["Business Listings And Promotions", "Business information, promotions, availability, and deal timing are provided by business owners. Owners must keep listings accurate and update expired or changed offers."],
  ["Reviews And User Content", "Users are responsible for reviews and other content they submit. Spotnera may remove content that is unlawful, misleading, abusive, spam, infringes rights, or violates these terms."],
  ["Prohibited Content", "Do not submit content that is illegal, discriminatory, harassing, deceptive, infringing, malicious, or contains private information about others without permission."],
  ["Intellectual Property", "Spotnera and its product design, branding, software, and content are protected by intellectual property rights. Users retain rights to their own submitted content but grant Spotnera permission to host, display, and operate it as part of the service."],
  ["Third-Party Services And Links", "Spotnera integrates or links to third-party services such as Supabase, Mapbox, Google, Facebook, Apple, business websites, and social profiles. Third-party services have their own terms and privacy notices."],
  ["Service Availability", "Spotnera may change, interrupt, suspend, or discontinue parts of the service. The product may contain beta or launch-stage functionality."],
  ["Suspension And Removal", "Spotnera may suspend accounts, remove listings, remove content, or restrict access where necessary to protect the service, users, businesses, legal compliance, or security."],
  ["Disclaimers And Limitations", "This template requires legal review. Final warranty disclaimers, consumer-law language, and limitation-of-liability wording must be completed for the operating legal entity and applicable law before launch."],
  ["Changes To Service Or Terms", "Spotnera may update the service or these terms. Material changes should be communicated appropriately."],
  ["Termination", "Users may stop using Spotnera. Account deletion and data deletion workflows must be confirmed before public launch."],
  ["Governing Law", "Governing law and venue must be confirmed before public launch."],
  [
    "Contact",
    [
      `Legal entity: ${legalConfig.legalEntityName}.`,
      legalConfig.organizationNumber
        ? `Organization number: ${legalConfig.organizationNumber}.`
        : null,
      legalConfig.country ? `Country: ${legalConfig.country}.` : null,
      legalConfig.legalContactEmail
        ? `Legal contact: ${legalConfig.legalContactEmail}.`
        : "Configure NEXT_PUBLIC_LEGAL_CONTACT_EMAIL before public launch.",
    ].filter(Boolean).join(" "),
  ],
  ];
}

export default function TermsPage() {
  const sections = getSections();

  return (
    <main className="spotnera-owner-shell min-h-screen px-4 py-6 sm:px-6">
      <section className="mx-auto grid w-full max-w-4xl gap-4">
        <header className="spotnera-card rounded-[30px] p-5 sm:p-7">
          <p className="spotnera-kicker text-zinc-500">Legal template</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Terms of Service</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            These Terms govern the use of Spotnera, a service operated by {legalConfig.legalEntityName} in {legalConfig.country || "Norway"}. Launch-ready template only; obtain legal review before public launch.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/privacy" className="spotnera-secondary-action inline-flex min-h-10 items-center px-4 text-xs">
              Privacy
            </Link>
            <Link href="/cookies" className="spotnera-secondary-action inline-flex min-h-10 items-center px-4 text-xs">
              Cookies
            </Link>
          </div>
        </header>

        {sections.map(([title, body]) => (
          <section key={title} className="spotnera-card rounded-[24px] p-5">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
          </section>
        ))}
      </section>
    </main>
  );
}
