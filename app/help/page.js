import Link from "next/link";
import { HelpCenter } from "@/components/help-center";

export const metadata = {
  title: "Help & Support | Spotnera",
  description: "Find answers about Spotnera and contact support.",
};

export default function HelpPage() {
  return <main className="spotnera-app-shell min-h-screen px-4 py-6 text-white sm:px-6">
    <div className="mx-auto w-full max-w-4xl pb-12">
      <Link href="/" className="text-sm font-semibold text-white/65 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">← Back to Spotnera</Link>
      <header className="spotnera-card mt-5 rounded-[30px] border border-white/10 p-6 sm:p-9">
        <p className="spotnera-kicker text-[#72f0cc]">Spotnera™</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Help &amp; Support</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">Find a quick answer, or contact us if you still need help.</p>
      </header>
      <HelpCenter />
      <p className="mt-5 text-sm text-white/65">Have an idea for Spotnera? <Link href="/feedback" className="inline-flex min-h-11 items-center font-semibold text-[#72f0cc] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">Give feedback</Link></p>
    </div>
  </main>;
}
