"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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

function Icon({ path }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="currentColor" d={path} />
    </svg>
  );
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

  content.append(category, name, signal);
  return content;
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

export function SpotneraDashboard({ businesses = [], profile, userEmail }) {
  const mappedBusinesses = useMemo(
    () => normalizeBusinesses(businesses),
    [businesses],
  );
  const [selectedBusinessId, setSelectedBusinessId] = useState(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const selectedBusiness =
    mappedBusinesses.find((business) => business.id === selectedBusinessId) ??
    mappedBusinesses[0] ??
    null;
  const handleSelectBusiness = useCallback((business) => {
    setSelectedBusinessId(business.id);
  }, []);

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
            <div className="absolute left-4 right-4 top-4 flex items-center gap-2">
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
                </div>
                <div className="rounded-2xl bg-white px-3 py-2 text-center text-zinc-950">
                  <p className="text-lg font-black leading-none">
                    {selectedBusiness.deals.length}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-zinc-500">
                    Deals
                  </p>
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>

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
