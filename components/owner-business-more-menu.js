"use client";

import { useEffect, useRef } from "react";
import { CopyProfileLinkButton } from "@/components/copy-profile-link-button";
import { BusinessQrCode } from "@/components/business-qr-code";
import { DeleteBusinessButton } from "@/components/delete-business-button";

export function OwnerBusinessMoreMenu({ business, section }) {
  const detailsRef = useRef(null);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!detailsRef.current?.contains(event.target)) detailsRef.current?.removeAttribute("open");
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  return (
    <details ref={detailsRef} className="relative" onKeyDown={(event) => {
      if (event.key === "Escape" && !event.target.closest('[role="dialog"]')) {
        detailsRef.current?.removeAttribute("open");
        detailsRef.current?.querySelector("summary")?.focus();
      }
    }}>
      <summary className="spotnera-secondary-action inline-flex min-h-11 cursor-pointer list-none items-center justify-center gap-1.5 px-3 text-xs marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">
        More <span aria-hidden="true">⋯</span>
      </summary>
      <div className="absolute bottom-full right-0 z-[100] mb-2 grid w-56 max-w-[calc(100vw-2rem)] gap-2 rounded-2xl border border-white/16 bg-zinc-950 p-3 shadow-2xl">
        <CopyProfileLinkButton
          businessId={business.id}
          businessSlug={business.slug}
          businessCategory={business.category}
          city={business.city}
          country={business.country}
          className="w-full justify-start"
        />
        <BusinessQrCode business={business} triggerClassName="w-full justify-start" />
        <div className="border-t border-white/12 pt-2">
          <DeleteBusinessButton
            businessId={business.id}
            businessName={business.name}
            businessCategory={business.category}
            section={section}
            triggerClassName="w-full justify-start"
          />
        </div>
      </div>
    </details>
  );
}
