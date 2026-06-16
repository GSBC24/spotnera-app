"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createClient } from "@/utils/supabase/browser";

const CATEGORY_COLORS = {
  art: "#8ea7ff",
  cafe: "#ff7a59",
  coffee: "#ff7a59",
  culture: "#b692ff",
  dining: "#ffd166",
  family: "#7dd3fc",
  food: "#ffd166",
  nightlife: "#8ea7ff",
  outdoors: "#72f0cc",
  retail: "#33d6a6",
  sports: "#f472b6",
  tech: "#67e8f9",
  travel: "#fb923c",
  wellness: "#a3e635",
};

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

function getCategoryColor(category) {
  const normalized = category?.trim().toLowerCase();

  if (CATEGORY_COLORS[normalized]) {
    return CATEGORY_COLORS[normalized];
  }

  const palette = Object.values(CATEGORY_COLORS);
  const hash = [...(normalized || "spotnera")].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );

  return palette[hash % palette.length];
}

function getPrimaryDeal(deals = []) {
  return [...deals].sort((left, right) => {
    const leftRank = DEAL_STATUS_META[left.status]?.rank ?? 9;
    const rightRank = DEAL_STATUS_META[right.status]?.rank ?? 9;

    return leftRank - rightRank;
  })[0];
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
      latitude: Number(business.latitude),
      longitude: Number(business.longitude),
      deals: business.deals ?? [],
      reviews: business.reviews ?? [],
      reviewCount: business.reviews?.length ?? 0,
      averageRating: getAverageRating(business.reviews ?? []),
      isFavorite: Boolean(business.isFavorite),
      color: getCategoryColor(business.category),
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
    "spotnera-map-marker relative grid h-11 w-11 place-items-center rounded-full border border-white/70 bg-white/20 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:scale-105";

  const pulse = document.createElement("span");
  pulse.className = "absolute h-11 w-11 animate-ping rounded-full opacity-25";
  pulse.style.backgroundColor = business.color;

  const dot = document.createElement("span");
  dot.className = "relative h-4 w-4 rounded-full border-2 border-white";
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

  marker.append(pulse, dot, statusDot, label);
  return marker;
}

function buildPopupContent(business) {
  const status = getDealStatusMeta(business);
  const deal = getPrimaryDeal(business.deals);
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
  rating.textContent = `${formatRating(business.averageRating)} rating · ${business.reviewCount} reviews`;

  content.append(category, name, signal, rating);
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

function StableMapboxMap({ businesses, token, selectedBusiness, onSelectBusiness }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const markersRef = useRef(new Map());

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current || !businesses.length) {
      return undefined;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [businesses[0].longitude, businesses[0].latitude],
      zoom: 14,
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
    const markers = new Map();
    markersRef.current = markers;

    businesses.forEach((business) => {
      const element = buildMarkerElement(business, false);
      element.addEventListener("click", () => onSelectBusiness(business));

      const marker = new mapboxgl.Marker({
        anchor: "center",
        element,
      })
        .setLngLat([business.longitude, business.latitude])
        .addTo(map);

      markers.set(business.id, { element, marker });
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    map.once("load", () => map.resize());

    return () => {
      resizeObserver.disconnect();
      popup.remove();
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      markersRef.current = new Map();

      if (mapRef.current === map) {
        mapRef.current = null;
      }

      map.remove();
    };
  }, [businesses, onSelectBusiness, token]);

  useEffect(() => {
    const map = mapRef.current;
    const popup = popupRef.current;

    if (!map || !popup || !selectedBusiness) {
      return;
    }

    markersRef.current.forEach(({ element }, businessId) => {
      const label = element.querySelector(".spotnera-marker-label");
      if (label) {
        label.hidden = businessId !== selectedBusiness.id;
      }
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
  const [localBusinesses, setLocalBusinesses] = useState(() => businesses);
  const [pendingFavoriteId, setPendingFavoriteId] = useState(null);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const mappedBusinesses = useMemo(
    () => normalizeBusinesses(localBusinesses),
    [localBusinesses],
  );

  useEffect(() => {
    console.log(`Dashboard received ${localBusinesses.length} businesses`);
    console.log(`Dashboard mapped ${mappedBusinesses.length} businesses`);
  }, [localBusinesses, mappedBusinesses]);

  const [selectedBusinessId, setSelectedBusinessId] = useState(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const selectedBusiness =
    mappedBusinesses.find((business) => business.id === selectedBusinessId) ??
    mappedBusinesses[0] ??
    null;
  const handleSelectBusiness = useCallback((business) => {
    setSelectedBusinessId(business.id);
  }, []);

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
        updateBusiness(business.id, (item) => ({
          ...item,
          isFavorite: !nextFavoriteState,
        }));
        setDashboardError(error.message);
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
        setDashboardError(error.message);
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

  const activity = useMemo(
    () =>
      mappedBusinesses
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
    [mappedBusinesses],
  );

  const displayName = profile?.username || userEmail?.split("@")[0] || "explorer";
  const cityHeading = profile?.city ? `${profile.city} nearby` : "Nearby";
  const interests =
    Array.isArray(profile?.interests) && profile.interests.length
      ? profile.interests.slice(0, 3)
      : [];
  const activeDeals = mappedBusinesses.reduce(
    (count, business) =>
      count + business.deals.filter((deal) => deal.status === "active").length,
    0,
  );
  const favoriteCount = mappedBusinesses.filter((business) => business.isFavorite).length;

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

        <div className="relative mt-4 h-[58vh] min-h-[440px] overflow-hidden rounded-[32px] border border-white/12 bg-white/8 shadow-[0_28px_90px_rgba(0,0,0,0.38)]">
          <div className="absolute left-4 right-4 top-4 z-10 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/14 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white/85 backdrop-blur-xl">
              Supabase businesses: {supabaseBusinessCount}
            </span>
            <span className="rounded-full border border-white/14 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white/85 backdrop-blur-xl">
              Supabase deals: {supabaseDealCount}
            </span>
          </div>

          {queryErrors.length ? (
            <div className="absolute left-4 right-4 top-14 z-10 grid gap-2">
              {queryErrors.map((error) => (
                <div
                  key={error.query}
                  className="rounded-2xl border border-red-300/30 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-50 backdrop-blur-xl"
                >
                  <div className="uppercase tracking-[0.18em] text-red-100/80">
                    {error.query}Error.message
                  </div>
                  <div className="mt-1 font-medium text-red-50">
                    {error.message}
                  </div>
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
              Query errors: {queryErrors.length}
            </span>
          ) : null}

          {token && selectedBusiness ? (
            <StableMapboxMap
              businesses={mappedBusinesses}
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
                    : "Create active businesses in Supabase to render live markers on the map."}
                </p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/35 to-transparent" />
          {interests.length ? (
            <div className="absolute left-4 right-4 top-14 z-10 flex items-center gap-2">
              {interests.map((interest) => (
                <span
                  key={interest}
                  className="rounded-full border border-white/14 bg-black/24 px-3 py-1.5 text-xs font-semibold text-white/85 backdrop-blur-xl"
                >
                  {interest}
                </span>
              ))}
            </div>
          ) : null}

          {selectedBusiness ? (
            <motion.div
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 130, damping: 18 }}
              className="absolute bottom-4 left-4 right-4 rounded-[28px] border border-white/14 bg-zinc-950/44 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/48">
                    Best signal
                  </p>
                  <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">
                    {selectedBusiness.name}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-white/62">
                    {getBusinessSignal(selectedBusiness)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <RatingPill
                      averageRating={selectedBusiness.averageRating}
                      reviewCount={selectedBusiness.reviewCount}
                    />
                    <span className="rounded-full border border-white/12 bg-black/24 px-3 py-1.5 text-xs font-semibold text-white/66">
                      {selectedBusiness.category}
                    </span>
                  </div>
                </div>
                <FavoriteButton
                  isFavorite={selectedBusiness.isFavorite}
                  disabled={pendingFavoriteId === selectedBusiness.id}
                  onClick={() => handleToggleFavorite(selectedBusiness)}
                />
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
                        ★
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingReview}
                    className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingReview ? "Saving" : currentUserReview ? "Update" : "Review"}
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
                  rows={2}
                  placeholder="Share a quick note"
                  className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/34 focus:border-white/28"
                />
              </form>
            </motion.div>
          ) : null}
        </div>

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
            {mappedBusinesses.map((business, index) => (
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
                    <span className="rounded-full border border-white/10 bg-black/18 px-3 py-1.5 text-xs font-semibold text-white/54">
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
            ))}
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
