"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

function createSessionToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSuggestionLabel(suggestion) {
  return suggestion.full_address || suggestion.name || "";
}

function getSuggestionContext(suggestion) {
  return suggestion.place_formatted || suggestion.address || suggestion.full_address || "";
}

function getFeatureAddress(feature, fallback) {
  const properties = feature?.properties ?? {};
  const name = properties.name || fallback?.name || "";
  const context = properties.full_address || properties.place_formatted || fallback?.place_formatted || "";

  if (properties.full_address) {
    return properties.full_address;
  }

  return [name, context].filter(Boolean).join(", ");
}

async function readMapboxError(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await response.json().catch(() => null);
    return body?.message || body?.error || JSON.stringify(body);
  }

  return response.text().catch(() => "");
}

function getSuggestFailureHint(status) {
  if (status === 400) {
    return "Check Search Box request parameters.";
  }

  if (status === 401) {
    return "Check that NEXT_PUBLIC_MAPBOX_TOKEN is valid.";
  }

  if (status === 403) {
    return "Check token URL restrictions, account access, and Search Box API permission.";
  }

  return "Check Mapbox service availability and token configuration.";
}

function createSuggestError(response, apiMessage) {
  const detail = [
    `Mapbox /suggest failed with HTTP ${response.status} ${response.statusText || ""}`.trim(),
    apiMessage ? `API message: ${apiMessage}` : null,
    getSuggestFailureHint(response.status),
  ]
    .filter(Boolean)
    .join(" ");

  const error = new Error(detail);
  error.status = response.status;
  error.statusText = response.statusText;
  error.apiMessage = apiMessage;
  return error;
}

export default function AddressAutocomplete({
  defaultAddress = "",
  defaultLatitude = "",
  defaultLongitude = "",
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const listboxId = useId();
  const searchAbortRef = useRef(null);
  const [query, setQuery] = useState(defaultAddress);
  const [selectedAddress, setSelectedAddress] = useState(defaultAddress);
  const [latitude, setLatitude] = useState(defaultLatitude ?? "");
  const [longitude, setLongitude] = useState(defaultLongitude ?? "");
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionToken, setSessionToken] = useState(createSessionToken);

  const hasSelectedAddress =
    selectedAddress &&
    query === selectedAddress &&
    latitude !== "" &&
    longitude !== "";

  const statusText = useMemo(() => {
    if (!token) {
      return "Address search is unavailable because Mapbox is not configured.";
    }

    if (hasSelectedAddress) {
      return "Address selected";
    }

    if (query.trim().length >= 3) {
      return "Choose a suggestion to save map coordinates.";
    }

    return "Start typing, then choose a suggestion.";
  }, [hasSelectedAddress, query, token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const trimmedQuery = query.trim();

    if (!trimmedQuery || trimmedQuery === selectedAddress || trimmedQuery.length < 3) {
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setIsLoading(true);
      setError("");

      const params = new URLSearchParams({
        q: trimmedQuery,
        access_token: token,
        session_token: sessionToken,
        language: "en",
        limit: "5",
        proximity: "ip",
        types: "address,poi,street,place,locality,neighborhood,postcode",
      });

      try {
        const response = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          const apiMessage = await readMapboxError(response);
          throw createSuggestError(response, apiMessage);
        }

        const data = await response.json();
        setSuggestions(data.suggestions ?? []);
      } catch (fetchError) {
        if (fetchError.name !== "AbortError") {
          setSuggestions([]);
          if (process.env.NODE_ENV !== "production") {
            console.error("Mapbox address autocomplete /suggest failed", {
              status: fetchError.status,
              statusText: fetchError.statusText,
              apiMessage: fetchError.apiMessage,
              hint: fetchError.status ? getSuggestFailureHint(fetchError.status) : undefined,
              endpoint: "https://api.mapbox.com/search/searchbox/v1/suggest",
              params: {
                q: trimmedQuery,
                session_token: sessionToken,
                language: "en",
                limit: "5",
                proximity: "ip",
                types: "address,poi,street,place,locality,neighborhood,postcode",
              },
            });
          }

          setError(
            process.env.NODE_ENV === "production"
              ? "Address search is temporarily unavailable. Try again in a moment."
              : fetchError.message ||
                  "Address search is temporarily unavailable. Try again in a moment.",
          );
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query, selectedAddress, sessionToken, token]);

  function handleAddressChange(event) {
    setQuery(event.target.value);
    setSelectedAddress("");
    setLatitude("");
    setLongitude("");
    setSuggestions([]);
    setIsLoading(false);
    setError("");
  }

  async function handleSelectSuggestion(suggestion) {
    if (!suggestion.mapbox_id) {
      setError("Choose a complete Mapbox address suggestion.");
      return;
    }

    setIsLoading(true);
    setError("");

    const params = new URLSearchParams({
      access_token: token,
      session_token: sessionToken,
      language: "en",
    });

    try {
      const response = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(
          suggestion.mapbox_id,
        )}?${params}`,
      );

      if (!response.ok) {
        throw new Error("Address details are temporarily unavailable.");
      }

      const data = await response.json();
      const feature = data.features?.[0];
      const coordinates = feature?.geometry?.coordinates;

      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        throw new Error("The selected address did not include map coordinates.");
      }

      const formattedAddress = getFeatureAddress(feature, suggestion);
      const [nextLongitude, nextLatitude] = coordinates;

      setQuery(formattedAddress);
      setSelectedAddress(formattedAddress);
      setLatitude(String(nextLatitude));
      setLongitude(String(nextLongitude));
      setSuggestions([]);
      setSessionToken(createSessionToken());
    } catch (retrieveError) {
      setError(
        retrieveError.message ||
          "Address details are temporarily unavailable. Try another suggestion.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-1.5">
      <label className="grid gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
          Address
        </span>
        <div className="relative">
          <input
            name="address"
            required
            value={query}
            onChange={handleAddressChange}
            autoComplete="street-address"
            role="combobox"
            aria-controls={listboxId}
            aria-expanded={suggestions.length > 0}
            aria-autocomplete="list"
            placeholder="Search for your business address"
            className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-3 pr-10 text-sm font-medium text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/10"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
            {isLoading ? "..." : hasSelectedAddress ? "OK" : "Search"}
          </span>

          {suggestions.length ? (
            <div
              id={listboxId}
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-72 overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-1.5 shadow-[0_24px_60px_rgba(24,24,27,0.16)]"
            >
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.mapbox_id}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="grid w-full gap-0.5 rounded-2xl px-3 py-2.5 text-left transition hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none"
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  <span className="text-sm font-bold text-zinc-950">
                    {getSuggestionLabel(suggestion)}
                  </span>
                  <span className="text-xs font-medium leading-5 text-zinc-500">
                    {getSuggestionContext(suggestion)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </label>

      <input type="hidden" name="selected_address" value={selectedAddress} />
      <input type="hidden" name="latitude" value={latitude} />
      <input type="hidden" name="longitude" value={longitude} />

      <p
        className={`text-xs font-semibold ${
          error ? "text-red-600" : hasSelectedAddress ? "text-emerald-700" : "text-zinc-500"
        }`}
      >
        {error || statusText}
      </p>
    </div>
  );
}
