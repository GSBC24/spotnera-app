"use client";

import { useCallback, useEffect, useState } from "react";
import { DealDetailsDialog } from "@/components/deal-details-dialog";
import { DealAvailabilityLabel, LocalDealDateTime } from "@/components/deal-time-label";
import { recordBusinessEvent } from "@/lib/business-events";
import { trackEvent } from "@/lib/analytics";
import { partitionPublicProfileDeals } from "@/lib/public-profile-deals.mjs";

function ProfileDealCard({ business, deal, upcoming, onOpen }) {
  return (
    <article className={`min-w-0 rounded-[26px] border p-4 ${upcoming
      ? "border-white/12 bg-white/8"
      : "border-[#33d6a6]/24 bg-[#33d6a6]/14"}`}>
      <h3 className="text-xl font-semibold [overflow-wrap:anywhere] sm:text-2xl">{deal.title}</h3>
      {deal.description ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/68 [overflow-wrap:anywhere]">{deal.description}</p> : null}
      <p className={`mt-4 text-xs font-bold uppercase tracking-[0.14em] [overflow-wrap:anywhere] ${upcoming ? "text-white/78" : "text-[#72f0cc]"}`}>
        <DealAvailabilityLabel deal={deal} />
      </p>
      {!upcoming && deal.ends_at ? (
        <p className="mt-2 text-xs font-bold uppercase text-white/48 [overflow-wrap:anywhere]">
          <LocalDealDateTime prefix="Valid until " value={deal.ends_at} />
        </p>
      ) : null}
      <button type="button" aria-haspopup="dialog" aria-label={`View details for ${deal.title} at ${business.name}`}
        onClick={() => onOpen(deal)}
        className="mt-5 inline-flex min-h-11 items-center rounded-2xl bg-white px-4 text-sm font-bold text-zinc-950 transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">
        View deal
      </button>
    </article>
  );
}

export function BusinessProfileDeals({ business, deals, initialNow }) {
  const [now, setNow] = useState(() => new Date(initialNow));
  const [selectedDeal, setSelectedDeal] = useState(null);
  const closeDealDetails = useCallback(() => setSelectedDeal(null), []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const { active, upcoming } = partitionPublicProfileDeals(deals, now);
  function openDeal(deal) {
    setSelectedDeal(deal);
    // Preserve the existing primary active deal's view event.
    if (deal.id === active[0]?.id) {
      trackEvent("deal_view", {
        business_id: business.id,
        business_category: business.category,
        city: business.city,
        country: business.country,
        deal_id: deal.id,
      });
      recordBusinessEvent({ businessId: business.id, eventType: "deal_view", dealId: deal.id });
    }
  }

  if (!active.length && !upcoming.length) {
    return (
      <section className="spotnera-surface rounded-[30px] p-4 sm:p-5">
        <h2 className="text-xl font-semibold">Deals</h2>
        <p className="mt-4 rounded-[26px] border border-white/10 bg-white/8 p-4 text-sm font-semibold text-white/62">
          No active deals right now.
        </p>
      </section>
    );
  }

  return (
    <>
      {active.length ? (
        <section className="spotnera-surface min-w-0 rounded-[30px] p-4 sm:p-5">
          <h2 className="text-xl font-semibold [overflow-wrap:anywhere]">Active Deals</h2>
          <div className="mt-4 grid min-w-0 gap-3">
            {active.map((deal) => <ProfileDealCard key={deal.id} business={business} deal={deal} onOpen={openDeal} />)}
          </div>
        </section>
      ) : null}
      {upcoming.length ? (
        <section className="spotnera-surface min-w-0 rounded-[30px] p-4 sm:p-5">
          <h2 className="text-xl font-semibold [overflow-wrap:anywhere]">Upcoming Deals</h2>
          <div className="mt-4 grid min-w-0 gap-3">
            {upcoming.map((deal) => <ProfileDealCard key={deal.id} business={business} deal={deal} upcoming onOpen={openDeal} />)}
          </div>
        </section>
      ) : null}
      {selectedDeal ? <DealDetailsDialog business={business} deal={selectedDeal} onClose={closeDealDetails} /> : null}
    </>
  );
}
