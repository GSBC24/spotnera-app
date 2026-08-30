"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

const SEARCHBOX_SUGGEST_ENDPOINT = "https://api.mapbox.com/search/searchbox/v1/suggest";
const SEARCHBOX_RETRIEVE_ENDPOINT = "https://api.mapbox.com/search/searchbox/v1/retrieve";
const SEARCHBOX_TYPES = "address,poi,street,place,locality,neighborhood,postcode";

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

function getContextName(context, key) {
  const value = context?.[key];

  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return value.name || "";
}

function getFeatureCity(feature, fallback) {
  const context = feature?.properties?.context ?? fallback?.context;

  return (
    getContextName(context, "place") ||
    getContextName(context, "locality") ||
    getContextName(context, "district") ||
    ""
  );
}

function getFeatureCountry(feature, fallback) {
  const context = feature?.properties?.context ?? fallback?.context;

  return getContextName(context, "country");
}

async function readMapboxError(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await response.json().catch(() => null);
    return body?.message || body?.error || JSON.stringify(body);
  }

  return response.text().catch(() => "");
}

function getMapboxToken() {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? "";
}

function getTokenConfigurationError(token) {
  if (!token) {
    return "Address search is unavailable because Mapbox is not configured.";
  }

  if (!token.startsWith("pk.")) {
    return "Address search is unavailable because the Mapbox public token is not configured correctly.";
  }

  if (/\s/.test(token)) {
    return "Address search is unavailable because the Mapbox token contains whitespace.";
  }

  return "";
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

function createMapboxError(endpointName, response, apiMessage) {
  const detail = [
    `Mapbox ${endpointName} failed with HTTP ${response.status} ${response.statusText || ""}`.trim(),
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

function getUserFacingError(error, fallback) {
  if (error.status === 401) {
    return "Address search is unavailable because the Mapbox token was rejected.";
  }

  if (error.status === 403) {
    return "Address search is unavailable because Mapbox access is restricted for this site.";
  }

  if (error.status >= 400) {
    return fallback;
  }

  return "Address search is temporarily unavailable. Check your connection and try again.";
}

function logMapboxError(endpointName, endpoint, error, params) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.error(`Mapbox address autocomplete ${endpointName} failed`, {
    status: error.status,
    statusText: error.statusText,
    apiMessage: error.apiMessage,
    hint: error.status ? getSuggestFailureHint(error.status) : undefined,
    endpoint,
    params,
  });
}

export default function AddressAutocomplete({
  defaultAddress = "",
  defaultLatitude = "",
  defaultLongitude = "",
}) {
  const token = getMapboxToken();
  const tokenConfigurationError = getTokenConfigurationError(token);
  const listboxId = useId();
  const searchAbortRef = useRef(null);
  const [query, setQuery] = useState(defaultAddress);
  const [selectedAddress, setSelectedAddress] = useState(defaultAddress);
  const [latitude, setLatitude] = useState(defaultLatitude ?? "");
  const [longitude, setLongitude] = useState(defaultLongitude ?? "");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
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
    if (tokenConfigurationError) {
      return tokenConfigurationError;
    }

    if (hasSelectedAddress) {
      return "Address selected";
    }

    if (query.trim().length >= 3) {
      return "Choose a suggestion to save map coordinates.";
    }

    return "Start typing, then choose a suggestion.";
  }, [hasSelectedAddress, query, tokenConfigurationError]);

  useEffect(() => {
    if (tokenConfigurationError) {
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
        types: SEARCHBOX_TYPES,
      });

      const loggedParams = {
        q: trimmedQuery,
        session_token: sessionToken,
        language: "en",
        limit: "5",
        proximity: "ip",
        types: SEARCHBOX_TYPES,
      };

      try {
        const response = await fetch(`${SEARCHBOX_SUGGEST_ENDPOINT}?${params}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const apiMessage = await readMapboxError(response);
          throw createMapboxError("/suggest", response, apiMessage);
        }

        const data = await response.json();
        const nextSuggestions = data.suggestions ?? [];
        setSuggestions(nextSuggestions);

        if (!nextSuggestions.length) {
          setError("No address results found. Try a more specific address.");
        }
      } catch (fetchError) {
        if (fetchError.name !== "AbortError") {
          setSuggestions([]);
          logMapboxError("/suggest", SEARCHBOX_SUGGEST_ENDPOINT, fetchError, loggedParams);

          setError(
            getUserFacingError(
              fetchError,
              "Address search is temporarily unavailable. Try again in a moment.",
            ),
          );
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query, selectedAddress, sessionToken, token, tokenConfigurationError]);

  function handleAddressChange(event) {
    setQuery(event.target.value);
    setSelectedAddress("");
    setLatitude("");
    setLongitude("");
    setSelectedCity("");
    setSelectedCountry("");
    setSuggestions([]);
    setIsLoading(false);
    setError("");
  }

  async function handleSelectSuggestion(suggestion) {
    if (tokenConfigurationError) {
      setError(tokenConfigurationError);
      return;
    }

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

    const loggedParams = {
      session_token: sessionToken,
      language: "en",
    };
    const retrieveUrl = `${SEARCHBOX_RETRIEVE_ENDPOINT}/${encodeURIComponent(
      suggestion.mapbox_id,
    )}`;

    try {
      const response = await fetch(`${retrieveUrl}?${params}`);

      if (!response.ok) {
        const apiMessage = await readMapboxError(response);
        throw createMapboxError("/retrieve", response, apiMessage);
      }

      const data = await response.json();
      const feature = data.features?.[0];
      const coordinates = feature?.geometry?.coordinates;

      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        throw new Error("The selected address did not include map coordinates.");
      }

      const formattedAddress = getFeatureAddress(feature, suggestion);
      const featureCity = getFeatureCity(feature, suggestion);
      const featureCountry = getFeatureCountry(feature, suggestion);
      const [nextLongitude, nextLatitude] = coordinates;

      setQuery(formattedAddress);
      setSelectedAddress(formattedAddress);
      setLatitude(String(nextLatitude));
      setLongitude(String(nextLongitude));
      setSelectedCity(featureCity);
      setSelectedCountry(featureCountry);
      setSuggestions([]);
      setSessionToken(createSessionToken());
    } catch (retrieveError) {
      logMapboxError("/retrieve", retrieveUrl, retrieveError, loggedParams);
      setError(
        getUserFacingError(
          retrieveError,
          "Address details are temporarily unavailable. Try another suggestion.",
        ),
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
      <input type="hidden" name="selected_city" value={selectedCity} />
      <input type="hidden" name="selected_country" value={selectedCountry} />
      <input type="hidden" name="latitude" value={latitude} />
      <input type="hidden" name="longitude" value={longitude} />

      {hasSelectedAddress && (selectedCity || selectedCountry) ? (
        <p className="text-xs font-medium text-zinc-500">
          Mapbox matched {[selectedCity, selectedCountry].filter(Boolean).join(", ")}
        </p>
      ) : null}

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
