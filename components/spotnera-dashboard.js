"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  BUSINESS_CATEGORIES,
  getBusinessCategoryConfig,
} from "@/lib/business-categories";
import { createClient } from "@/utils/supabase/browser";

const DEAL_STATUS_META = {
  active: { label: "Active", color: "#33d6a6", rank: 0 },
  scheduled: { label: "Scheduled", color: "#8ea7ff", rank: 1 },
  paused: { label: "Paused", color: "#ffd166", rank: 2 },
  ended: { label: "Ended", color: "#a1a1aa", rank: 3 },
};

const navItems = [
  { label: "Map", icon: "M12 3l7 4v12l-7-4-7 4V7l7-4zm0 2.2L7 8v8.8l5-2.8 5 2.8V8l-5-2.8z" },
  { label: "Pulse", icon: "M4 13h3l2-7 4 12 2-5h5v2h-3.6L13 22 9.2 10.5 8.5 15H4v-2z" },
  { label: "Saved", icon: "M6 3h12v18l-6-3.8L6 21V3zm2 2v12.4l4-2.5 4 2.5V5H8z" },
  { label: "Me", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-7 2.1-7 5v1h14v-1c0-2.9-3-5-7-5z" },
];

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

const PROFILE_COUNTRIES = [
  "Norway",
  "Sweden",
  "Denmark",
  "Finland",
  "Iceland",
  "United Kingdom",
  "Ireland",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Belgium",
  "Switzerland",
  "Austria",
  "Poland",
  "Portugal",
  "Greece",
  "United States",
  "Canada",
  "Australia",
  "New Zealand",
  "Japan",
  "South Korea",
  "Singapore",
  "India",
  "Brazil",
  "Mexico",
  "South Africa",
  "Other",
];

const GENDER_OPTIONS = [
  "Prefer not to say",
  "Woman",
  "Man",
  "Non-binary",
  "Other",
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
  return [...deals].sort((left, right) => {
    const leftRank = DEAL_STATUS_META[left.status]?.rank ?? 9;
    const rightRank = DEAL_STATUS_META[right.status]?.rank ?? 9;

    return leftRank - rightRank;
  })[0];
}

function getActiveDeal(deals = []) {
  return deals.find((deal) => deal.status === "active");
}

function getDealStatusMeta(business) {
  const deal = getPrimaryDeal(business.deals);

  if (!deal) {
    return { label: "No deal", color: "#71717a", rank: 9 };
  }

  return DEAL_STATUS_META[deal.status] ?? DEAL_STATUS_META.paused;
}

function getBusinessSignal(business) {
  const deal = getPrimaryDeal(business.deals);

  if (deal) {
    return deal.title;
  }

  return business.description || business.address || business.city;
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

function getBusinessAddressLines(business) {
  const address = getDisplayValue(business.address);
  const city = getDisplayValue(business.city);
  const country = getDisplayValue(business.country);
  const locality = [city, country].filter(Boolean).join(", ");

  return [address, locality].filter(Boolean);
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

function normalizeProfilePhone(value) {
  const phone = String(value ?? "").trim().replace(/\s+/g, " ");

  if (!phone) {
    return { value: null };
  }

  if (!/^\+?[0-9][0-9\s().-]{5,24}$/.test(phone)) {
    return { error: "Enter a valid phone number." };
  }

  return { value: phone };
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
    filters.selectedCategories.includes(business.category);
  const matchesSearch =
    !normalizedSearch ||
    normalizeSearchValue(business.name).includes(normalizedSearch);
  const matchesCountry =
    !filters.selectedCountry || businessCountry === filters.selectedCountry;
  const matchesCity = !filters.selectedCity || businessCity === filters.selectedCity;

  return matchesCategory && matchesSearch && matchesCountry && matchesCity;
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
      category: getBusinessCategoryConfig(business.category).label,
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
    "spotnera-map-marker relative grid h-11 w-11 place-items-center rounded-full border bg-white/20 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:scale-105";
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

  if (status.label === "Active") {
    marker.style.boxShadow = `0 18px 45px rgba(0,0,0,0.28), 0 0 0 6px ${business.color}40`;
  }

  marker.append(pulse, dot, statusDot, label);
  return marker;
}

function buildPopupContent(business) {
  const status = getDealStatusMeta(business);
  const deal = getPrimaryDeal(business.deals);
  const addressLines = getBusinessAddressLines(business);
  const content = document.createElement("div");
  content.className = "min-w-40";

  const category = document.createElement("p");
  category.className =
    "text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500";
  category.textContent = business.category;

  const name = document.createElement("p");
  name.className = "mt-1 text-sm font-bold text-zinc-950";
  name.textContent = business.name;

  const signal = document.createElement("p");
  signal.className = "mt-1 text-xs text-zinc-600";
  signal.textContent = deal ? `${status.label}: ${deal.title}` : getBusinessSignal(business);

  const rating = document.createElement("p");
  rating.className = "mt-2 text-xs font-semibold text-zinc-800";
  rating.textContent = `${formatRating(business.averageRating)} rating - ${getReviewLabel(business.reviewCount)}`;

  content.append(category, name, signal, rating);

  if (addressLines.length) {
    const address = document.createElement("p");
    address.className = "mt-2 text-xs leading-4 text-zinc-500";
    address.textContent = addressLines.join("\n");
    address.style.whiteSpace = "pre-line";
    content.append(address);
  }

  return content;
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
          ? "border-[#ff7a59]/50 bg-[#ff7a59] text-white shadow-[0_12px_30px_rgba(255,122,89,0.22)]"
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
      <span className="text-white/42">({getReviewLabel(reviewCount)})</span>
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
          <p key={`${line}-${index}`} className={compact ? "truncate" : ""}>
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
      ? { label: compact ? "Call" : `Phone: ${phone}`, href: phoneHref, external: false }
      : null,
    email
      ? { label: compact ? "Email" : `Email: ${email}`, href: getEmailHref(email), external: false }
      : null,
    websiteUrl
      ? {
          label: compact ? "Website" : `Website: ${getWebsiteDisplayLabel(websiteUrl)}`,
          href: websiteUrl,
          external: true,
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
          className={`rounded-full border border-white/10 bg-white/10 font-bold text-white/76 transition hover:bg-white/16 hover:text-white ${
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
  const isAllSelected = selectedCategories.length === 0;

  return (
    <div className="grid gap-2">
      <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/76">
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={onSelectAll}
          className="h-4 w-4 accent-white"
        />
        <span>All businesses</span>
      </label>
      <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {BUSINESS_CATEGORIES.map((category) => {
          const isChecked = selectedCategories.includes(category.label);

          return (
            <label
              key={category.label}
              className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/12"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleCategory(category.label)}
                className="h-4 w-4 accent-white"
              />
              <CategoryDot category={category.label} />
              <span>{category.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function StableMapboxMap({ businesses, token, selectedBusiness, onSelectBusiness }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
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

    const popup = new mapboxgl.Popup({
      anchor: "bottom",
      closeButton: false,
      closeOnClick: false,
      className: "spotnera-popup",
      offset: 34,
    });
    popupRef.current = popup;

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    map.once("load", () => map.resize());

    return () => {
      resizeObserver.disconnect();
      popup.remove();
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
      element.addEventListener("click", () => onSelectBusiness(business));

      const marker = new mapboxgl.Marker({
        anchor: "center",
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
    const popup = popupRef.current;

    if (!map || !popup) {
      return;
    }

    if (!selectedBusiness) {
      popup.remove();
      return;
    }

    markersRef.current.forEach(({ element }, businessId) => {
      const label = element.querySelector(".spotnera-marker-label");
      const dot = element.querySelector(".spotnera-marker-dot");
      const isSelected = businessId === selectedBusiness.id;

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

    popup
      .setLngLat([selectedBusiness.longitude, selectedBusiness.latitude])
      .setDOMContent(buildPopupContent(selectedBusiness))
      .addTo(map);

    map.easeTo({
      center: [selectedBusiness.longitude, selectedBusiness.latitude],
      duration: 650,
      essential: true,
    });
  }, [selectedBusiness]);

  return <div ref={containerRef} className="h-full w-full" />;
}

export function SpotneraDashboard({
  businesses = [],
  profile,
  userId,
  userEmail,
  supabaseBusinessCount = businesses.length,
  supabaseDealCount = 0,
  queryErrors = [],
}) {
  const supabase = useMemo(() => createClient(), []);
  const [localProfile, setLocalProfile] = useState(() => profile ?? {});
  const [localBusinesses, setLocalBusinesses] = useState(() => businesses);
  const [pendingFavoriteId, setPendingFavoriteId] = useState(null);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [profileMessage, setProfileMessage] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(() => profile?.country ?? "");
  const [selectedCity, setSelectedCity] = useState(() => profile?.city ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [areFiltersOpen, setAreFiltersOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const mappedBusinesses = useMemo(
    () => normalizeBusinesses(localBusinesses),
    [localBusinesses],
  );
  const countryOptions = useMemo(
    () => getUniqueDisplayValues(mappedBusinesses.map((business) => business.country)),
    [mappedBusinesses],
  );
  const visibleCountryOptions = useMemo(
    () => getUniqueDisplayValues([selectedCountry, ...countryOptions]),
    [countryOptions, selectedCountry],
  );
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
    console.log(`Dashboard received ${localBusinesses.length} businesses`);
    console.log(`Dashboard mapped ${mappedBusinesses.length} businesses`);
  }, [localBusinesses.length, mappedBusinesses.length]);

  const [selectedBusinessId, setSelectedBusinessId] = useState(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
  const selectedBusiness =
    filteredBusinesses.find((business) => business.id === selectedBusinessId) ?? null;
  const selectedCategoryCount = selectedCategories.length;
  const activeFilterCount =
    selectedCategoryCount + (selectedCountry ? 1 : 0) + (selectedCity ? 1 : 0);
  const totalBusinessLabel = getCountLabel(supabaseBusinessCount, "Business", "Businesses");
  const totalActiveDealLabel = getCountLabel(
    supabaseDealCount,
    "Active deal",
    "Active deals",
  );
  const recommendedBusiness = useMemo(
    () =>
      filteredBusinesses.find((business) =>
        business.deals.some((deal) => deal.status === "active"),
      ) ??
      filteredBusinesses[0] ??
      null,
    [filteredBusinesses],
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
  }, []);
  const handleToggleCategory = useCallback(
    (category) => {
      const nextCategories = selectedCategories.includes(category)
        ? selectedCategories.filter((item) => item !== category)
        : [...selectedCategories, category];

      setSelectedCategories(nextCategories);
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
      if (!userId || pendingFavoriteId) {
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
        console.error("Favorite update failed", error);
        updateBusiness(business.id, (item) => ({
          ...item,
          isFavorite: !nextFavoriteState,
        }));
        setDashboardError("Unable to update saved businesses.");
      }

      setPendingFavoriteId(null);
    },
    [pendingFavoriteId, supabase, updateBusiness, userId],
  );

  const handleSubmitReview = useCallback(
    async (event) => {
      event.preventDefault();

      if (!selectedBusiness || !userId || isSavingReview) {
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
        console.error("Review save failed", error);
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
      selectedBusiness,
      supabase,
      updateBusiness,
      userId,
    ],
  );

  const handleSaveProfile = useCallback(
    async (event) => {
      event.preventDefault();
      setDashboardError(null);
      setProfileMessage(null);

      const formData = new FormData(event.currentTarget);
      const firstName = String(formData.get("first_name") ?? "").trim();
      const lastName = String(formData.get("last_name") ?? "").trim();
      const country = String(formData.get("country") ?? "").trim();
      const city = String(formData.get("city") ?? "").trim();
      const phone = normalizeProfilePhone(formData.get("phone"));
      const dateOfBirth = String(formData.get("date_of_birth") ?? "").trim() || null;
      const gender = String(formData.get("gender") ?? "").trim() || "Prefer not to say";
      const address = String(formData.get("address") ?? "").trim() || null;

      if (!firstName || !lastName || !country || !city) {
        setDashboardError("First name, last name, country, and city are required.");
        return;
      }

      if (!PROFILE_COUNTRIES.includes(country)) {
        setDashboardError("Choose a valid country.");
        return;
      }

      if (phone.error) {
        setDashboardError(phone.error);
        return;
      }

      setIsSavingProfile(true);
      const nextProfile = {
        ...localProfile,
        first_name: firstName,
        last_name: lastName,
        phone: phone.value,
        date_of_birth: dateOfBirth,
        gender,
        address,
        city,
        country,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("profiles")
        .update(nextProfile)
        .eq("id", userId);

      if (error) {
        console.error("Profile update failed", error);
        setDashboardError("Unable to save profile changes.");
      } else {
        setLocalProfile(nextProfile);
        setProfileMessage("Profile saved.");
      }

      setIsSavingProfile(false);
    },
    [localProfile, supabase, userId],
  );
  const handleLogout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout failed", error);
      setDashboardError("Unable to log out.");
      return;
    }

    window.location.assign("/");
  }, [supabase]);

  const activity = useMemo(
    () =>
      filteredBusinesses
        .flatMap((business) =>
          business.deals
            .filter((deal) => deal.status === "active")
            .map((deal) => ({
              id: deal.id,
              title: business.name,
              detail: deal.title,
              time: "Active",
              color: DEAL_STATUS_META.active.color,
            })),
        )
        .slice(0, 5),
    [filteredBusinesses],
  );

  const displayName =
    [localProfile?.first_name, localProfile?.last_name].filter(Boolean).join(" ") ||
    localProfile?.username ||
    userEmail?.split("@")[0] ||
    "explorer";
  const locationHeading = [localProfile?.city, localProfile?.country]
    .filter(Boolean)
    .join(", ");
  const cityHeading = locationHeading ? `${locationHeading} nearby` : "Nearby";
  const activeDeals = filteredBusinesses.reduce(
    (count, business) =>
      count + business.deals.filter((deal) => deal.status === "active").length,
    0,
  );
  const favoriteCount = filteredBusinesses.filter((business) => business.isFavorite).length;

  return (
    <main className="min-h-screen overflow-hidden bg-[#101217] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,122,89,0.28),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(51,214,166,0.2),transparent_30%),linear-gradient(180deg,#191d24_0%,#101217_46%,#0c0d11_100%)]" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-4 pb-28 pt-4">
        <header className="z-20 flex items-center justify-between gap-3 rounded-[28px] border border-white/12 bg-white/10 px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/55">
              Spotnera Live
            </p>
            <h1 className="mt-1 text-[1.55rem] font-semibold leading-tight tracking-tight">
              {cityHeading}
            </h1>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-sm font-bold text-zinc-950 shadow-[0_14px_35px_rgba(255,255,255,0.2)]">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
        </header>
        <Link
          href="/owner"
          className="z-20 mt-3 rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-center text-sm font-bold text-white/82 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur-2xl transition hover:bg-white/16"
        >
          Business owner dashboard
        </Link>

        <section className="z-20 mt-4 rounded-[28px] border border-white/12 bg-white/10 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search businesses..."
              className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none placeholder:text-white/38 focus:border-white/30"
            />
          </div>
          <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
            <label className="min-w-0">
              <span className="sr-only">Country</span>
              <select
                value={selectedCountry}
                onChange={handleSelectCountry}
                className="h-11 w-full rounded-2xl border border-white/10 bg-black/24 px-3 text-xs font-bold text-white outline-none focus:border-white/30"
              >
                <option value="">All countries</option>
                {visibleCountryOptions.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="sr-only">City</span>
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
              className="h-11 rounded-2xl border border-white/10 bg-white px-4 text-xs font-bold text-zinc-950 transition hover:bg-white/90"
            >
              Filters {activeFilterCount ? `(${activeFilterCount})` : ""}
            </button>
          </div>
          {areFiltersOpen ? (
            <div className="mt-3 rounded-[24px] border border-white/10 bg-zinc-950/54 p-3">
              <CategoryFilters
                selectedCategories={selectedCategories}
                onToggleCategory={handleToggleCategory}
                onSelectAll={handleSelectAllCategories}
              />
            </div>
          ) : null}
        </section>

        <div className="relative mt-4 h-[58vh] min-h-[440px] overflow-hidden rounded-[32px] border border-white/12 bg-white/8 shadow-[0_28px_90px_rgba(0,0,0,0.38)]">
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

          {token && mappedBusinesses.length ? (
            <StableMapboxMap
              businesses={filteredBusinesses}
              token={token}
              selectedBusiness={selectedBusiness}
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
            <div className="absolute bottom-4 left-4 right-4 z-10 rounded-[24px] border border-white/12 bg-zinc-950/62 p-4 text-sm font-semibold text-white/78 shadow-[0_22px_70px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
              No businesses match your filters.
            </div>
          ) : null}

          {selectedBusiness ? (
            <motion.div
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 130, damping: 18 }}
              className="absolute bottom-4 left-4 right-4 z-10 rounded-[28px] border border-white/14 bg-zinc-950/62 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
            >
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CategoryDot category={selectedBusiness.category} />
                    <p className="truncate text-xs font-semibold text-white/56">
                      {selectedBusiness.category}
                    </p>
                  </div>
                  <h2 className="mt-2 truncate text-xl font-semibold tracking-tight">
                    {selectedBusiness.name}
                  </h2>
                  <p className="mt-1 truncate text-sm font-semibold text-white/72">
                    {getActiveDeal(selectedBusiness.deals)?.title ?? "No active deal"}
                  </p>
                  <div className="mt-2">
                    <RatingLine
                      averageRating={selectedBusiness.averageRating}
                      reviewCount={selectedBusiness.reviewCount}
                    />
                  </div>
                  <BusinessAddress business={selectedBusiness} compact />
                  <ContactActions business={selectedBusiness} compact />
                  <SocialLinks business={selectedBusiness} compact />
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetailOpen(true)}
                  className="shrink-0 rounded-2xl bg-white px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-white/90"
                >
                  View details
                </button>
              </div>
            </motion.div>
          ) : recommendedBusiness ? (
            <motion.div
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 130, damping: 18 }}
              className="absolute bottom-4 left-4 right-4 z-10 rounded-[24px] border border-white/12 bg-zinc-950/48 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.36)] backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/44">
                    Best nearby
                  </p>
                  <h2 className="mt-1 truncate text-base font-semibold">
                    {recommendedBusiness.name}
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-white/56">
                    {getBusinessSignal(recommendedBusiness)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectBusiness(recommendedBusiness)}
                  className="rounded-2xl bg-white/12 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/18"
                >
                  View
                </button>
              </div>
            </motion.div>
          ) : null}
        </div>

        {selectedBusiness && isDetailOpen ? (
          <div className="fixed inset-0 z-40 flex items-end bg-black/56 px-4 pb-4 pt-16 backdrop-blur-sm sm:items-center sm:justify-center">
            <motion.section
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="max-h-[86vh] w-full max-w-[480px] overflow-y-auto rounded-[32px] border border-white/14 bg-[#151821] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.5)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="selected-business-title"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CategoryDot category={selectedBusiness.category} />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/48">
                      {selectedBusiness.category}
                    </p>
                  </div>
                  <h2
                    id="selected-business-title"
                    className="mt-2 text-2xl font-semibold tracking-tight"
                  >
                    {selectedBusiness.name}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close details"
                  onClick={() => setIsDetailOpen(false)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/8 text-lg font-bold text-white/72 transition hover:bg-white/14"
                >
                  X
                </button>
              </div>

              <div className="mt-4 rounded-[24px] border border-white/10 bg-white/8 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                  Active deal
                </p>
                <p className="mt-1 text-base font-semibold text-white">
                  {getActiveDeal(selectedBusiness.deals)?.title ?? "No active deal"}
                </p>
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
                  {selectedBusiness.is_active ? "Open listing" : "Hidden"}
                </span>
              </div>

              {selectedBusiness.description ? (
                <div className="mt-3 rounded-[24px] border border-white/10 bg-white/8 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                    About
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white/62">
                    {selectedBusiness.description}
                  </p>
                </div>
              ) : null}

              {getBusinessAddressLines(selectedBusiness).length ? (
                <div className="mt-3 rounded-[24px] border border-white/10 bg-white/8 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                    Location
                  </p>
                  <BusinessAddress business={selectedBusiness} />
                </div>
              ) : null}

              {getBusinessPhone(selectedBusiness) ||
              getBusinessEmail(selectedBusiness) ||
              getWebsiteUrl(selectedBusiness.website_url) ? (
                <div className="mt-3 rounded-[24px] border border-white/10 bg-white/8 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                    Contact
                  </p>
                  <ContactActions business={selectedBusiness} />
                </div>
              ) : null}

              {getBusinessSocialLinks(selectedBusiness).length ? (
                <div className="mt-3 rounded-[24px] border border-white/10 bg-white/8 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
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

              <form onSubmit={handleSubmitReview} className="mt-4 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex gap-1" aria-label="Rating">
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
                    className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingReview
                      ? "Saving"
                      : currentUserReview
                        ? "Update review"
                        : "Review"}
                  </button>
                </div>
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
                  className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/34 focus:border-white/28"
                />
              </form>
            </motion.section>
          </div>
        ) : null}

        <section className="mt-4">
          <div className="mb-3 flex items-end justify-between px-1">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/42">
                Businesses
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                Rated nearby
              </h2>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/62">
              {favoriteCount} saved
            </span>
          </div>
          <div className="grid gap-3">
            {filteredBusinesses.length ? (
              filteredBusinesses.map((business, index) => (
                <motion.article
                  key={business.id}
                  initial={{ x: 24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.04, duration: 0.32 }}
                  onClick={() => handleSelectBusiness(business)}
                  className={`flex cursor-pointer items-center gap-3 rounded-[24px] border p-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-2xl transition ${
                    selectedBusiness?.id === business.id
                      ? "border-white/24 bg-white/16"
                      : "border-white/10 bg-white/10 hover:bg-white/14"
                  }`}
                >
                  <span
                    className="h-12 w-1.5 rounded-full"
                    style={{ backgroundColor: business.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="truncate text-sm font-semibold">
                        {business.name}
                      </h3>
                      <span className="text-xs font-medium text-white/42">
                        {business.deals.length} deals
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-white/54">
                      {getBusinessSignal(business)}
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
                    onClick={(event) => {
                      event.stopPropagation();
                      handleToggleFavorite(business);
                    }}
                  />
                </motion.article>
              ))
            ) : (
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 text-sm text-white/58 backdrop-blur-2xl">
                No businesses match your search and filters.
              </div>
            )}
          </div>
        </section>

        <section className="mt-4">
          <div className="mb-3 flex items-end justify-between px-1">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/42">
                Live activity
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                Moving around you
              </h2>
            </div>
            <span className="rounded-full bg-[#33d6a6]/16 px-3 py-1 text-xs font-semibold text-[#72f0cc]">
              {activeDeals} active
            </span>
          </div>
          <div className="grid gap-3">
            {activity.length ? (
              activity.map((item, index) => (
                <motion.article
                  key={item.id}
                  initial={{ x: 24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.08, duration: 0.38 }}
                  className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/10 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.2)] backdrop-blur-2xl"
                >
                  <span
                    className="h-11 w-1.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="truncate text-sm font-semibold">
                        {item.title}
                      </h3>
                      <span className="text-xs font-medium text-white/42">
                        {item.time}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/58">
                      {item.detail}
                    </p>
                  </div>
                </motion.article>
              ))
            ) : (
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 text-sm text-white/58 backdrop-blur-2xl">
                No live business activity yet.
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-white/12 bg-white/10 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/42">
                Me
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                Profile
              </h2>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl border border-white/10 bg-white/8 px-4 py-2 text-xs font-bold text-white/78 transition hover:bg-white/14"
            >
              Log out
            </button>
          </div>
          <form onSubmit={handleSaveProfile} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">
                  First name
                </span>
                <input
                  name="first_name"
                  required
                  maxLength={80}
                  defaultValue={localProfile?.first_name ?? ""}
                  className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">
                  Last name
                </span>
                <input
                  name="last_name"
                  required
                  maxLength={80}
                  defaultValue={localProfile?.last_name ?? ""}
                  className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">
                  Country
                </span>
                <select
                  name="country"
                  required
                  defaultValue={localProfile?.country ?? ""}
                  className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30"
                >
                  <option value="" disabled>
                    Choose country
                  </option>
                  {PROFILE_COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">
                  City
                </span>
                <input
                  name="city"
                  required
                  maxLength={120}
                  defaultValue={localProfile?.city ?? ""}
                  className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30"
                />
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">
                Phone optional
              </span>
              <input
                type="tel"
                name="phone"
                maxLength={32}
                defaultValue={localProfile?.phone ?? ""}
                className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">
                  Date of birth optional
                </span>
                <input
                  type="date"
                  name="date_of_birth"
                  defaultValue={localProfile?.date_of_birth ?? ""}
                  className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">
                  Gender optional
                </span>
                <select
                  name="gender"
                  defaultValue={localProfile?.gender ?? "Prefer not to say"}
                  className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30"
                >
                  {GENDER_OPTIONS.map((gender) => (
                    <option key={gender} value={gender}>
                      {gender}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/42">
                Street address optional
              </span>
              <input
                name="address"
                maxLength={240}
                defaultValue={localProfile?.address ?? ""}
                className="h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-semibold text-white outline-none focus:border-white/30"
              />
            </label>
            {profileMessage ? (
              <p className="rounded-2xl border border-emerald-300/20 bg-emerald-500/14 px-3 py-2 text-sm font-semibold text-emerald-100">
                {profileMessage}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isSavingProfile}
              className="h-11 rounded-2xl bg-white px-4 text-sm font-bold text-zinc-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingProfile ? "Saving..." : "Save changes"}
            </button>
          </form>
        </section>

        <nav className="fixed bottom-4 left-1/2 z-30 grid w-[min(92vw,430px)] -translate-x-1/2 grid-cols-4 rounded-[28px] border border-white/14 bg-zinc-950/62 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
          {navItems.map((item, index) => (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              className={`flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition ${
                index === 0
                  ? "bg-white text-zinc-950 shadow-[0_10px_26px_rgba(255,255,255,0.18)]"
                  : "text-white/56 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon path={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}
