"use client";

import { recordBusinessEvent } from "@/lib/business-events";
import { trackEvent } from "@/lib/analytics";

const CONTACT_GA_EVENTS = {
  website_click: "contact_website",
  call_click: "contact_call",
  email_click: "contact_email",
};

export function BusinessEventLink({
  business,
  children,
  className,
  dealId,
  eventType,
  gaEventName,
  gaParameters = {},
  href,
  rel,
  target,
}) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      onClick={() => {
        trackEvent(gaEventName ?? CONTACT_GA_EVENTS[eventType] ?? eventType, {
          business_id: business.id,
          business_category: business.category,
          city: business.city,
          country: business.country,
          ...gaParameters,
        });
        recordBusinessEvent({
          businessId: business.id,
          eventType,
          dealId,
        });
      }}
      className={className}
    >
      {children}
    </a>
  );
}
