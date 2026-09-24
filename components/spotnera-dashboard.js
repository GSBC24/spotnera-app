"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  BUSINESS_CATEGORIES,
  businessCategoryMatches,
  getBusinessCategoryConfig,
} from "@/lib/business-categories";
import { recordBusinessEvent } from "@/lib/business-events";
import { trackEvent } from "@/lib/analytics";
import { getBusinessPath } from "@/lib/business-url";
import {
  DEFAULT_SUPPORTED_COUNTRY,
  HAS_MULTIPLE_SUPPORTED_COUNTRIES,
  SUPPORTED_COUNTRIES,
  SUPPORTED_COUNTRY_NAMES,
} from "@/lib/supported-countries";
import {
  DEAL_STATUS_META,
  getDealAvailabilityLabel,
  getLiveDeals,
  getPrimaryLiveDeal,
} from "@/lib/deals";
import { createClient } from "@/utils/supabase/browser";
import { SpotneraBottomNav } from "@/components/spotnera-bottom-nav";
import { HeaderLogout } from "@/components/header-logout";
import { AuthPanel } from "@/components/auth-panel";
import { DealDetailsDialog } from "@/components/deal-details-dialog";
import { BusinessOpeningStatus } from "@/components/business-opening-hours";
import { BusinessLocationActions } from "@/components/business-location-actions";
import { getBusinessAddressLines } from "@/lib/business-address.mjs";
import { getDiscoverableDeals, partitionDiscoveryDeals } from "@/lib/deal-discovery.mjs";

const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
const STAR_PATH =
  "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z";
const LOCATION_PATH =
  "M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z";

const SOCIAL_PROFILES = [
  {
    field: "instagram_url",
    label: "Instagram",
    hosts: ["instagram.com", "www.instagram.com"],
    buildUrl: (handle) => `https://www.instagram.com/${handle}`,
    handlePattern: /^[A-Za-z0-9._]{1,30}$/,
  },
  {
    field: "facebook_url",
    label: "Facebook",
    hosts: ["facebook.com", "www.facebook.com", "fb.com", "www.fb.com"],
    buildUrl: (handle) => `https://www.facebook.com/${handle}`,
    handlePattern: /^[A-Za-z0-9.]{3,80}$/,
  },
  {
    field: "tiktok_url",
    label: "TikTok",
    hosts: ["tiktok.com", "www.tiktok.com"],
    buildUrl: (handle) => `https://www.tiktok.com/@${handle}`,
    handlePattern: /^[A-Za-z0-9._]{2,24}$/,
  },
  {
    field: "snapchat_url",
    label: "Snapchat",
    hosts: ["snapchat.com", "www.snapchat.com"],
    buildUrl: (handle) => `https://www.snapchat.com/add/${handle}`,
    handlePattern: /^[A-Za-z0-9._-]{3,30}$/,
  },
];

function Icon({ path }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="currentColor" d={path} />
    </svg>
  );
}

function getAverageRating(reviews = []) {
  if (!reviews.length) {
    return 0;
  }

  const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  return Math.round((total / reviews.length) * 10) / 10;
}

function formatRating(rating) {
  if (!rating) {
    return "New";
  }

  return Number.isInteger(rating) ? `${rating}.0` : String(rating);
}

function getPrimaryDeal(deals = []) {
  return getPrimaryLiveDeal(deals);
}

function DiscoveryDealCard({ item, onOpen }) {
  return (
    <button type="button" aria-haspopup="dialog"
      aria-label={`View details for ${item.deal.title} at ${item.business.name}`}
      onClick={() => onOpen(item)}
      className="flex w-full min-w-0 items-center gap-3 rounded-[24px] border border-white/10 bg-white/10 p-3 text-left shadow-[0_18px_50px_rgba(0,0,0,0.2)] backdrop-blur-2xl transition hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">
      <span className="h-11 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.business.color }} />
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-semibold">{item.business.name}</span>
        <span className="mt-1 block break-words text-sm leading-5 text-white/70">{item.deal.title}</span>
      </span>
      <span className="max-w-[42%] shrink-0 text-right text-xs font-medium leading-4 text-white/60">
        {getDealAvailabilityLabel(item.deal)}
      </span>
    </button>
  );
}

function MapBusinessDeals({ business }) {
  const deals = getDiscoverableDeals(business);
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <p className="text-xs font-semibold text-white/66">
        {deals.length ? `${deals.length} active ${deals.length === 1 ? "deal" : "deals"}` : "No active deals"}
      </p>
      {deals.slice(0, 2).map((deal) => (
        <div key={deal.id} className="mt-2 min-w-0 rounded-xl bg-white/8 px-3 py-2">
          <p className="break-words text-sm font-semibold text-white">{deal.title}</p>
          <p className="mt-0.5 break-words text-xs text-[#72f0cc]">{getDealAvailabilityLabel(deal)}</p>
        </div>
      ))}
      {deals.length > 2 ? <p className="mt-2 text-xs text-white/54">More deals on the profile</p> : null}
    </div>
  );
}

function getActiveDeal(deals = []) {
  return getPrimaryLiveDeal(deals);
}

function getDealStatusMeta(business) {
  const deal = getPrimaryDeal(business.deals);

  if (!deal) {
    return { label: "No deal", color: "#71717a", rank: 9 };
  }

  return DEAL_STATUS_META.LIVE;
}

function getDisplayValue(value) {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue || null;
}

function getUniqueDisplayValues(values) {
  const uniqueValues = new Map();

  for (const value of values) {
    const displayValue = getDisplayValue(value);

    if (!displayValue) {
      continue;
    }

    const normalizedValue = normalizeSearchValue(displayValue);

    if (!uniqueValues.has(normalizedValue)) {
      uniqueValues.set(normalizedValue, displayValue);
    }
  }

  return [...uniqueValues.values()].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
}

function getBusinessPhone(business) {
  return getDisplayValue(business.phone);
}

function getBusinessEmail(business) {
  const email = getDisplayValue(business.email);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }

  return email;
}

function getPhoneHref(phone) {
  const normalizedPhone = phone.replace(/[^\d+]/g, "");
  return normalizedPhone ? `tel:${normalizedPhone}` : null;
}

function getEmailHref(email) {
  return `mailto:${email}`;
}

function getWebsiteUrl(value) {
  const rawValue = getDisplayValue(value);

  if (!rawValue) {
    return null;
  }

  const urlCandidate = /^[a-z][a-z\d+.-]*:/i.test(rawValue)
    ? rawValue
    : `https://${rawValue}`;

  try {
    const url = new URL(urlCandidate);

    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getWebsiteDisplayLabel(websiteUrl) {
  try {
    const url = new URL(websiteUrl);
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return `${url.hostname}${path}`;
  } catch {
    return websiteUrl;
  }
}

function getSocialUrl(value, profile) {
  const rawValue = getDisplayValue(value);

  if (!rawValue) {
    return null;
  }

  const lowerRawValue = rawValue.toLowerCase();
  const schemelessUrl = profile.hosts.some(
    (host) => lowerRawValue === host || lowerRawValue.startsWith(`${host}/`),
  );
  const urlCandidate = schemelessUrl ? `https://${rawValue}` : rawValue;

  try {
    const url = new URL(urlCandidate);

    if (
      !["http:", "https:"].includes(url.protocol) ||
      !profile.hosts.includes(url.hostname.toLowerCase())
    ) {
      return null;
    }

    if (!url.pathname.split("/").filter(Boolean).length) {
      return null;
    }

    return url.toString();
  } catch {
    const handle = rawValue
      .replace(/^@+/, "")
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean)[0];

    if (!handle || !profile.handlePattern.test(handle)) {
      return null;
    }

    return profile.buildUrl(handle);
  }
}

function getBusinessSocialLinks(business) {
  return SOCIAL_PROFILES.map((profile) => ({
    label: profile.label,
    href: getSocialUrl(business[profile.field], profile),
  })).filter((profile) => profile.href);
}

function getReviewLabel(reviewCount) {
  return `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`;
}

function getCountLabel(count, singularLabel, pluralLabel = `${singularLabel}s`) {
  return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
}

function getBusinessEventParameters(business) {
  return {
    business_id: business.id,
    business_category: business.category,
    country: business.country ?? "",
    city: business.city ?? "",
  };
}

function getQueryErrorMessage(query) {
  if (query === "businesses") {
    return "Unable to load businesses.";
  }

  if (query === "deals") {
    return "Unable to load active deals.";
  }

  if (query === "reviews") {
    return "Unable to load reviews.";
  }

  if (query === "favorites") {
    return "Unable to load saved businesses.";
  }

  return "Unable to load the latest business information.";
}

function normalizeSearchValue(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en");
}

function businessMatchesFilters(business, filters) {
  const normalizedSearch = normalizeSearchValue(filters.searchQuery);
  const businessCountry = getDisplayValue(business.country);
  const businessCity = getDisplayValue(business.city);
  const matchesCategory =
    filters.selectedCategories.length === 0 ||
    filters.selectedCategories.some((category) => businessCategoryMatches(business.category, category));
  const matchesSearch =
    !normalizedSearch ||
    normalizeSearchValue(business.name).includes(normalizedSearch);
  const matchesCountry =
    !filters.selectedCountry || businessCountry === filters.selectedCountry;
  const matchesSupportedCountry =
    !SUPPORTED_COUNTRY_NAMES.length || SUPPORTED_COUNTRY_NAMES.includes(businessCountry);
  const matchesCity = !filters.selectedCity || businessCity === filters.selectedCity;

  return matchesCategory && matchesSearch && matchesSupportedCountry && matchesCountry && matchesCity;
}

function normalizeBusinesses(businesses) {
  const invalidLocationBusinesses = businesses.filter(
    (business) =>
      !Number.isFinite(Number(business.longitude)) ||
      !Number.isFinite(Number(business.latitude)),
  );

  if (invalidLocationBusinesses.length) {
    console.warn(
      "Dropping businesses with invalid map coordinates",
      invalidLocationBusinesses.map(({ id, name, latitude, longitude }) => ({
        id,
        name,
        latitude,
        longitude,
      })),
    );
  }

  return businesses
    .filter(
      (business) =>
        Number.isFinite(Number(business.longitude)) &&
        Number.isFinite(Number(business.latitude)),
    )
    .map((business) => ({
      ...business,
      category: business.category,
      categoryLabel: getBusinessCategoryConfig(business.category).label,
      latitude: Number(business.latitude),
      longitude: Number(business.longitude),
      deals: business.deals ?? [],
      reviews: business.reviews ?? [],
      reviewCount: business.reviews?.length ?? 0,
      averageRating: getAverageRating(business.reviews ?? []),
      isFavorite: Boolean(business.isFavorite),
      color: getBusinessCategoryConfig(business.category).color,
    }));
}

function buildMarkerElement(business, isSelected) {
  const status = getDealStatusMeta(business);
  const marker = document.createElement("button");
  marker.type = "button";
  marker.setAttribute(
    "aria-label",
    `${business.name}, ${business.category}, ${status.label} deal status`,
  );
  marker.dataset.markerId = String(business.id);
  marker.className =
    "spotnera-map-marker relative grid h-11 w-11 cursor-pointer place-items-center rounded-full border bg-white/20 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-xl transition";
  marker.classList.add(isSelected ? "border-white" : "border-white/70");

  const pulse = document.createElement("span");
  pulse.className = "absolute h-11 w-11 animate-ping rounded-full opacity-25";
  pulse.style.backgroundColor = business.color;

  const dot = document.createElement("span");
  dot.className =
    "spotnera-marker-dot relative rounded-full border-2 border-white transition-all";
  dot.style.height = isSelected ? "1.5rem" : "1rem";
  dot.style.width = isSelected ? "1.5rem" : "1rem";
  dot.style.boxShadow = isSelected ? "0 0 0 8px rgba(255,255,255,0.18)" : "none";
  dot.style.backgroundColor = business.color;

  const statusDot = document.createElement("span");
  statusDot.className =
    "absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-zinc-950";
  statusDot.style.backgroundColor = status.color;
  statusDot.title = status.label;

  const label = document.createElement("span");
  label.className =
    "spotnera-marker-label absolute -bottom-7 whitespace-nowrap rounded-full bg-zinc-950/90 px-2.5 py-1 text-[11px] font-semibold text-white";
  label.textContent = status.label;
  label.hidden = !isSelected;

  if (status.label === "LIVE") {
    marker.style.boxShadow = `0 18px 45px rgba(0,0,0,0.28), 0 0 0 6px ${business.color}40`;
  }

  marker.append(pulse, dot, statusDot, label);
  return marker;
}

function FavoriteButton({ isFavorite, onClick, size = "md", disabled = false }) {
  const sizeClass = size === "sm" ? "h-10 w-10 rounded-2xl" : "h-12 w-12 rounded-2xl";

  return (
    <button
      type="button"
      aria-label={isFavorite ? "Remove from favorites" : "Save favorite"}
      aria-pressed={isFavorite}
      disabled={disabled}
      onClick={onClick}
      className={`grid ${sizeClass} shrink-0 place-items-center border transition disabled:cursor-not-allowed disabled:opacity-60 ${
        isFavorite
          ? "border-[#33d6a6]/50 bg-[#33d6a6] text-zinc-950 shadow-[0_12px_30px_rgba(51,214,166,0.22)]"
          : "border-white/12 bg-white/10 text-white/70 hover:bg-white/16 hover:text-white"
      }`}
    >
      <Icon path={HEART_PATH} />
    </button>
  );
}

function RatingPill({ averageRating, reviewCount }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/24 px-3 py-1.5 text-xs font-semibold text-white/80">
      <span className="text-[#ffd166]">
        <Icon path={STAR_PATH} />
      </span>
      <span>{formatRating(averageRating)}</span>
      <span className="text-white/38">({reviewCount})</span>
    </span>
  );
}

function RatingLine({ averageRating, reviewCount }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/76">
      <span className="text-[#ffd166]">
        <Icon path={STAR_PATH} />
      </span>
      <span>{formatRating(averageRating)}</span>
      <span className="text-white/60">({getReviewLabel(reviewCount)})</span>
    </span>
  );
}

function BusinessAddress({ business, compact = false }) {
  const addressLines = getBusinessAddressLines(business);

  if (!addressLines.length) {
    return null;
  }

  return (
    <div
      className={`flex min-w-0 items-start gap-2 ${
        compact ? "mt-3 text-xs leading-4 text-white/54" : "mt-1 text-sm leading-5 text-white/70"
      }`}
    >
      <span className={`shrink-0 text-white/36 ${compact ? "mt-0.5" : "mt-0.5"}`}>
        <Icon path={LOCATION_PATH} />
      </span>
      <div className="min-w-0">
        {addressLines.map((line, index) => (
          <p key={`${line}-${index}`} className="[overflow-wrap:anywhere]">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function ContactActions({ business, compact = false }) {
  const phone = getBusinessPhone(business);
  const email = getBusinessEmail(business);
  const websiteUrl = getWebsiteUrl(business.website_url);
  const phoneHref = phone ? getPhoneHref(phone) : null;
  const actions = [
    phone && phoneHref
      ? {
          label: compact ? "Call" : `Phone: ${phone}`,
          href: phoneHref,
          external: false,
          method: "call",
        }
      : null,
    email
      ? {
          label: compact ? "Email" : `Email: ${email}`,
          href: getEmailHref(email),
          external: false,
          method: "email",
        }
      : null,
    websiteUrl
      ? {
          label: compact ? "Website" : `Website: ${getWebsiteDisplayLabel(websiteUrl)}`,
          href: websiteUrl,
          external: true,
          method: "website",
        }
      : null,
  ].filter(Boolean);

  if (!actions.length) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "mt-3" : "mt-2"}`}>
      {actions.map((action) => (
        <a
          key={action.href}
          href={action.href}
          target={action.external ? "_blank" : undefined}
          rel={action.external ? "noopener noreferrer" : undefined}
          onClick={() => {
            trackEvent(`contact_${action.method}`, {
              ...getBusinessEventParameters(business),
              contact_method: action.method,
            });
            recordBusinessEvent({
              businessId: business.id,
              eventType: `${action.method}_click`,
            });
          }}
          className={`max-w-full break-all rounded-full border border-white/10 bg-white/10 font-bold text-white/76 transition hover:bg-white/16 hover:text-white ${
            compact ? "px-3 py-1.5 text-xs" : "px-3 py-2 text-sm"
          }`}
        >
          {action.label}
        </a>
      ))}
    </div>
  );
}

function SocialLinks({ business, compact = false }) {
  const links = getBusinessSocialLinks(business);

  if (!links.length) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "mt-2" : "mt-2"}`}>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            trackEvent("social_click", {
              ...getBusinessEventParameters(business),
              social_platform: link.label.toLowerCase(),
            });
            recordBusinessEvent({
              businessId: business.id,
              eventType: "social_click",
            });
          }}
          className={`rounded-full border border-white/10 bg-white/8 font-bold text-white/64 transition hover:bg-white/14 hover:text-white ${
            compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-2 text-sm"
          }`}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

function CategoryDot({ category, className = "h-2.5 w-2.5" }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} rounded-full`}
      style={{ backgroundColor: getBusinessCategoryConfig(category).color }}
    />
  );
}

function CategoryFilters({
  selectedCategories,
  onToggleCategory,
  onSelectAll,
}) {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const isAllSelected = selectedCategories.length === 0;
  const selectedOnlyCategories = BUSINESS_CATEGORIES.filter(
    (category) => selectedCategories.includes(category.value),
  );
  const visibleCategories = showAllCategories
    ? BUSINESS_CATEGORIES
    : [
        ...BUSINESS_CATEGORIES.slice(0, 12),
        ...selectedOnlyCategories.filter(
          (category) => !BUSINESS_CATEGORIES.slice(0, 12).includes(category),
        ),
      ];

  return (
    <div className="grid gap-2">
      <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/76">
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={onSelectAll}
          className="h-4 w-4 accent-[#33d6a6]"
        />
        <span>All categories</span>
      </label>
      <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {visibleCategories.map((category) => {
    const isChecked = selectedCategories.includes(category.value);

          return (
            <label
              key={category.label}
              className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/12"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleCategory(category.value)}
                className="h-4 w-4 accent-[#33d6a6]"
              />
              <CategoryDot category={category.value} />
              <span>{category.label}</span>
            </label>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setShowAllCategories((expanded) => !expanded)}
        className="min-h-10 rounded-2xl border border-white/10 bg-white/8 px-3 text-xs font-bold text-white/72 transition hover:bg-white/14"
      >
        {showAllCategories ? "Show fewer" : `Show all categories (${BUSINESS_CATEGORIES.length})`}
      </button>
    </div>
  );
}

function StableMapboxMap({
  businesses,
  token,
  selectedBusiness,
  isSelectedBusinessUIOpen,
  onSelectBusiness,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) {
      return undefined;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [10.7522, 59.9139],
      zoom: 11,
      pitch: 48,
      bearing: -18,
      attributionControl: true,
    });

    mapRef.current = map;
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    map.once("load", () => map.resize());

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
      markersRef.current = new Map();

      if (mapRef.current === map) {
        mapRef.current = null;
      }

      map.remove();
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    markersRef.current.forEach(({ marker }) => marker.remove());

    const markers = new Map();
    businesses.forEach((business) => {
      const element = buildMarkerElement(
        business,
        selectedBusiness?.id === business.id,
      );
      const stopMapDrag = (event) => {
        event.stopPropagation();
        event.stopImmediatePropagation();
      };
      element.addEventListener("pointerdown", stopMapDrag, { capture: true });
      element.addEventListener("mousedown", stopMapDrag, { capture: true });
      element.addEventListener("touchstart", stopMapDrag, { passive: true });
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectBusiness(business);
      });

      const marker = new mapboxgl.Marker({
        anchor: "center",
        draggable: false,
        element,
      })
        .setLngLat([business.longitude, business.latitude])
        .addTo(map);

      markers.set(business.id, { element, marker });
    });

    markersRef.current = markers;

    if (!selectedBusiness && businesses.length) {
      const bounds = new mapboxgl.LngLatBounds();
      businesses.forEach((business) => {
        bounds.extend([business.longitude, business.latitude]);
      });

      if (businesses.length === 1) {
        map.easeTo({
          center: [businesses[0].longitude, businesses[0].latitude],
          zoom: 13,
          duration: 650,
          essential: true,
        });
      } else {
        map.fitBounds(bounds, {
          padding: 70,
          maxZoom: 13,
          duration: 650,
          essential: true,
        });
      }
    }
  }, [businesses, onSelectBusiness, selectedBusiness]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    markersRef.current.forEach(({ element }, businessId) => {
      const label = element.querySelector(".spotnera-marker-label");
      const dot = element.querySelector(".spotnera-marker-dot");
      const isSelected = Boolean(isSelectedBusinessUIOpen && selectedBusiness?.id === businessId);

      if (label) {
        label.hidden = !isSelected;
      }

      if (dot) {
        dot.style.height = isSelected ? "1.5rem" : "1rem";
        dot.style.width = isSelected ? "1.5rem" : "1rem";
        dot.style.boxShadow = isSelected
          ? "0 0 0 8px rgba(255,255,255,0.18)"
          : "none";
      }

      element.classList.toggle("border-white", isSelected);
      element.classList.toggle("border-white/70", !isSelected);
    });

    if (selectedBusiness && isSelectedBusinessUIOpen) {
      map.easeTo({
        center: [selectedBusiness.longitude, selectedBusiness.latitude],
        duration: 650,
        essential: true,
      });
    }
  }, [isSelectedBusinessUIOpen, selectedBusiness]);

  return <div ref={containerRef} className="absolute inset-0 h-full min-h-[420px] w-full" />;
}

export function SpotneraDashboard({
  businesses = [],
  profile,
  userId,
  userEmail,
  supabaseBusinessCount = businesses.length,
  supabaseDealCount = 0,
  queryErrors = [],
  initialTab = "map",
  initialSearchOpen = false,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const localProfile = profile ?? {};
  const [localBusinesses, setLocalBusinesses] = useState(() => businesses);
  const [pendingFavoriteId, setPendingFavoriteId] = useState(null);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(
    HAS_MULTIPLE_SUPPORTED_COUNTRIES ? "" : DEFAULT_SUPPORTED_COUNTRY?.name ?? "",
  );
  const [selectedCity, setSelectedCity] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [areFiltersOpen, setAreFiltersOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(initialSearchOpen);
  const [requestedAuthIntent, setRequestedAuthIntent] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const detailBackdropRef = useRef(null);
  const [isSelectedCardOpen, setIsSelectedCardOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [expandedSavedBusinessId, setExpandedSavedBusinessId] = useState(null);
  const closeDealDetails = useCallback(() => setSelectedDeal(null), []);
  const [activeTab, setActiveTab] = useState(
    ["map", "pulse", "saved"].includes(initialTab) ? initialTab : "map",
  );
  const requestedNext = searchParams.get("next") ?? "/";
  const queryAuthIntent =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/";
  const isAuthOpen =
    !userId && (searchParams.get("auth") === "1" || requestedAuthIntent !== null);
  const authIntent = requestedAuthIntent ?? queryAuthIntent;
  const handleSelectTab = useCallback((tabId) => {
    setActiveTab(tabId);
    if (tabId !== "map") setIsDetailOpen(false);
  }, []);
  const handleSelectMap = useCallback(() => {
    setActiveTab("map");
    setIsSearchOpen(false);
    setIsDetailOpen(false);
  }, []);
  const requestAuth = useCallback((intent = "/") => {
    const destination = intent === "business" ? "/owner" : intent === "saved" ? "/?tab=saved" : intent === "me" ? "/me" : intent;
    setRequestedAuthIntent(destination);
  }, []);
  const handleCloseAuth = useCallback(() => {
    setRequestedAuthIntent(null);

    const searchParams = new URLSearchParams(window.location.search);
    searchParams.delete("auth");
    searchParams.delete("next");
    const query = searchParams.toString();

    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }, [router]);
  const mappedBusinesses = useMemo(
    () => normalizeBusinesses(localBusinesses),
    [localBusinesses],
  );
  const visibleCountryOptions = SUPPORTED_COUNTRIES;
  const cityOptions = useMemo(() => {
    const countryFilteredBusinesses = selectedCountry
      ? mappedBusinesses.filter(
          (business) => getDisplayValue(business.country) === selectedCountry,
        )
      : mappedBusinesses;

    return getUniqueDisplayValues(
      countryFilteredBusinesses.map((business) => business.city),
    );
  }, [mappedBusinesses, selectedCountry]);
  const visibleCityOptions = useMemo(
    () => getUniqueDisplayValues([selectedCity, ...cityOptions]),
    [cityOptions, selectedCity],
  );
  const filteredBusinesses = useMemo(() => {
    const filters = {
      searchQuery,
      selectedCategories,
      selectedCountry,
      selectedCity,
    };

    return mappedBusinesses.filter((business) =>
      businessMatchesFilters(business, filters),
    );
  }, [mappedBusinesses, searchQuery, selectedCategories, selectedCity, selectedCountry]);

  useEffect(() => {
    const normalizedSearch = searchQuery.trim();

    if (!normalizedSearch) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      trackEvent("business_search", {
        result_count: filteredBusinesses.length,
      });
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [filteredBusinesses.length, searchQuery]);

  const [selectedBusinessId, setSelectedBusinessId] = useState(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
  const selectedBusiness =
    filteredBusinesses.find((business) => business.id === selectedBusinessId) ?? null;
  useEffect(() => {
    if (!selectedBusiness || !isDetailOpen || !detailBackdropRef.current) return undefined;
    const backdrop = detailBackdropRef.current;
    const previousOverflow = document.body.style.overflow;
    const viewport = window.visualViewport;
    document.body.style.overflow = "hidden";

    function fitVisibleViewport() {
      if (!viewport) return;
      backdrop.style.top = `${viewport.offsetTop}px`;
      backdrop.style.height = `${viewport.height}px`;
      if (backdrop.contains(document.activeElement)) {
        document.activeElement.scrollIntoView({ block: "nearest" });
      }
    }

    fitVisibleViewport();
    viewport?.addEventListener("resize", fitVisibleViewport);
    viewport?.addEventListener("scroll", fitVisibleViewport);
    return () => {
      viewport?.removeEventListener("resize", fitVisibleViewport);
      viewport?.removeEventListener("scroll", fitVisibleViewport);
      document.body.style.overflow = previousOverflow;
    };
  }, [isDetailOpen, selectedBusiness]);
  const selectedCategoryCount = selectedCategories.length;
  const activeFilterCount =
    selectedCategoryCount +
    (HAS_MULTIPLE_SUPPORTED_COUNTRIES && selectedCountry ? 1 : 0) +
    (selectedCity ? 1 : 0);
  const totalBusinessLabel = getCountLabel(supabaseBusinessCount, "Business", "Businesses");
  const totalActiveDealLabel = getCountLabel(
    supabaseDealCount,
    "Active deal",
    "Active deals",
  );
  const clearSelectedBusinessIfExcluded = useCallback(
    (filters) => {
      if (
        selectedBusinessId &&
        !mappedBusinesses.some(
          (business) =>
            business.id === selectedBusinessId &&
            businessMatchesFilters(business, filters),
        )
      ) {
        setSelectedBusinessId(null);
        setIsDetailOpen(false);
      }
    },
    [mappedBusinesses, selectedBusinessId],
  );
  const handleSearchChange = useCallback(
    (event) => {
      const nextSearchQuery = event.target.value;

      setSearchQuery(nextSearchQuery);
      clearSelectedBusinessIfExcluded({
        searchQuery: nextSearchQuery,
        selectedCategories,
        selectedCountry,
        selectedCity,
      });
    },
    [
      clearSelectedBusinessIfExcluded,
      selectedCategories,
      selectedCity,
      selectedCountry,
    ],
  );
  const handleSelectBusiness = useCallback((business) => {
    setSelectedBusinessId(business.id);
    setIsDetailOpen(false);
    setIsSelectedCardOpen(true);
    trackEvent("business_select", getBusinessEventParameters(business));
  }, []);
  const closeSelectedBusinessUI = useCallback(() => {
    setIsSelectedCardOpen(false);
    setIsDetailOpen(false);
  }, []);
  const handleToggleCategory = useCallback(
    (category) => {
      const nextCategories = selectedCategories.includes(category)
        ? selectedCategories.filter((item) => item !== category)
        : [...selectedCategories, category];

      setSelectedCategories(nextCategories);
      trackEvent("filter_category", {
        filter_category: category,
        selected: !selectedCategories.includes(category),
      });
      clearSelectedBusinessIfExcluded({
        searchQuery,
        selectedCategories: nextCategories,
        selectedCountry,
        selectedCity,
      });
    },
    [
      clearSelectedBusinessIfExcluded,
      searchQuery,
      selectedCategories,
      selectedCity,
      selectedCountry,
    ],
  );
  const handleSelectAllCategories = useCallback(() => {
    setSelectedCategories([]);
    trackEvent("filter_category", {
      filter_category: "all",
      selected: true,
    });
    clearSelectedBusinessIfExcluded({
      searchQuery,
      selectedCategories: [],
      selectedCountry,
      selectedCity,
    });
  }, [clearSelectedBusinessIfExcluded, searchQuery, selectedCity, selectedCountry]);
  const handleSelectCountry = useCallback(
    (event) => {
      const nextCountry = event.target.value;
      const nextCity =
        selectedCity &&
        mappedBusinesses.some(
          (business) =>
            (!nextCountry || getDisplayValue(business.country) === nextCountry) &&
            getDisplayValue(business.city) === selectedCity,
        )
          ? selectedCity
          : "";

      setSelectedCountry(nextCountry);
      setSelectedCity(nextCity);
      trackEvent("filter_country", {
        country: nextCountry,
      });
      clearSelectedBusinessIfExcluded({
        searchQuery,
        selectedCategories,
        selectedCountry: nextCountry,
        selectedCity: nextCity,
      });
    },
    [
      clearSelectedBusinessIfExcluded,
      mappedBusinesses,
      searchQuery,
      selectedCategories,
      selectedCity,
    ],
  );
  const handleSelectCity = useCallback(
    (event) => {
      const nextCity = event.target.value;

      setSelectedCity(nextCity);
      trackEvent("filter_city", {
        city: nextCity,
        country: selectedCountry,
      });
      clearSelectedBusinessIfExcluded({
        searchQuery,
        selectedCategories,
        selectedCountry,
        selectedCity: nextCity,
      });
    },
    [
      clearSelectedBusinessIfExcluded,
      searchQuery,
      selectedCategories,
      selectedCountry,
    ],
  );

  const currentUserReview = selectedBusiness?.reviews.find(
    (review) => review.user_id === userId,
  );
  const selectedReviewDraft = selectedBusiness
    ? reviewDrafts[selectedBusiness.id]
    : null;
  const activeReviewRating = selectedReviewDraft?.rating ?? currentUserReview?.rating ?? 5;
  const activeReviewComment =
    selectedReviewDraft?.comment ?? currentUserReview?.comment ?? "";

  const updateBusiness = useCallback((businessId, updater) => {
    setLocalBusinesses((currentBusinesses) =>
      currentBusinesses.map((business) =>
        business.id === businessId ? updater(business) : business,
      ),
    );
  }, []);

  const handleToggleFavorite = useCallback(
    async (business) => {
      if (!userId) {
        requestAuth(getBusinessPath(business));
        return;
      }
      if (pendingFavoriteId) {
        return;
      }

      const nextFavoriteState = !business.isFavorite;
      setDashboardError(null);
      setPendingFavoriteId(business.id);
      updateBusiness(business.id, (item) => ({
        ...item,
        isFavorite: nextFavoriteState,
      }));

      const { error } = nextFavoriteState
        ? await supabase.from("favorites").insert({
            business_id: business.id,
            user_id: userId,
          })
        : await supabase
            .from("favorites")
            .delete()
            .eq("business_id", business.id)
            .eq("user_id", userId);

      if (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Favorite update failed", error);
        }
        updateBusiness(business.id, (item) => ({
          ...item,
          isFavorite: !nextFavoriteState,
        }));
        setDashboardError("Unable to update saved businesses.");
      } else {
        const eventType = nextFavoriteState ? "favorite_add" : "favorite_remove";
        trackEvent(eventType, {
          ...getBusinessEventParameters(business),
        });
        recordBusinessEvent({
          businessId: business.id,
          eventType,
        });
      }

      setPendingFavoriteId(null);
    },
    [pendingFavoriteId, requestAuth, supabase, updateBusiness, userId],
  );

  const handleSubmitReview = useCallback(
    async (event) => {
      event.preventDefault();

      if (!userId) {
        event.preventDefault();
        if (selectedBusiness) requestAuth(getBusinessPath(selectedBusiness));
        return;
      }
      if (!selectedBusiness || isSavingReview) {
        return;
      }

      setDashboardError(null);
      setIsSavingReview(true);

      const payload = {
        business_id: selectedBusiness.id,
        user_id: userId,
        rating: activeReviewRating,
        comment: activeReviewComment.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("reviews")
        .upsert(payload, { onConflict: "business_id,user_id" })
        .select("id, business_id, user_id, rating, comment, created_at, updated_at")
        .single();

      if (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Review save failed", error);
        }
        setDashboardError("Unable to save review.");
        setIsSavingReview(false);
        return;
      }

      updateBusiness(selectedBusiness.id, (business) => {
        const reviews = business.reviews ?? [];
        const nextReviews = reviews.some((review) => review.user_id === userId)
          ? reviews.map((review) => (review.user_id === userId ? data : review))
          : [data, ...reviews];

        return {
          ...business,
          reviews: nextReviews,
        };
      });
      trackEvent("review_submit", {
        ...getBusinessEventParameters(selectedBusiness),
        rating: activeReviewRating,
      });
      setReviewDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[selectedBusiness.id];
        return nextDrafts;
      });

      setIsSavingReview(false);
    },
    [
      activeReviewComment,
      activeReviewRating,
      isSavingReview,
      requestAuth,
      selectedBusiness,
      supabase,
      updateBusiness,
      userId,
    ],
  );

  const discoveryDeals = useMemo(
    () => partitionDiscoveryDeals(mappedBusinesses, userId),
    [mappedBusinesses, userId],
  );

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    const defaultCountry = HAS_MULTIPLE_SUPPORTED_COUNTRIES
      ? ""
      : DEFAULT_SUPPORTED_COUNTRY?.name ?? "";
    setSelectedCountry(defaultCountry);
    setSelectedCity("");
    setSelectedCategories([]);
    setAreFiltersOpen(false);
    clearSelectedBusinessIfExcluded({
      searchQuery: "",
      selectedCategories: [],
      selectedCountry: defaultCountry,
      selectedCity: "",
    });
  }, [clearSelectedBusinessIfExcluded]);

  const handleOpenSearch = useCallback(() => {
    setActiveTab("map");
    setIsSearchOpen(true);
  }, []);

  const displayName =
    [localProfile?.first_name, localProfile?.last_name].filter(Boolean).join(" ") ||
    localProfile?.username ||
    userEmail?.split("@")[0] ||
    "explorer";
  const locationHeading = [localProfile?.city, localProfile?.country]
    .filter(Boolean)
    .join(", ");
  const cityHeading = locationHeading ? `${locationHeading} nearby` : "Nearby";
  const activeDeals = mappedBusinesses.reduce(
    (count, business) =>
      count + getLiveDeals(business.deals).length,
    0,
  );
  const savedBusinesses = userId ? mappedBusinesses.filter((business) => business.isFavorite) : [];
  const activeHeading =
    activeTab === "saved"
        ? "Saved businesses"
        : activeTab === "pulse"
          ? "Active deals"
          : cityHeading;

  return (
    <main className="spotnera-app-shell">
      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8">
        <header className="spotnera-surface z-20 flex items-center justify-between gap-3 rounded-[28px] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/icons/logo.png" alt="Spotnera" className="spotnera-brand-mark shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="spotnera-kicker text-white/55">Spotnera Live</p>
              <h1 className="mt-1 truncate text-[1.35rem] font-semibold leading-tight sm:text-2xl">
                {activeHeading}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {userId ? <><Link href="/me" aria-label="Open profile" className="spotnera-brand-action grid h-12 w-12 place-items-center rounded-2xl text-sm font-bold transition">{displayName.slice(0, 2).toUpperCase()}</Link><div className="relative"><HeaderLogout /></div></> : <Link href="/?auth=1" className="spotnera-brand-action inline-flex min-h-10 items-center rounded-2xl px-3 text-xs font-bold">Sign in</Link>}
          </div>
        </header>
        {isAuthOpen ? (
          <>
          <div className="spotnera-dialog-backdrop fixed inset-0 z-[89]" aria-hidden="true" />
          <section role="dialog" aria-modal="true" aria-labelledby="auth-gate-title" className="fixed inset-x-3 bottom-24 z-[90] mx-auto max-h-[calc(100vh-8rem)] w-auto max-w-md overflow-y-auto rounded-[28px] border border-white/14 bg-[#151821]/98 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <div className="flex items-start justify-between gap-3"><div><p className="spotnera-kicker text-white/55">Spotnera</p><h2 id="auth-gate-title" className="mt-1 text-xl font-semibold">Sign in to continue</h2><p className="mt-2 text-sm leading-6 text-white/62">Create an account or sign in to use this personal feature.</p></div><button type="button" aria-label="Close sign in" onClick={handleCloseAuth} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10 text-xl text-white/80">&times;</button></div>
            <div className="spotnera-auth-panel mt-5 rounded-2xl border border-white/10 p-4"><AuthPanel successRedirect={authIntent} /></div>
          </section>
          </>
        ) : null}
        {activeTab === "map" ? (
        <>
        {isSearchOpen ? (
        <>
        <div className="spotnera-dialog-backdrop fixed inset-0 z-[86]" aria-hidden="true" />
        <section role="dialog" aria-modal="true" aria-labelledby="search-panel-title" className="fixed inset-x-3 bottom-24 z-[87] mx-auto max-h-[calc(100vh-8rem)] w-auto max-w-2xl overflow-y-auto rounded-[28px] border border-white/14 bg-[#151821]/96 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-24 sm:w-[min(92vw,560px)] sm:-translate-x-1/2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/60">Discovery</p>
              <h2 id="search-panel-title" className="mt-1 text-xl font-semibold">Search</h2>
            </div>
            <button type="button" onClick={() => setIsSearchOpen(false)} aria-label="Close search" className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/10 text-xl text-white/80 transition hover:bg-white/16">&times;</button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search businesses..."
              className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none placeholder:text-white/52 focus:border-white/30"
            />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <label className="grid min-w-0 gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Country</span>
              <select
                value={selectedCountry}
                onChange={handleSelectCountry}
                className="h-11 w-full rounded-2xl border border-white/10 bg-black/24 px-3 text-xs font-bold text-white outline-none focus:border-white/30"
              >
                {HAS_MULTIPLE_SUPPORTED_COUNTRIES ? (
                  <option value="">All supported countries</option>
                ) : null}
                {visibleCountryOptions.map((country) => (
                  <option key={country.code} value={country.name}>
                    {country.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">City</span>
              <select
                value={selectedCity}
                onChange={handleSelectCity}
                className="h-11 w-full rounded-2xl border border-white/10 bg-black/24 px-3 text-xs font-bold text-white outline-none focus:border-white/30"
              >
                <option value="">All cities</option>
                {visibleCityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setAreFiltersOpen((isOpen) => !isOpen)}
              aria-expanded={areFiltersOpen}
              className="spotnera-brand-action h-11 self-end rounded-2xl border border-[#33d6a6]/40 px-4 text-xs font-bold transition"
            >
              Categories {activeFilterCount ? `(${activeFilterCount})` : ""}
            </button>
          </div>
          {areFiltersOpen ? (
            <div className="mt-3 grid gap-4 rounded-[24px] border border-white/10 bg-zinc-950/54 p-3">
              <div className="grid gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/66">Category</p>
                <CategoryFilters
                  selectedCategories={selectedCategories}
                  onToggleCategory={handleToggleCategory}
                  onSelectAll={handleSelectAllCategories}
                />
              </div>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={handleClearFilters} className="min-h-10 rounded-2xl border border-white/10 bg-white/8 px-4 text-xs font-bold text-white/75 transition hover:bg-white/14">Clear filters</button>
            <button type="button" onClick={() => setIsSearchOpen(false)} className="spotnera-brand-action min-h-10 rounded-2xl px-4 text-xs font-bold transition">Show results</button>
          </div>
        </section>
        </>
        ) : null}

        <div className="relative isolate mt-4 h-[68vh] min-h-[520px] overflow-hidden rounded-[32px] border border-white/12 bg-zinc-950 shadow-[0_28px_90px_rgba(0,0,0,0.38)] sm:min-h-[560px] lg:h-[72vh]">
          <div className="absolute left-4 right-4 top-4 z-10 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/14 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white/85 backdrop-blur-xl">
              {totalBusinessLabel}
            </span>
            <span className="rounded-full border border-white/14 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white/85 backdrop-blur-xl">
              {totalActiveDealLabel}
            </span>
          </div>

          {queryErrors.length ? (
            <div className="absolute left-4 right-4 top-14 z-10 grid gap-2">
              {queryErrors.map((error) => (
                <div
                  key={error.query}
                  className="rounded-2xl border border-red-300/30 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-50 backdrop-blur-xl"
                >
                  {getQueryErrorMessage(error.query)}
                </div>
              ))}
            </div>
          ) : null}

          {dashboardError ? (
            <div className="absolute left-4 right-4 top-14 z-10 rounded-2xl border border-red-300/30 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-50 backdrop-blur-xl">
              {dashboardError}
            </div>
          ) : null}

          {queryErrors.length ? (
            <span className="absolute right-4 top-4 z-10 rounded-full border border-red-300/30 bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-100 backdrop-blur-xl">
              Load issue
            </span>
          ) : null}

          {token ? (
            <StableMapboxMap
              businesses={filteredBusinesses}
              token={token}
              selectedBusiness={selectedBusiness}
              isSelectedBusinessUIOpen={isSelectedCardOpen}
              onSelectBusiness={handleSelectBusiness}
            />
          ) : (
            <div className="grid h-full min-h-[58vh] place-items-center bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02)),repeating-linear-gradient(45deg,rgba(255,255,255,0.05)_0_1px,transparent_1px_18px)] p-6 text-center">
              <div className="max-w-xs rounded-3xl border border-white/12 bg-black/25 p-5 backdrop-blur-xl">
                <p className="text-sm font-semibold text-white">
                  {!token
                    ? "Add `NEXT_PUBLIC_MAPBOX_TOKEN`"
                    : "No businesses found"}
                </p>
                <p className="mt-2 text-xs leading-5 text-white/60">
                  {!token
                    ? "The dashboard is ready for a live Mapbox map once the public token is configured."
                    : "Create active businesses to render live markers on the map."}
                </p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/35 to-transparent" />
          {token && mappedBusinesses.length && !filteredBusinesses.length ? (
            <div className="absolute bottom-4 left-4 right-4 z-10 rounded-[24px] border border-white/12 bg-zinc-950/88 p-4 text-sm font-semibold text-white/78 shadow-[0_22px_70px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
              No businesses match your filters.
            </div>
          ) : null}

          {selectedBusiness && isSelectedCardOpen && !isDetailOpen ? (
            <motion.div
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 130, damping: 18 }}
              role="region"
              aria-label={`Selected business: ${selectedBusiness.name}`}
              className="absolute bottom-4 left-4 right-4 z-10 max-h-[min(65dvh,420px)] min-w-0 overflow-y-auto overscroll-contain rounded-[28px] border border-white/14 bg-zinc-950/92 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:left-auto sm:max-w-md"
            >
              <button
                type="button"
                aria-label="Close business details"
                onClick={(event) => {
                  event.stopPropagation();
                  closeSelectedBusinessUI();
                }}
                className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full border border-white/14 bg-black/40 text-xl font-bold text-white/82 transition hover:border-white/24 hover:bg-black/60 hover:text-white"
              >
                &times;
              </button>
              <div className="min-w-0 pr-12">
                <div className="flex items-center gap-2">
                  <CategoryDot category={selectedBusiness.category} />
                  <p className="break-words text-xs font-semibold text-white/56">
                    {selectedBusiness.category}
                  </p>
                </div>
                <h2 className="mt-2 break-words text-xl font-semibold tracking-tight">
                  {selectedBusiness.name}
                </h2>
              </div>
              <BusinessAddress business={selectedBusiness} compact />
              <BusinessOpeningStatus hours={selectedBusiness.business_opening_hours} className="mt-2" />
              <MapBusinessDeals business={selectedBusiness} />
              <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailOpen(true);
                    trackEvent("view_business", {
                      ...getBusinessEventParameters(selectedBusiness),
                    });
                    recordBusinessEvent({
                      businessId: selectedBusiness.id,
                      eventType: "profile_view",
                    });
                    const activeDeal = getActiveDeal(selectedBusiness.deals);

                    if (activeDeal) {
                      trackEvent("deal_view", {
                        ...getBusinessEventParameters(selectedBusiness),
                        deal_id: activeDeal.id,
                      });
                      recordBusinessEvent({
                        businessId: selectedBusiness.id,
                        eventType: "deal_view",
                        dealId: activeDeal.id,
                      });
                    }
                  }}
                  className="spotnera-brand-action inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-bold transition"
                >
                  View details
                </button>
                <Link
                  href={getBusinessPath(selectedBusiness)}
                  className="inline-flex min-h-11 items-center rounded-xl border border-white/10 bg-white/10 px-3 text-center text-xs font-bold text-white/78 transition hover:bg-white/16"
                >
                  View profile
                </Link>
              </div>
              <BusinessLocationActions key={selectedBusiness.id} business={selectedBusiness} className="mt-2" />
            </motion.div>
          ) : null}
        </div>

        {selectedBusiness && isDetailOpen ? (
          <div ref={detailBackdropRef} className="fixed inset-x-0 top-0 z-[90] flex h-screen min-h-0 items-end justify-center bg-black/56 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-sm [height:100dvh] sm:items-center sm:px-4 sm:py-6">
            <motion.section
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="max-h-full min-h-0 w-full min-w-0 max-w-[480px] overflow-y-auto overscroll-contain rounded-[32px] border border-white/14 bg-[#151821] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.5)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="selected-business-title"
            >
              <div className="sticky top-0 z-10 -mx-4 -mt-4 flex items-start justify-between gap-3 rounded-t-[32px] bg-[#151821] px-4 pb-3 pt-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CategoryDot category={selectedBusiness.category} />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/48 [overflow-wrap:anywhere]">
                      {selectedBusiness.category}
                    </p>
                  </div>
                  <h2
                    id="selected-business-title"
                    className="mt-2 text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]"
                  >
                    {selectedBusiness.name}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close business details"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeSelectedBusinessUI();
                  }}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/14 bg-black/40 text-xl font-bold text-white/82 transition hover:border-white/24 hover:bg-black/60 hover:text-white"
                >
                  &times;
                </button>
              </div>

              <div className="mt-4 rounded-[24px] border border-white/10 bg-white/8 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Business hours</p>
                <BusinessOpeningStatus hours={selectedBusiness.business_opening_hours} className="mt-1" />
              </div>

              <div className="mt-4 rounded-[24px] border border-white/10 bg-white/8 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                  Active deal
                </p>
                <p className="mt-1 text-base font-semibold text-white">
                  {getActiveDeal(selectedBusiness.deals)?.title ?? "No active deal"}
                </p>
                {getActiveDeal(selectedBusiness.deals) ? (
                  <p className="mt-1 text-xs font-bold text-[#72f0cc]">
                    {getDealAvailabilityLabel(getActiveDeal(selectedBusiness.deals))}
                  </p>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <RatingLine
                  averageRating={selectedBusiness.averageRating}
                  reviewCount={selectedBusiness.reviewCount}
                />
                <span className="rounded-full border border-white/12 bg-black/24 px-3 py-1.5 text-xs font-semibold text-white/66">
                  {getDealStatusMeta(selectedBusiness).label}
                </span>
                <span className="rounded-full border border-white/12 bg-black/24 px-3 py-1.5 text-xs font-semibold text-white/66">
                  {selectedBusiness.is_active ? "Public listing" : "Hidden"}
                </span>
              </div>

              {selectedBusiness.description ? (
                <div className="mt-3 rounded-[24px] border border-white/10 bg-white/8 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                    About
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white/62">
                    {selectedBusiness.description}
                  </p>
                </div>
              ) : null}

              {getBusinessAddressLines(selectedBusiness).length ? (
                <div className="mt-3 rounded-[24px] border border-white/10 bg-white/8 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                    Location
                  </p>
                  <BusinessAddress business={selectedBusiness} />
                  <BusinessLocationActions key={selectedBusiness.id} business={selectedBusiness} className="mt-3" />
                </div>
              ) : null}

              {getBusinessPhone(selectedBusiness) ||
              getBusinessEmail(selectedBusiness) ||
              getWebsiteUrl(selectedBusiness.website_url) ? (
                <div className="mt-3 rounded-[24px] border border-white/10 bg-white/8 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                    Contact
                  </p>
                  <ContactActions business={selectedBusiness} />
                </div>
              ) : null}

              {getBusinessSocialLinks(selectedBusiness).length ? (
                <div className="mt-3 rounded-[24px] border border-white/10 bg-white/8 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                    Social media
                  </p>
                  <SocialLinks business={selectedBusiness} />
                </div>
              ) : null}

              <div className="mt-4 flex items-center gap-3">
                <FavoriteButton
                  isFavorite={selectedBusiness.isFavorite}
                  disabled={pendingFavoriteId === selectedBusiness.id}
                  onClick={() => handleToggleFavorite(selectedBusiness)}
                />
                <span className="text-sm font-semibold text-white/70">
                  {selectedBusiness.isFavorite ? "Saved" : "Save business"}
                </span>
                {selectedBusiness.owner_id === userId ? (
                  <Link
                    href="/owner"
                    className="ml-auto rounded-2xl border border-white/10 bg-white/8 px-4 py-2 text-xs font-bold text-white/78 transition hover:bg-white/14"
                  >
                    Edit
                  </Link>
                ) : null}
              </div>

              <form onSubmit={handleSubmitReview} className="mt-4 min-w-0 border-t border-white/10 pt-4">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex max-w-full flex-wrap gap-1" aria-label="Rating">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        aria-label={`${rating} star rating`}
                        onClick={() =>
                          setReviewDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [selectedBusiness.id]: {
                              rating,
                              comment: activeReviewComment,
                            },
                          }))
                        }
                        className={`grid h-9 w-9 place-items-center rounded-xl text-lg transition ${
                          rating <= activeReviewRating
                            ? "bg-[#ffd166]/18 text-[#ffd166]"
                            : "bg-white/8 text-white/34 hover:text-white/70"
                        }`}
                      >
                        <Icon path={STAR_PATH} />
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingReview}
                    className="spotnera-brand-action w-full rounded-2xl px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {isSavingReview
                      ? "Saving"
                      : currentUserReview
                        ? "Update review"
                        : "Review"}
                  </button>
                </div>
                <Link
                  href={getBusinessPath(selectedBusiness)}
                  className="mt-3 inline-flex min-h-10 items-center rounded-2xl border border-white/10 bg-white/8 px-4 text-xs font-bold text-white/78 transition hover:bg-white/14"
                >
                  View public profile
                </Link>
                <textarea
                  value={activeReviewComment}
                  onChange={(event) =>
                    setReviewDrafts((currentDrafts) => ({
                      ...currentDrafts,
                      [selectedBusiness.id]: {
                        rating: activeReviewRating,
                        comment: event.target.value,
                      },
                    }))
                  }
                  maxLength={1000}
                  rows={3}
                  placeholder="Share a quick note"
                  className="mt-3 block w-full min-w-0 max-w-full resize-none rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/52 focus:border-white/28"
                />
              </form>
            </motion.section>
          </div>
        ) : null}

        </>
        ) : null}

        {activeTab === "pulse" ? (
        <section className="mx-auto mt-4 w-full max-w-3xl">
          <div className="mb-3 flex items-end justify-between px-1">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/60">
                Live activity
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                Active deals
              </h2>
            </div>
            <span className="spotnera-live-badge rounded-full px-3 py-1 text-xs font-semibold">
              {activeDeals} active
            </span>
          </div>
          {discoveryDeals.saved.length ? (
            <section aria-labelledby="saved-deals-heading" className="mb-5 rounded-[26px] border border-[#33d6a6]/20 bg-[#33d6a6]/6 p-3 sm:p-4">
              <h3 id="saved-deals-heading" className="mb-3 px-1 text-base font-semibold text-[#72f0cc]">From businesses you saved</h3>
              <div className="grid gap-3">
                {discoveryDeals.saved.map((item) => <DiscoveryDealCard key={item.deal.id} item={item} onOpen={setSelectedDeal} />)}
              </div>
            </section>
          ) : null}
          <section aria-labelledby="general-deals-heading">
            <h3 id="general-deals-heading" className="mb-3 px-1 text-base font-semibold">Explore more deals</h3>
          <div className="grid gap-3">
            {discoveryDeals.general.length ? (
              discoveryDeals.general.map((item) => <DiscoveryDealCard key={item.deal.id} item={item} onOpen={setSelectedDeal} />)
            ) : (
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 text-sm text-white/58 backdrop-blur-2xl">
                {discoveryDeals.saved.length ? "No other active deals right now." : "No live business activity yet."}
              </div>
            )}
          </div>
          </section>
        </section>
        ) : null}

        {activeTab === "saved" ? (
        <section className="mx-auto mt-4 w-full max-w-3xl">
          <div className="mb-3 flex items-end justify-between px-1">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/60">
                Saved
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                Your saved businesses
              </h2>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/62">
              {savedBusinesses.length} saved
            </span>
          </div>
          <div className="grid gap-3">
            {savedBusinesses.length ? (
              savedBusinesses.map((business, index) => {
                const liveDeals = getDiscoverableDeals(business);
                const isExpanded = expandedSavedBusinessId === business.id;
                return <motion.article
                  key={business.id}
                  initial={{ x: 24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.04, duration: 0.32 }}
                  className="min-w-0 rounded-[24px] border border-white/10 bg-white/10 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-2xl"
                >
                  <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="h-12 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: business.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-sm font-semibold">{business.name}</h3>
                    <p className="mt-1 text-xs font-medium text-white/60">
                      {liveDeals.length ? `${liveDeals.length} active ${liveDeals.length === 1 ? "deal" : "deals"}` : "No active deals"}
                    </p>
                    <p className="mt-1 break-words text-sm text-white/54">
                      {[business.category, business.city].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <RatingPill
                        averageRating={business.averageRating}
                        reviewCount={business.reviewCount}
                      />
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/18 px-3 py-1.5 text-xs font-semibold text-white/54">
                        <CategoryDot category={business.category} />
                        {business.category}
                      </span>
                    </div>
                  </div>
                  <FavoriteButton
                    size="sm"
                    isFavorite={business.isFavorite}
                    disabled={pendingFavoriteId === business.id}
                    onClick={() => {
                      handleToggleFavorite(business);
                    }}
                  />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 pl-4">
                    <Link href={getBusinessPath(business)} className="inline-flex min-h-11 items-center rounded-xl border border-white/16 px-3 text-xs font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">View business</Link>
                    {liveDeals.length ? <button type="button" aria-expanded={isExpanded}
                      onClick={() => setExpandedSavedBusinessId(isExpanded ? null : business.id)}
                      className="inline-flex min-h-11 items-center rounded-xl border border-[#33d6a6]/30 bg-[#33d6a6]/10 px-3 text-xs font-semibold text-[#72f0cc] transition hover:bg-[#33d6a6]/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">View deals</button> : null}
                  </div>
                  {liveDeals.length && isExpanded ? (
                    <div id={`saved-deals-${business.id}`} className="mt-3 min-w-0 border-t border-white/10 pt-3 pl-4">
                      <h4 className="mb-2 break-words text-sm font-semibold">Deals from {business.name}</h4>
                      <ul className="grid gap-2">
                        {liveDeals.map((deal) => <li key={deal.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-black/20 p-3">
                          <span className="min-w-0 flex-1 break-words"><span className="block break-words text-sm font-semibold">{deal.title}</span><span className="mt-1 block text-xs text-white/60">{getDealAvailabilityLabel(deal)}</span></span>
                          <button type="button" aria-haspopup="dialog" onClick={() => setSelectedDeal({ business, deal })}
                            className="min-h-11 rounded-xl border border-white/16 px-3 text-xs font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">View deal</button>
                        </li>)}
                      </ul>
                    </div>
                  ) : null}
                </motion.article>;
              })
            ) : (
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 text-sm text-white/58 backdrop-blur-2xl">
                Saved businesses will appear here.
              </div>
            )}
          </div>
        </section>
        ) : null}

        <SpotneraBottomNav
          activeTab={activeTab}
          searchOpen={isSearchOpen}
          searchActiveCount={activeFilterCount + (searchQuery.trim() ? 1 : 0)}
          onMap={handleSelectMap}
          onSearch={handleOpenSearch}
          onPulse={() => handleSelectTab("pulse")}
          onSaved={() => userId ? handleSelectTab("saved") : requestAuth("saved")}
          isAuthenticated={Boolean(userId)}
          onRequireAuth={requestAuth}
        />
      </section>
      {selectedDeal ? (
        <DealDetailsDialog business={selectedDeal.business} deal={selectedDeal.deal}
          onClose={closeDealDetails} />
      ) : null}
    </main>
  );
}
