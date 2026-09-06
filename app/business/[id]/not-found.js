import Link from "next/link";
import Image from "next/image";

export default function BusinessProfileNotFound() {
  return (
    <main className="spotnera-auth-shell flex min-h-screen items-center justify-center px-5 py-10">
      <section className="spotnera-card w-full max-w-md rounded-[30px] p-6 text-zinc-950 sm:p-8">
        <div className="flex items-center gap-3">
          <Image
            src="/icons/logo.png"
            alt="Spotnera"
            width={40}
            height={40}
            className="spotnera-brand-mark object-contain"
          />
          <div>
            <p className="spotnera-kicker text-zinc-500">Spotnera</p>
            <p className="text-sm font-bold">Business profile</p>
          </div>
        </div>
        <h1 className="mt-7 text-2xl font-semibold">Business profile not found</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          This Spotnera business profile is unavailable, inactive, or the link is no longer valid.
        </p>
        <Link
          href="/"
          className="spotnera-primary-action mt-6 inline-flex min-h-12 items-center justify-center px-5 text-sm"
        >
          Explore Spotnera
        </Link>
      </section>
    </main>
  );
}
