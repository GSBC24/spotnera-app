"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export function BusinessProfileMap({ latitude, longitude, name }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
  const hasLocation =
    Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));

  useEffect(() => {
    if (!token || !hasLocation || !mapContainerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [Number(longitude), Number(latitude)],
      zoom: 14,
      interactive: true,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    const marker = document.createElement("div");
    marker.className =
      "h-5 w-5 rounded-full border-2 border-white bg-[#33d6a6] shadow-[0_0_0_8px_rgba(51,214,166,0.22),0_14px_30px_rgba(0,0,0,0.35)]";
    marker.setAttribute("aria-label", name);

    new mapboxgl.Marker({ element: marker })
      .setLngLat([Number(longitude), Number(latitude)])
      .addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [hasLocation, latitude, longitude, name, token]);

  if (!hasLocation) {
    return (
      <div className="grid min-h-56 place-items-center rounded-[28px] border border-white/10 bg-white/8 p-6 text-center">
        <p className="text-sm font-semibold text-white/64">
          Location coordinates are not available yet.
        </p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/8 p-5">
        <p className="text-sm font-semibold text-white">Map location</p>
        <p className="mt-2 text-sm text-white/62">
          {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      aria-label={`${name} map location`}
      className="h-72 overflow-hidden rounded-[28px] border border-white/12 bg-white/8 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:h-80"
    />
  );
}
