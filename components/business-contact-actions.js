"use client";

import { BusinessEventLink } from "@/components/business-event-link";
import { useBusinessCopyFeedback } from "@/components/use-business-copy-feedback";

const ICON_PATHS = {
  phone: "M6.6 3.7 9 6.1 7.7 8.5a15.1 15.1 0 0 0 7.8 7.8l2.4-1.3 2.4 2.4-1.4 2.6a2 2 0 0 1-2.1 1A19.5 19.5 0 0 1 3 7.2a2 2 0 0 1 1-2.1l2.6-1.4Z",
  email: "M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Zm0 0 9 7 9-7",
  copy: "M8 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM3 16V4a2 2 0 0 1 2-2h11",
};

function Icon({ kind }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0"><path d={ICON_PATHS[kind]} /></svg>;
}

export function BusinessContactActions({ business, action }) {
  const { feedback, copy } = useBusinessCopyFeedback();
  const isPhone = action.icon === "phone";
  const successMessage = isPhone ? "Number copied" : "Email copied";
  const copyLabel = isPhone ? "Copy number" : "Copy email";

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/10 p-3">
      <p className="text-sm font-black text-white">{action.label}</p>
      <p className="mt-1 select-text text-sm font-semibold text-white/70 [overflow-wrap:anywhere]">{action.detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <BusinessEventLink business={business} eventType={action.eventType}
          gaParameters={{ contact_method: action.eventType.replace("_click", "") }}
          href={action.href}
          className="spotnera-secondary-action inline-flex min-h-11 items-center justify-center gap-2 px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">
          <Icon kind={action.icon} />{action.action}
        </BusinessEventLink>
        <button type="button" aria-label={isPhone ? "Copy business phone number" : "Copy business email address"}
          onClick={() => copy(action.detail, successMessage)}
          className="spotnera-secondary-action inline-flex min-h-11 items-center justify-center gap-2 px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">
          <Icon kind="copy" />{feedback === successMessage ? successMessage : feedback ? "Copy failed" : copyLabel}
        </button>
      </div>
      <span role="status" aria-live="polite" className="sr-only">{feedback}</span>
    </div>
  );
}
