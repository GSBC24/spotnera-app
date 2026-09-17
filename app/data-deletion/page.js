import Link from "next/link";
import Image from "next/image";
import { legalConfig } from "@/lib/legal-config";

export const metadata = {
  title: "User Data Deletion | Spotnera",
  description: "Instructions for permanently deleting a Spotnera account and associated data.",
};

const deletionSteps = [
  "Sign in to Spotnera.",
  "Open Me.",
  "Select the permanent account deletion option.",
  "Review the deletion warning.",
  "Type DELETE when requested.",
  "Confirm permanent deletion.",
];

export default function DataDeletionPage() {
  return (
    <main className="spotnera-owner-shell min-h-screen px-4 py-6 sm:px-6">
      <section className="mx-auto grid w-full max-w-4xl gap-4">
        <header className="spotnera-card rounded-[30px] p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <Image
              src="/icons/logo.png"
              alt="Spotnera"
              width={40}
              height={40}
              className="spotnera-brand-mark object-contain"
            />
            <div>
              <p className="spotnera-kicker text-zinc-500">Spotnera account help</p>
              <p className="text-sm font-bold text-zinc-950">Privacy and account control</p>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-normal sm:text-4xl">
            User Data Deletion
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
            You can permanently delete your Spotnera account and the associated data described below from within Spotnera. Account deletion cannot be undone.
          </p>
        </header>

        <section className="spotnera-card rounded-[30px] p-5 sm:p-7">
          <p className="spotnera-kicker text-zinc-500">How to delete your account</p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
            Complete these steps in Spotnera
          </h2>
          <ol className="mt-5 grid gap-3">
            {deletionSteps.map((step, index) => (
              <li
                key={step}
                className="flex gap-3 rounded-[22px] border border-zinc-200 bg-white/78 p-4"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-950 text-sm font-black text-white">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm font-semibold leading-6 text-zinc-700">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="spotnera-card rounded-[28px] p-5">
            <p className="spotnera-kicker text-zinc-500">Account data</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-950">What is deleted</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Permanent account deletion removes your Spotnera authentication account and profile, favorites saved by you, and reviews written by you.
            </p>
          </article>

          <article className="spotnera-card rounded-[28px] border border-red-200 p-5">
            <p className="spotnera-kicker text-red-500">Business owners</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-950">Owned business data</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              If your account owns businesses, deletion also permanently removes those business listings, their deals, reviews and favorites about those businesses, business analytics for those businesses, and referenced logos or cover images owned by your account.
            </p>
          </article>
        </section>

        <section className="spotnera-card rounded-[30px] p-5 sm:p-7">
          <h2 className="text-xl font-semibold text-zinc-950">Important</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Account deletion is permanent and cannot be undone. Review the in-app warning carefully before confirming deletion.
          </p>

          {legalConfig.privacyContactEmail ? (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              If you cannot access your account, contact Spotnera about your deletion request at{" "}
              <a
                href={`mailto:${legalConfig.privacyContactEmail}`}
                className="font-bold text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950"
              >
                {legalConfig.privacyContactEmail}
              </a>
              .
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/privacy"
              className="spotnera-primary-action inline-flex min-h-10 items-center rounded-full px-4 text-xs"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="spotnera-secondary-action inline-flex min-h-10 items-center px-4 text-xs"
            >
              Terms
            </Link>
            <Link
              href="/"
              className="spotnera-secondary-action inline-flex min-h-10 items-center px-4 text-xs"
            >
              Back to Spotnera
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
