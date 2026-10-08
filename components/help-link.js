import Link from "next/link";

export function HelpLink({ light = false, showLabel = false, className = "" }) {
  return <Link href="/help" aria-label="Help & Support"
    className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] ${light ? "border-zinc-300 text-zinc-700 hover:bg-zinc-100" : "border-white/14 text-white/70 hover:bg-white/10 hover:text-white"} ${className}`}>
    <span aria-hidden="true" className="text-base leading-none">?</span>
    <span className={showLabel ? "inline" : "hidden sm:inline"}>Help</span>
  </Link>;
}
