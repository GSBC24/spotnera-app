"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { id: "map", label: "Map", href: "/", icon: "M12 3l7 4v12l-7-4-7 4V7l7-4zm0 2.2L7 8v8.8l5-2.8 5 2.8V8l-5-2.8z" },
  { id: "search", label: "Search", href: "/?search=1", icon: "M10.8 4a6.8 6.8 0 1 0 4.25 12.1l4.42 4.42 1.42-1.42-4.42-4.42A6.8 6.8 0 0 0 10.8 4zm0 2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6z" },
  { id: "pulse", label: "Deals", href: "/?tab=pulse", icon: "M4 13h3l2-7 4 12 2-5h5v2h-3.6L13 22 9.2 10.5 8.5 15H4v-2z" },
  { id: "saved", label: "Saved", href: "/?tab=saved", icon: "M6 3h12v18l-6-3.8L6 21V3zm2 2v12.4l4-2.5 4 2.5V5H8z" },
  { id: "me", label: "Me", href: "/me", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-7 2.1-7 5v1h14v-1c0-2.9-3-5-7-5z" },
  { id: "business", label: "Business", href: "/owner", icon: "M4 7h16v13H4V7zm3-4h10l2 4H5l2-4zm2 8v6m6-6v6" },
];

export function SpotneraBottomNav({ activeTab = "map", searchOpen = false, searchActiveCount = 0, onMap, onSearch, onPulse, onSaved }) {
  const pathname = usePathname();
  const routeActiveId = pathname?.startsWith("/owner")
    ? "business"
    : pathname?.startsWith("/me")
      ? "me"
    : pathname === "/" && searchOpen
      ? "search"
      : pathname === "/" && !["pulse", "saved"].includes(activeTab)
        ? "map"
        : activeTab;

  return (
    <nav className="fixed bottom-4 left-1/2 z-[85] grid w-[min(97vw,620px)] -translate-x-1/2 grid-cols-6 rounded-[28px] border border-white/14 bg-zinc-950/62 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl [padding-bottom:calc(0.375rem+env(safe-area-inset-bottom))] sm:p-2 sm:[padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))]">
      {items.map((item) => {
        const label = item.id === "search" && searchActiveCount ? `Search (${searchActiveCount})` : item.label;
        const className = `relative flex min-w-0 h-14 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[9px] font-semibold transition sm:px-1 sm:text-[11px] ${routeActiveId === item.id ? "bg-white text-zinc-950 shadow-[0_10px_26px_rgba(255,255,255,0.18)]" : "text-white/56 hover:bg-white/10 hover:text-white"}`;

        if (item.id === "map" && onMap) {
          return <Link key={item.id} href="/" aria-label={item.label} onClick={onMap} className={className}><Icon path={item.icon} /><span className="truncate">{item.label}</span></Link>;
        }
        if (item.id === "search" && onSearch) {
          return <button key={item.id} type="button" aria-label="Open search and filters" onClick={onSearch} className={className}><Icon path={item.icon} /><span className="truncate">{label}</span></button>;
        }
        if (item.id === "pulse" && onPulse) {
          return <button key={item.id} type="button" aria-label={item.label} onClick={onPulse} className={className}><Icon path={item.icon} /><span>{item.label}</span></button>;
        }
        if (item.id === "saved" && onSaved) {
          return <button key={item.id} type="button" aria-label={item.label} onClick={onSaved} className={className}><Icon path={item.icon} /><span>{item.label}</span></button>;
        }
        return <Link key={item.id} href={item.href} aria-label={item.label} className={className}><Icon path={item.icon} /><span className="truncate">{item.label}</span></Link>;
      })}
    </nav>
  );
}

function Icon({ path }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0"><path fill="currentColor" d={path} /></svg>;
}
