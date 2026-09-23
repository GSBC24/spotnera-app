import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import AddressAutocomplete from "./address-autocomplete";
import { CopyProfileLinkButton } from "@/components/copy-profile-link-button";
import { BusinessQrCode } from "@/components/business-qr-code";
import { DealAvailabilityFields } from "@/components/deal-availability-fields";
import { DeleteBusinessButton } from "@/components/delete-business-button";
import {
  DealDateTimeInput,
} from "@/components/deal-date-time-input";
import {
  DealAvailabilityLabel,
  DealTimeLabel,
} from "@/components/deal-time-label";
import { HeaderLogout } from "@/components/header-logout";
import { SpotneraBottomNav } from "@/components/spotnera-bottom-nav";
import {
  AnalyticsForm,
  LockedFormSubmitButton,
  OwnerDashboardAnalytics,
} from "@/components/owner-analytics";
import { BUSINESS_CATEGORY_LABELS, getBusinessCategoryConfig, isKnownBusinessCategory } from "@/lib/business-categories";
import { getBusinessPath } from "@/lib/business-url";
import { PROMOTION_TYPE_VALUES } from "@/lib/promotions";
import {
  SUPPORTED_COUNTRIES,
  isSupportedCountry,
} from "@/lib/supported-countries";
import {
  DEAL_STATUS,
  DEAL_STATUS_META,
  DEAL_AVAILABILITY_MODE,
  DEAL_WEEKDAYS,
  DEFAULT_DEAL_AVAILABILITY_TIMEZONE,
  getDealStatus,
  getLiveDeals,
  sortDealsByComputedStatus,
} from "@/lib/deals";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

const BUSINESS_FIELDS = `
  id,
  slug,
  owner_id,
  name,
  category,
  country,
  description,
  city,
  address,
  phone,
  email,
  website_url,
  facebook_url,
  instagram_url,
  tiktok_url,
  snapchat_url,
  latitude,
  longitude,
  logo_url,
  cover_image_url,
  is_active,
  created_at,
  updated_at
`;

const DEAL_FIELDS = `
  id,
  business_id,
  owner_id,
  title,
  description,
  promotion_type,
  status,
  is_active,
  starts_at,
  ends_at,
  availability_mode,
  availability_timezone,
  created_at,
  updated_at,
  deal_schedules (
    id,
    day_of_week,
    start_time,
    end_time,
    spans_midnight
  )
`;

const REVIEW_FIELDS = `
  id,
  business_id,
  rating,
  comment,
  created_at
`;

const ANALYTICS_RANGES = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
];

const OWNER_SECTIONS = ["overview", "businesses", "deals", "analytics", "reviews"];

const BUSINESS_ANALYTICS_METRICS = [
  {
    key: "profile_view",
    label: "Profile views",
    description: "Customers opened your Spotnera profile.",
  },
  {
    key: "deal_view",
    label: "Deal views",
    description: "Customers opened or viewed your live deal.",
  },
  {
    key: "website_click",
    label: "Website clicks",
    description: "Customers opened your website from Spotnera.",
  },
  {
    key: "call_click",
    label: "Call clicks",
    description: "Customers tapped Call.",
  },
  {
    key: "email_click",
    label: "Email clicks",
    description: "Customers tapped Email.",
  },
  {
    key: "social_click",
    label: "Social clicks",
    description: "Customers opened your social links.",
  },
  {
    key: "business_share",
    label: "Shares",
    description: "Customers used the share action.",
  },
  {
    key: "business_link_copy",
    label: "Copy link actions",
    description: "Customers copied your profile link.",
  },
];

function getString(formData, key) {
  return String(formData.get(key) ?? "").trim();
}

function getNullableString(formData, key) {
  const value = getString(formData, key);
  return value || null;
}

function getNumber(formData, key) {
  const rawValue = getString(formData, key);

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function getNullableTimestamp(formData, key) {
  const value = getString(formData, key);

  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return { error: "Enter a valid date and time." };
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return { error: "Enter a valid date and time." };
  }

  return { value: date.toISOString() };
}

function normalizeBusinessEmail(value) {
  const email = String(value ?? "").trim();

  if (!email) {
    return { value: null };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid public business email address." };
  }

  return { value: email };
}

function normalizeBusinessPhone(value) {
  const phone = String(value ?? "").trim().replace(/\s+/g, " ");

  if (!phone) {
    return { value: null };
  }

  if (!/^\+?[0-9][0-9\s().-]{5,24}$/.test(phone)) {
    return { error: "Enter a valid public business phone number." };
  }

  return { value: phone };
}

function normalizeWebsiteUrl(value) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return { value: null };
  }

  const urlCandidate = /^[a-z][a-z\d+.-]*:/i.test(rawValue)
    ? rawValue
    : `https://${rawValue}`;

  try {
    const url = new URL(urlCandidate);

    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) {
      return { error: "Enter a valid business website." };
    }

    return { value: url.toString() };
  } catch {
    return { error: "Enter a valid business website." };
  }
}

function normalizeSocialProfile(value, platform) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return { value: null };
  }

  const platformConfig = {
    facebook: {
      label: "Facebook",
      hosts: ["facebook.com", "www.facebook.com", "fb.com", "www.fb.com"],
      buildUrl: (handle) => `https://www.facebook.com/${handle}`,
      handlePattern: /^[A-Za-z0-9.]{3,80}$/,
    },
    instagram: {
      label: "Instagram",
      hosts: ["instagram.com", "www.instagram.com"],
      buildUrl: (handle) => `https://www.instagram.com/${handle}`,
      handlePattern: /^[A-Za-z0-9._]{1,30}$/,
    },
    tiktok: {
      label: "TikTok",
      hosts: ["tiktok.com", "www.tiktok.com"],
      buildUrl: (handle) => `https://www.tiktok.com/@${handle}`,
      handlePattern: /^[A-Za-z0-9._]{2,24}$/,
    },
    snapchat: {
      label: "Snapchat",
      hosts: ["snapchat.com", "www.snapchat.com"],
      buildUrl: (handle) => `https://www.snapchat.com/add/${handle}`,
      handlePattern: /^[A-Za-z0-9._-]{3,30}$/,
    },
  }[platform];

  const lowerRawValue = rawValue.toLowerCase();
  const schemelessUrl = platformConfig.hosts.some(
    (host) => lowerRawValue === host || lowerRawValue.startsWith(`${host}/`),
  );
  const urlCandidate = schemelessUrl ? `https://${rawValue}` : rawValue;

  try {
    const url = new URL(urlCandidate);
    const host = url.hostname.toLowerCase();

    if (!["http:", "https:"].includes(url.protocol) || !platformConfig.hosts.includes(host)) {
      return { error: `Enter a valid ${platformConfig.label} profile link.` };
    }

    if (!url.pathname.split("/").filter(Boolean).length) {
      return { error: `Enter a valid ${platformConfig.label} profile link.` };
    }

    return { value: url.toString() };
  } catch {
    const handle = rawValue
      .replace(/^@+/, "")
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean)[0];

    if (!handle || !platformConfig.handlePattern.test(handle)) {
      return {
        error: `Enter a valid ${platformConfig.label} username or profile link.`,
      };
    }

    return { value: platformConfig.buildUrl(handle) };
  }
}

function normalizeComparable(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("en")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getAverageRating(reviews) {
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

function getAnalyticsRange(value) {
  return ANALYTICS_RANGES.find((range) => range.key === value) ?? ANALYTICS_RANGES[1];
}

function formatMetricValue(value) {
  return Number(value || 0).toLocaleString("en");
}

function getEmptyEventCounts() {
  return Object.fromEntries(BUSINESS_ANALYTICS_METRICS.map((metric) => [metric.key, 0]));
}

function buildEventAnalytics(eventRows = []) {
  const analyticsByBusinessId = new Map();

  for (const row of eventRows) {
    if (!analyticsByBusinessId.has(row.business_id)) {
      analyticsByBusinessId.set(row.business_id, {
        counts: getEmptyEventCounts(),
        dailyTotals: new Map(),
      });
    }

    const analytics = analyticsByBusinessId.get(row.business_id);
    const count = Number(row.event_count || 0);
    analytics.counts[row.event_type] = (analytics.counts[row.event_type] ?? 0) + count;
    analytics.dailyTotals.set(
      row.event_date,
      (analytics.dailyTotals.get(row.event_date) ?? 0) + count,
    );
  }

  return analyticsByBusinessId;
}

function buildChartPoints(dailyTotals) {
  return [...dailyTotals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, count }));
}

function EngagementChart({ points }) {
  if (!points.length) {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-zinc-200 bg-white/70 p-3 text-xs font-semibold text-zinc-500">
        No customer activity yet.
      </div>
    );
  }

  const maxCount = Math.max(...points.map((point) => point.count), 1);

  return (
    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white/80 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
          Engagement over time
        </p>
        <p className="text-[10px] font-bold text-zinc-400">{points.length} days</p>
      </div>
      <div className="flex h-20 items-end gap-1" aria-label="Daily engagement events">
        {points.map((point) => (
          <div
            key={point.date}
            title={`${point.date}: ${point.count}`}
            className="min-w-1 flex-1 rounded-t bg-[#33d6a6]"
            style={{ height: `${Math.max(8, (point.count / maxCount) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function buildBusinessPayload(formData, userId) {
  const address = getNullableString(formData, "address");
  const phone = normalizeBusinessPhone(formData.get("phone"));
  const email = normalizeBusinessEmail(formData.get("email"));
  const website = normalizeWebsiteUrl(formData.get("website_url"));
  const facebook = normalizeSocialProfile(formData.get("facebook_url"), "facebook");
  const instagram = normalizeSocialProfile(formData.get("instagram_url"), "instagram");
  const tiktok = normalizeSocialProfile(formData.get("tiktok_url"), "tiktok");
  const snapchat = normalizeSocialProfile(formData.get("snapchat_url"), "snapchat");

  return {
    owner_id: userId,
    name: getString(formData, "name"),
    category: getString(formData, "category"),
    country: getString(formData, "country"),
    description: getNullableString(formData, "description"),
    city: getString(formData, "city"),
    address,
    phone: phone.value,
    email: email.value,
    website_url: website.value,
    facebook_url: facebook.value,
    instagram_url: instagram.value,
    tiktok_url: tiktok.value,
    snapchat_url: snapchat.value,
    fieldErrors: [
      phone.error,
      email.error,
      website.error,
      facebook.error,
      instagram.error,
      tiktok.error,
      snapchat.error,
    ].filter(Boolean),
    selected_address: getNullableString(formData, "selected_address"),
    selected_country: getNullableString(formData, "selected_country"),
    selected_city: getNullableString(formData, "selected_city"),
    latitude: getNumber(formData, "latitude"),
    longitude: getNumber(formData, "longitude"),
    is_active: formData.get("is_active") === "on",
    updated_at: new Date().toISOString(),
  };
}

function buildDealPayload(formData, userId) {
  const startsAt = getNullableTimestamp(formData, "starts_at");
  const endsAt = getNullableTimestamp(formData, "ends_at");
  const isActive = formData.get("is_active") === "on";
  const payload = {
    business_id: getString(formData, "business_id"),
    owner_id: userId,
    title: getString(formData, "title"),
    description: getNullableString(formData, "description"),
    promotion_type: getString(formData, "promotion_type") || null,
    is_active: isActive,
    starts_at: startsAt?.value ?? null,
    ends_at: endsAt?.value ?? null,
    availability_mode:
      getString(formData, "availability_mode") || DEAL_AVAILABILITY_MODE.CONTINUOUS,
    availability_timezone:
      getString(formData, "availability_timezone") ||
      DEFAULT_DEAL_AVAILABILITY_TIMEZONE,
    updated_at: new Date().toISOString(),
    fieldErrors: [startsAt?.error, endsAt?.error].filter(Boolean),
  };
  const computedStatus = getDealStatus(payload);

  return {
    ...payload,
    status:
      computedStatus === DEAL_STATUS.DISABLED
        ? "paused"
        : computedStatus === DEAL_STATUS.SCHEDULED
          ? "scheduled"
          : computedStatus === DEAL_STATUS.EXPIRED
            ? "ended"
            : "active",
  };
}

function isValidIanaTimezone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function buildDealSchedules(formData) {
  const schedules = [];

  for (const weekday of DEAL_WEEKDAYS) {
    if (formData.get(`schedule_${weekday.value}_enabled`) !== "on") {
      continue;
    }

    const startTime = getString(formData, `schedule_${weekday.value}_start`);
    const endTime = getString(formData, `schedule_${weekday.value}_end`);
    const validTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

    if (!validTimePattern.test(startTime) || !validTimePattern.test(endTime)) {
      return { error: `Enter valid start and end times for ${weekday.label}.` };
    }

    if (startTime === endTime) {
      return { error: `${weekday.label}'s start and end times must be different.` };
    }

    schedules.push({
      day_of_week: weekday.value,
      start_time: startTime,
      end_time: endTime,
      spans_midnight: endTime < startTime,
    });
  }

  return { schedules };
}

function validateBusiness(payload, { supportedCountriesOnly = false } = {}) {
  if (payload.fieldErrors.length) {
    return payload.fieldErrors[0];
  }

  if (!payload.name || !payload.category || !payload.country || !payload.city) {
    return "Name, category, country, and city are required.";
  }

  if (!BUSINESS_CATEGORY_LABELS.includes(payload.category)) {
    if (!isKnownBusinessCategory(payload.category)) {
    return "Choose a valid business category.";
    }
  }

  if (supportedCountriesOnly && !isSupportedCountry(payload.country)) {
    return "Choose a currently supported country.";
  }

  if (!payload.address || payload.address !== payload.selected_address) {
    return "Choose an address from the Mapbox suggestions before saving.";
  }

  if (
    payload.selected_country &&
    normalizeComparable(payload.country) !== normalizeComparable(payload.selected_country)
  ) {
    return `The selected address appears to be in ${payload.selected_country}. Choose the matching country or select another address.`;
  }

  if (
    payload.selected_city &&
    normalizeComparable(payload.city) !== normalizeComparable(payload.selected_city)
  ) {
    return `The selected address appears to be in ${payload.selected_city}. Choose the matching city or select another address.`;
  }

  if (payload.latitude === null || payload.longitude === null) {
    return "Choose an address from the Mapbox suggestions so map coordinates can be saved.";
  }

  return null;
}

function getBusinessSavePayload(payload) {
  const savePayload = { ...payload };
  delete savePayload.selected_address;
  delete savePayload.selected_country;
  delete savePayload.selected_city;
  delete savePayload.fieldErrors;
  return savePayload;
}

function validateDeal(payload, scheduleResult) {
  if (payload.fieldErrors.length) {
    return payload.fieldErrors[0];
  }

  if (!payload.business_id || !payload.title) {
    return "Choose a business and add a deal title.";
  }

  if (payload.promotion_type && !PROMOTION_TYPE_VALUES.includes(payload.promotion_type)) {
    return "Choose a valid promotion type.";
  }

  if (!Object.values(DEAL_AVAILABILITY_MODE).includes(payload.availability_mode)) {
    return "Choose a valid deal availability option.";
  }

  if (!isValidIanaTimezone(payload.availability_timezone)) {
    return "Choose a valid availability timezone.";
  }

  if (scheduleResult.error) {
    return scheduleResult.error;
  }

  if (
    payload.availability_mode === DEAL_AVAILABILITY_MODE.WEEKLY &&
    scheduleResult.schedules.length === 0
  ) {
    return "Select at least one day for weekly availability.";
  }

  if (payload.starts_at && payload.ends_at && payload.starts_at >= payload.ends_at) {
    return "Deal end time must be after the start time.";
  }

  return null;
}

function getDealSavePayload(payload) {
  const savePayload = { ...payload };
  delete savePayload.fieldErrors;
  return savePayload;
}

function getImageFile(formData, key) {
  const file = formData.get(key);

  if (!file || typeof file.size !== "number" || file.size === 0) {
    return null;
  }

  return file;
}

function getImageExtension(file) {
  const extension = file.name?.split(".").pop()?.toLowerCase();

  if (["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) {
    return extension;
  }

  return file.type?.split("/")[1] || "jpg";
}

async function uploadBusinessImage(supabase, userId, businessId, file, slot) {
  if (!file) {
    return null;
  }

  if (!file.type?.startsWith("image/")) {
    return {
      error: {
        field: slot,
        userMessage: `${slot === "logo" ? "Logo" : "Cover image"} must be an image file.`,
      },
    };
  }

  if (file.size > 5 * 1024 * 1024) {
    return {
      error: {
        field: slot,
        userMessage: `${slot === "logo" ? "Logo" : "Cover image"} must be 5 MB or smaller.`,
      },
    };
  }

  const extension = getImageExtension(file);
  const path = `${userId}/${businessId}/${slot}-${Date.now()}.${extension}`;
  let uploadError = null;

  try {
    const { error } = await supabase.storage
      .from("business-assets")
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
    uploadError = error;
  } catch (error) {
    uploadError = error;
  }

  if (uploadError) {
    return {
      error: {
        field: slot,
        technicalError: uploadError,
        userMessage: `We couldn't upload the business ${slot === "logo" ? "logo" : "cover image"}. Check the file and try again.`,
      },
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("business-assets").getPublicUrl(path);

  return { path, url: publicUrl };
}

async function uploadBusinessImages(supabase, userId, businessId, formData) {
  const logo = await uploadBusinessImage(
    supabase,
    userId,
    businessId,
    getImageFile(formData, "logo"),
    "logo",
  );

  if (logo?.error) {
    return { error: logo.error, uploadedPaths: [] };
  }

  const cover = await uploadBusinessImage(
    supabase,
    userId,
    businessId,
    getImageFile(formData, "cover_image"),
    "cover",
  );

  if (cover?.error) {
    return {
      error: cover.error,
      uploadedPaths: logo?.path ? [logo.path] : [],
    };
  }

  return {
    urls: {
      ...(logo?.url ? { logo_url: logo.url } : {}),
      ...(cover?.url ? { cover_image_url: cover.url } : {}),
    },
    uploadedPaths: [logo?.path, cover?.path].filter(Boolean),
  };
}

async function removeUploadedBusinessImages(supabase, paths) {
  if (!paths?.length) return;

  const { error } = await supabase.storage.from("business-assets").remove(paths);
  if (error) logServerActionError("Business image cleanup failed", error);
}

async function deleteIncompleteBusiness(supabase, userId, businessId) {
  const { error } = await supabase
    .from("businesses")
    .delete()
    .eq("id", businessId)
    .eq("owner_id", userId);

  if (error) logServerActionError("Incomplete business cleanup failed", error);
  return error;
}

async function verifyOwnedBusiness(supabase, userId, businessId) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug")
    .eq("id", businessId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    return { error: "Unable to verify business ownership. Please try again." };
  }

  if (!data) {
    return { error: "You can only manage deals for your own businesses." };
  }

  return { business: data };
}

async function getSignedInUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?auth=1&next=/owner");
  }

  return { supabase, user };
}

function redirectWithError(message) {
  redirect(`/owner?error=${encodeURIComponent(message)}`);
}

function redirectWithBusinessFormError(message, { businessId, imageField } = {}) {
  const params = new URLSearchParams({
    section: "businesses",
    error: message,
  });

  if (businessId) {
    params.set("editBusiness", businessId);
  } else {
    params.set("createBusiness", "1");
  }

  if (imageField) params.set("imageError", imageField);
  redirect(`/owner?${params.toString()}`);
}

function logServerActionError(label) {
  if (process.env.NODE_ENV !== "production") {
    console.error(label);
  }
}

function revalidateBusinessProfile(business) {
  revalidatePath(getBusinessPath(business));

  if (business?.slug && business?.id) {
    revalidatePath(getBusinessPath({ id: business.id }));
  }
}

async function createBusiness(formData) {
  "use server";

  const { supabase, user } = await getSignedInUser();
  const payload = buildBusinessPayload(formData, user.id);
  const validationError = validateBusiness(payload, { supportedCountriesOnly: true });

  if (validationError) {
    redirectWithBusinessFormError(validationError);
  }

  const { data: business, error } = await supabase
    .from("businesses")
    .insert(getBusinessSavePayload(payload))
    .select("id, slug")
    .single();

  if (error) {
    logServerActionError("Business creation failed", error);
    redirectWithBusinessFormError("Unable to create business. Please try again.");
  }

  const uploaded = await uploadBusinessImages(supabase, user.id, business.id, formData);

  if (uploaded.error) {
    logServerActionError("Business image upload failed", uploaded.error.technicalError);
    await removeUploadedBusinessImages(supabase, uploaded.uploadedPaths);
    const cleanupError = await deleteIncompleteBusiness(supabase, user.id, business.id);

    if (cleanupError) {
      redirectWithError(
        "The business was created, but its image could not be uploaded. Edit the existing business to try the image again.",
      );
    }

    redirectWithBusinessFormError(uploaded.error.userMessage, {
      imageField: uploaded.error.field,
    });
  }

  if (Object.keys(uploaded.urls).length) {
    const { error: mediaError } = await supabase
      .from("businesses")
      .update(uploaded.urls)
      .eq("id", business.id)
      .eq("owner_id", user.id);

    if (mediaError) {
      logServerActionError("Business media save failed", mediaError);
      await removeUploadedBusinessImages(supabase, uploaded.uploadedPaths);
      const cleanupError = await deleteIncompleteBusiness(supabase, user.id, business.id);

      if (cleanupError) {
        redirectWithError(
          "The business was created, but its images could not be saved. Edit the existing business to try again.",
        );
      }

      redirectWithBusinessFormError("We couldn't save the business images. Please try again.", {
        imageField: "images",
      });
    }
  }

  revalidatePath("/owner");
  redirect("/owner");
}

async function updateBusiness(formData) {
  "use server";

  const { supabase, user } = await getSignedInUser();
  const businessId = getString(formData, "business_id");
  const payload = buildBusinessPayload(formData, user.id);
  const validationError = validateBusiness(payload);

  if (!businessId || validationError) {
    redirectWithError(validationError ?? "Missing business id.");
  }

  const uploaded = await uploadBusinessImages(supabase, user.id, businessId, formData);

  if (uploaded.error) {
    logServerActionError("Business image upload failed", uploaded.error.technicalError);
    await removeUploadedBusinessImages(supabase, uploaded.uploadedPaths);
    redirectWithBusinessFormError(uploaded.error.userMessage, {
      businessId,
      imageField: uploaded.error.field,
    });
  }

  const { data: business, error } = await supabase
    .from("businesses")
    .update({
      ...getBusinessSavePayload(payload),
      ...uploaded.urls,
    })
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .select("id, slug")
    .single();

  if (error) {
    logServerActionError("Business update failed", error);
    await removeUploadedBusinessImages(supabase, uploaded.uploadedPaths);
    redirectWithBusinessFormError("Unable to update business. Please try again.", {
      businessId,
      imageField: uploaded.uploadedPaths.length ? "images" : undefined,
    });
  }

  revalidateBusinessProfile(business);
  revalidatePath("/owner");
  redirect("/owner");
}

async function createDeal(formData) {
  "use server";

  const { supabase, user } = await getSignedInUser();
  const payload = buildDealPayload(formData, user.id);
  const scheduleResult = buildDealSchedules(formData);
  const validationError = validateDeal(payload, scheduleResult);

  if (validationError) {
    redirectWithError(validationError);
  }

  const ownedBusiness = await verifyOwnedBusiness(
    supabase,
    user.id,
    payload.business_id,
  );

  if (ownedBusiness.error) {
    redirectWithError(ownedBusiness.error);
  }

  const { error } = await supabase.rpc("save_owner_deal", {
    p_deal_id: null,
    p_edit_token: null,
    p_payload: getDealSavePayload(payload),
    p_schedules: payload.availability_mode === DEAL_AVAILABILITY_MODE.WEEKLY
      ? scheduleResult.schedules : [],
  });

  if (error) {
    logServerActionError("Deal creation failed", error);
    redirectWithError("Unable to create deal. Please try again.");
  }

  revalidateBusinessProfile(ownedBusiness.business);
  revalidatePath("/owner");
  redirect("/owner?section=deals&dealCreated=1");
}

async function updateDeal(formData) {
  "use server";

  const { supabase, user } = await getSignedInUser();
  const dealId = getString(formData, "deal_id");
  const payload = buildDealPayload(formData, user.id);
  const scheduleResult = buildDealSchedules(formData);
  const validationError = validateDeal(payload, scheduleResult);

  if (!dealId || validationError) {
    redirectWithError(validationError ?? "Missing deal id.");
  }

  const ownedBusiness = await verifyOwnedBusiness(
    supabase,
    user.id,
    payload.business_id,
  );

  if (ownedBusiness.error) {
    redirectWithError(ownedBusiness.error);
  }

  const { data: editToken, error: beginError } = await supabase.rpc(
    "begin_owner_deal_edit", { p_deal_id: dealId },
  );
  if (beginError || !editToken) {
    logServerActionError("Deal edit lease failed", beginError);
    redirectWithError("Another save may be in progress. Please try again shortly.");
  }

  const { error } = await supabase.rpc("save_owner_deal", {
    p_deal_id: dealId,
    p_edit_token: editToken,
    p_payload: getDealSavePayload(payload),
    p_schedules: payload.availability_mode === DEAL_AVAILABILITY_MODE.WEEKLY
      ? scheduleResult.schedules : [],
  });

  if (error) {
    logServerActionError("Deal update failed", error);

    redirectWithError(error.code === "55P03"
      ? "The save could not finish. Please try again shortly."
      : "Unable to update deal. Please try again.");
  }

  revalidateBusinessProfile(ownedBusiness.business);
  revalidatePath("/owner");
  redirect("/owner?section=deals&dealUpdated=1");
}

async function deleteDeal(formData) {
  "use server";

  const { supabase, user } = await getSignedInUser();
  const dealId = getString(formData, "deal_id");
  const businessId = getString(formData, "business_id");

  if (!dealId) {
    redirectWithError("Missing deal id.");
  }

  const { error } = await supabase
    .from("deals")
    .delete()
    .eq("id", dealId)
    .eq("owner_id", user.id);

  if (error) {
    logServerActionError("Deal deletion failed", error);
    redirectWithError("Unable to delete deal. Please try again.");
  }

  if (businessId) {
    const ownedBusiness = await verifyOwnedBusiness(supabase, user.id, businessId);
    revalidateBusinessProfile(ownedBusiness.business ?? { id: businessId });
  }
  revalidatePath("/owner");
  redirect("/owner");
}

function Field({ label, children }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="spotnera-input w-full text-sm font-medium placeholder:text-zinc-400"
    />
  );
}

function FileInput(props) {
  return (
    <input
      {...props}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      className="rounded-2xl border border-dashed border-zinc-300 bg-white/86 px-3 py-3 text-sm font-medium text-zinc-600 file:mr-3 file:rounded-xl file:border-0 file:bg-[#33d6a6] file:px-3 file:py-2 file:text-xs file:font-bold file:text-zinc-950"
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className="min-h-24 resize-none rounded-2xl border border-zinc-200 bg-white/86 px-3 py-2.5 text-sm font-medium text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/10"
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="spotnera-input w-full text-sm font-bold"
    />
  );
}

function SubmitButton({ children }) {
  return (
    <button
      type="submit"
      data-analytics-submit="true"
      className="spotnera-primary-action px-4 text-sm"
    >
      {children}
    </button>
  );
}

function DealStatusSummary({ deal }) {
  const status = getDealStatus(deal);
  const meta = DEAL_STATUS_META[status];

  return (
    <div className="mb-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ${meta.background} ${meta.text}`}
        >
          <span aria-hidden="true" className="mr-1.5">●</span>
          {meta.label}
        </span>
        <span className="text-xs font-semibold text-zinc-500">
          <DealTimeLabel deal={deal} fallback="Promotion timing" />
        </span>
        <span className="text-xs font-bold text-emerald-700">
          <DealAvailabilityLabel deal={deal} />
        </span>
      </div>
    </div>
  );
}

function BusinessForm({ action, business, imageError, submitLabel }) {
  const selectedCategory = business?.category ?? "";
  const selectedCountry = business?.country ?? "";
  const hasLegacyCategory =
    selectedCategory && !BUSINESS_CATEGORY_LABELS.includes(selectedCategory);
  const hasUnsupportedExistingCountry =
    Boolean(business && selectedCountry && !isSupportedCountry(selectedCountry));

  return (
    <AnalyticsForm
      action={action}
      encType="multipart/form-data"
      eventName={business ? "business_update" : "business_create"}
      analyticsContext={{ businessId: business?.id }}
      preventDuplicateSubmissions={!business}
      className="grid gap-3"
    >
      {business ? <input type="hidden" name="business_id" value={business.id} /> : null}
      {(business?.cover_image_url || business?.logo_url) ? (
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-100">
          <div
            className="h-32 bg-cover bg-center"
            style={{
              backgroundImage: business?.cover_image_url
                ? `url(${business.cover_image_url})`
                : "linear-gradient(135deg,#e4e4e7,#fafafa)",
            }}
          />
          <div className="flex items-center gap-3 p-3">
            <div
              className="h-14 w-14 rounded-2xl border border-white bg-cover bg-center shadow-sm"
              style={{
                backgroundImage: business?.logo_url
                  ? `url(${business.logo_url})`
                  : "linear-gradient(135deg,#18181b,#71717a)",
              }}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{business.name}</p>
              <p className="text-xs font-medium text-zinc-500">Current brand images</p>
            </div>
          </div>
        </div>
      ) : null}
      <Field label="Business name">
        <TextInput name="name" required minLength={2} maxLength={120} defaultValue={business?.name ?? ""} />
      </Field>
      <Field label="Category">
        <Select name="category" required defaultValue={selectedCategory}>
          <option value="" disabled>Choose category</option>
          {hasLegacyCategory ? (
            <option value={selectedCategory}>{selectedCategory}</option>
          ) : null}
          {BUSINESS_CATEGORY_LABELS.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Country">
          <Select name="country" required defaultValue={selectedCountry}>
            <option value="" disabled>Choose country</option>
            {hasUnsupportedExistingCountry ? (
              <option value={selectedCountry}>{selectedCountry}</option>
            ) : null}
            {SUPPORTED_COUNTRIES.map((country) => (
              <option key={country.code} value={country.name}>
                {country.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="City">
          <TextInput name="city" required minLength={2} maxLength={120} defaultValue={business?.city ?? ""} />
        </Field>
      </div>
      <Field label="Description">
        <TextArea name="description" maxLength={1000} defaultValue={business?.description ?? ""} />
      </Field>
      <AddressAutocomplete
        defaultAddress={business?.address ?? ""}
        defaultLatitude={business?.latitude ?? ""}
        defaultLongitude={business?.longitude ?? ""}
      />
      <section className="grid gap-3 rounded-3xl border border-zinc-200 bg-zinc-50 p-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
            Contact information
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone number">
            <TextInput
              type="tel"
              name="phone"
              maxLength={32}
              placeholder="+47 123 45 678"
              defaultValue={business?.phone ?? ""}
            />
          </Field>
          <Field label="Email">
            <TextInput
              type="email"
              name="email"
              maxLength={254}
              placeholder="contact@business.com"
              defaultValue={business?.email ?? ""}
            />
          </Field>
          <Field label="Website">
            <TextInput
              type="text"
              inputMode="url"
              name="website_url"
              maxLength={300}
              placeholder="spotnera.com"
              defaultValue={business?.website_url ?? ""}
            />
          </Field>
        </div>
      </section>
      <section className="grid gap-3 rounded-3xl border border-zinc-200 bg-zinc-50 p-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
            Social media
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Facebook">
            <TextInput
              name="facebook_url"
              maxLength={300}
              placeholder="facebook.com/spotnera"
              defaultValue={business?.facebook_url ?? ""}
            />
          </Field>
          <Field label="Instagram">
            <TextInput
              name="instagram_url"
              maxLength={300}
              placeholder="@spotnera"
              defaultValue={business?.instagram_url ?? ""}
            />
          </Field>
          <Field label="TikTok">
            <TextInput
              name="tiktok_url"
              maxLength={300}
              placeholder="@spotnera"
              defaultValue={business?.tiktok_url ?? ""}
            />
          </Field>
          <Field label="Snapchat">
            <TextInput
              name="snapchat_url"
              maxLength={300}
              placeholder="spotnera"
              defaultValue={business?.snapchat_url ?? ""}
            />
          </Field>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Logo">
          <FileInput name="logo" />
          {imageError?.field === "logo" ? (
            <span className="text-xs font-semibold leading-5 text-red-600" role="alert">
              {imageError.message}
            </span>
          ) : null}
        </Field>
        <Field label="Cover image">
          <FileInput name="cover_image" />
          {imageError?.field === "cover" ? (
            <span className="text-xs font-semibold leading-5 text-red-600" role="alert">
              {imageError.message}
            </span>
          ) : null}
        </Field>
      </div>
      {imageError?.field === "images" ? (
        <p className="rounded-2xl border border-red-300/24 bg-red-500/12 px-3 py-2 text-sm font-semibold text-red-100" role="alert">
          {imageError.message}
        </p>
      ) : null}
      <label className="flex h-12 items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-800">
        Active listing
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={business?.is_active ?? true}
          className="h-5 w-5 accent-zinc-950"
        />
      </label>
      {business ? (
        <SubmitButton>{submitLabel}</SubmitButton>
      ) : (
        <LockedFormSubmitButton pendingLabel="Creating profile…">
          {submitLabel}
        </LockedFormSubmitButton>
      )}
    </AnalyticsForm>
  );
}

function DealForm({ action, deal, businesses, submitLabel }) {
  return (
    <AnalyticsForm
      action={action}
      eventName={deal ? "deal_update" : "deal_create"}
      analyticsContext={{ dealId: deal?.id }}
      preventDuplicateSubmissions={!deal}
      className="grid gap-3"
    >
      {deal ? <input type="hidden" name="deal_id" value={deal.id} /> : null}
      {deal?.promotion_type ? (
        <input type="hidden" name="promotion_type" value={deal.promotion_type} />
      ) : null}
      {deal ? <DealStatusSummary deal={deal} /> : null}
      <Field label="Business">
        <Select name="business_id" required defaultValue={deal?.business_id ?? businesses[0]?.id ?? ""}>
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Title">
        <TextInput name="title" required minLength={2} maxLength={140} defaultValue={deal?.title ?? ""} />
      </Field>
      <Field label="Description">
        <TextArea name="description" defaultValue={deal?.description ?? ""} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Starts">
          <DealDateTimeInput name="starts_at" defaultValue={deal?.starts_at} />
        </Field>
        <Field label="Ends">
          <DealDateTimeInput name="ends_at" defaultValue={deal?.ends_at} />
        </Field>
      </div>
      <DealAvailabilityFields
        initialMode={deal?.availability_mode ?? DEAL_AVAILABILITY_MODE.CONTINUOUS}
        initialSchedules={deal?.deal_schedules ?? []}
        initialTimezone={
          deal?.availability_timezone ?? DEFAULT_DEAL_AVAILABILITY_TIMEZONE
        }
      />
      <label className="flex min-h-12 items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-800">
        Promotion enabled
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={deal?.is_active ?? (deal?.status !== "paused" && deal?.status !== "ended")}
          className="h-5 w-5 accent-zinc-950"
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {deal ? (
          <SubmitButton>{submitLabel}</SubmitButton>
        ) : (
          <LockedFormSubmitButton pendingLabel="Creating deal…">
            {submitLabel}
          </LockedFormSubmitButton>
        )}
        {deal ? (
          <button
            type="submit"
            formAction={deleteDeal}
            formNoValidate
            className="h-12 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 transition hover:bg-red-100"
          >
            Delete deal
          </button>
        ) : null}
      </div>
    </AnalyticsForm>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="spotnera-card rounded-[24px] p-4">
      <p className="text-2xl font-black tracking-tight text-zinc-950">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
    </div>
  );
}

export default async function OwnerDashboardPage({ searchParams }) {
  if (!hasSupabaseEnv()) {
    redirect("/");
  }

  const resolvedSearchParams = await searchParams;
  const analyticsRange = getAnalyticsRange(resolvedSearchParams?.analyticsRange);
  const ownerSection = OWNER_SECTIONS.includes(resolvedSearchParams?.section)
    ? resolvedSearchParams.section
    : "overview";
  const editingBusinessId = resolvedSearchParams?.editBusiness ?? "";
  const editingDealId = resolvedSearchParams?.editDeal ?? "";
  const showCreateBusiness = resolvedSearchParams?.createBusiness === "1";
  const showCreateDeal = resolvedSearchParams?.createDeal === "1";
  const imageError = resolvedSearchParams?.imageError && resolvedSearchParams?.error
    ? {
        field: resolvedSearchParams.imageError,
        message: resolvedSearchParams.error,
      }
    : null;
  const { supabase, user } = await getSignedInUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: businessRows, error: businessesError } = await supabase
    .from("businesses")
    .select(BUSINESS_FIELDS)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const businesses = businessRows ?? [];
  const businessIds = businesses.map((business) => business.id);
  let deals = [];
  let reviews = [];
  let favoriteCounts = [];
  let eventRows = [];
  let analyticsError = null;
  let favoriteCountsError = null;

  if (businessIds.length) {
    const [
      { data: dealRows },
      { data: reviewRows },
      { data: favoriteCountRows, error: favoriteCountQueryError },
      { data: eventCountRows, error: eventCountsError },
    ] = await Promise.all([
      supabase
        .from("deals")
        .select(DEAL_FIELDS)
        .in("business_id", businessIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("reviews")
        .select(REVIEW_FIELDS)
        .in("business_id", businessIds)
        .order("created_at", { ascending: false }),
      supabase.rpc("get_owner_business_favorite_counts"),
      supabase.rpc("get_owner_business_event_counts", {
        range_key: analyticsRange.key,
      }),
    ]);

    deals = dealRows ?? [];
    reviews = reviewRows ?? [];
    favoriteCounts = favoriteCountRows ?? [];
    eventRows = eventCountRows ?? [];
    analyticsError = eventCountsError;
    favoriteCountsError = favoriteCountQueryError;
  }

  const dealsByBusinessId = new Map();
  for (const deal of deals) {
    dealsByBusinessId.set(deal.business_id, [
      ...(dealsByBusinessId.get(deal.business_id) ?? []),
      deal,
    ]);
  }

  const reviewsByBusinessId = new Map();
  for (const review of reviews) {
    reviewsByBusinessId.set(review.business_id, [
      ...(reviewsByBusinessId.get(review.business_id) ?? []),
      review,
    ]);
  }

  const favoriteCountsByBusinessId = new Map();
  for (const favorite of favoriteCounts) {
    favoriteCountsByBusinessId.set(
      favorite.business_id,
      Number(favorite.favorite_count),
    );
  }

  const now = new Date();
  const eventAnalyticsByBusinessId = buildEventAnalytics(eventRows);
  const sortedDeals = sortDealsByComputedStatus(deals, now);
  const totalFavorites = favoriteCountsError
    ? "—"
    : [...favoriteCountsByBusinessId.values()].reduce((sum, count) => sum + count, 0);
  const activeDealCount = getLiveDeals(deals, now).length;
  const selectedAnalyticsBusinessId =
    resolvedSearchParams?.analyticsBusinessId &&
    businesses.some((business) => business.id === resolvedSearchParams.analyticsBusinessId)
      ? resolvedSearchParams.analyticsBusinessId
      : businesses[0]?.id;

  return (
    <main className="spotnera-owner-shell">
      <OwnerDashboardAnalytics
        businessCount={businesses.length}
        activeDealCount={activeDealCount}
      />
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8">
        <header className="spotnera-card rounded-[30px] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/icons/logo.png" alt="Spotnera" className="spotnera-brand-mark shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="spotnera-kicker text-white/55">Spotnera Business</p>
                <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl">
                  Manage your businesses
                </h1>
                <p className="mt-1 text-sm text-white/54">
                  {profile?.first_name ? `${profile.first_name}'s portfolio` : "Your business portfolio"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <div className="relative"><HeaderLogout /></div>
            </div>
          </div>
          {resolvedSearchParams?.businessDeleted === "1" ? (
            <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Business deleted.</p>
          ) : null}
          {resolvedSearchParams?.dealUpdated === "1" ? (
            <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Deal updated.</p>
          ) : null}
          {resolvedSearchParams?.dealCreated === "1" ? (
            <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Deal created.</p>
          ) : null}
          {resolvedSearchParams?.error ? (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {resolvedSearchParams.error}
            </p>
          ) : null}
          {businessesError ? (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              Unable to load your businesses. Please try again.
            </p>
          ) : null}
        </header>

        <nav aria-label="Business sections" className="spotnera-surface flex gap-1 overflow-x-auto rounded-[22px] p-1.5">
          {[
            ["overview", "Overview"],
            ["businesses", "Businesses"],
            ["deals", "Deals"],
            ["analytics", "Analytics"],
            ["reviews", "Reviews"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={`/owner?section=${key}`}
              className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-2xl px-3 text-xs font-black leading-none transition sm:px-4 ${
                ownerSection === key
                  ? "spotnera-brand-action"
                  : "text-white/58 hover:bg-white/10 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {ownerSection === "overview" ? (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Businesses" value={businesses.length} />
              <StatTile label="Active deals" value={activeDealCount} />
              <StatTile label="Reviews" value={reviews.length} />
              <StatTile label="Favorites" value={totalFavorites} />
            </section>
            <section className="spotnera-card rounded-[30px] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/48">Portfolio</p>
              <h2 className="mt-1 text-xl font-semibold">Your businesses</h2>
              <div className="mt-4 grid gap-2">
                {businesses.length ? businesses.map((business) => (
                  <div key={business.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/8 px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{business.name}</p>
                      <p className="mt-1 text-xs text-white/54">{getLiveDeals(dealsByBusinessId.get(business.id) ?? [], now).length} active deals</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-white/72">{formatRating(getAverageRating(reviewsByBusinessId.get(business.id) ?? []))} rating</span>
                  </div>
                )) : (
                  <p className="rounded-2xl border border-dashed border-white/14 p-4 text-sm text-white/58">No businesses yet. Open Businesses to create your first profile.</p>
                )}
              </div>
            </section>
          </>
        ) : null}

        {(ownerSection === "businesses" || ownerSection === "analytics") ? (
        <section className="spotnera-card rounded-[30px] p-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                {ownerSection === "analytics" ? "Performance" : "Portfolio"}
              </p>
          <h2 className="mt-1 text-xl font-semibold">{ownerSection === "analytics" ? "Business analytics" : "Your businesses"}</h2>
            </div>
            {ownerSection === "analytics" ? <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              {ANALYTICS_RANGES.map((range) => (
                <Link
                  key={range.key}
                  href={`/owner?section=analytics&analyticsRange=${range.key}&analyticsBusinessId=${selectedAnalyticsBusinessId ?? ""}`}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                    range.key === analyticsRange.key
                      ? "spotnera-brand-action"
                      : "bg-white/72 text-zinc-600 hover:bg-white"
                  }`}
                >
                  {range.label}
                </Link>
              ))}
            </div> : null}
          </div>
          {ownerSection === "businesses" ? (
            <div className="mb-4 flex justify-end">
              <Link href="/owner?section=businesses&createBusiness=1" className="spotnera-primary-action inline-flex min-h-11 items-center justify-center px-4 text-sm">
                + Create business
              </Link>
            </div>
          ) : null}
          {analyticsError ? (
            <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              Business analytics will appear after the business events migration is applied.
            </p>
          ) : null}
          {favoriteCountsError ? (
            <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              Favorite counts are unavailable. Please try again later.
            </p>
          ) : null}

          {ownerSection === "analytics" ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/48">Business</span>
              {businesses.map((business) => (
                <Link
                  key={business.id}
                  href={`/owner?section=analytics&analyticsBusinessId=${business.id}&analyticsRange=${analyticsRange.key}`}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${selectedAnalyticsBusinessId === business.id ? "spotnera-brand-action" : "bg-white/10 text-white/62 hover:bg-white/16"}`}
                >
                  {business.name}
                </Link>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3">
            {businesses.length ? (
              businesses
                .filter((business) => ownerSection !== "analytics" || business.id === selectedAnalyticsBusinessId)
                .map((business) => {
                const businessDeals = dealsByBusinessId.get(business.id) ?? [];
                const businessReviews = reviewsByBusinessId.get(business.id) ?? [];
                const favoriteCount = favoriteCountsError
                  ? "—"
                  : favoriteCountsByBusinessId.get(business.id) ?? 0;
                const eventAnalytics = eventAnalyticsByBusinessId.get(business.id) ?? {
                  counts: getEmptyEventCounts(),
                  dailyTotals: new Map(),
                };
                const analyticsMetrics = [
                  ...BUSINESS_ANALYTICS_METRICS.map((metric) => ({
                    ...metric,
                    value: eventAnalytics.counts[metric.key] ?? 0,
                  })),
                  {
                    key: "favorites",
                    label: "Favorites",
                    description: "Current customers who saved your business.",
                    value: favoriteCount,
                  },
                  {
                    key: "reviews",
                    label: "Reviews",
                    description: "Current customer review count.",
                    value: businessReviews.length,
                  },
                  {
                    key: "average_rating",
                    label: "Average rating",
                    description: "Average rating from customer reviews.",
                    value: formatRating(getAverageRating(businessReviews)),
                  },
                ];
                const chartPoints = buildChartPoints(eventAnalytics.dailyTotals);
                const hasActivity = analyticsMetrics.some(
                  (metric) => metric.key !== "average_rating" && Number(metric.value || 0) > 0,
                );

                const categoryConfig = getBusinessCategoryConfig(business.category);

                return (
                  <article
                    key={business.id}
                    className="rounded-[24px] border border-white/10 bg-white/8 p-3"
                    style={{ borderTopColor: categoryConfig.color, borderTopWidth: "3px" }}
                  >
                    <div
                      className="mb-3 h-28 rounded-2xl bg-cover bg-center"
                      style={{
                        backgroundImage: business.cover_image_url
                          ? `url(${business.cover_image_url})`
                          : "linear-gradient(135deg,#d4d4d8,#f4f4f5)",
                      }}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="h-12 w-12 shrink-0 rounded-2xl bg-cover bg-center"
                          style={{
                            backgroundImage: business.logo_url
                              ? `url(${business.logo_url})`
                              : "linear-gradient(135deg,#18181b,#71717a)",
                          }}
                        />
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-bold">{business.name}</h3>
                          <p className="mt-1 flex items-center gap-2 text-sm text-white/54">
                            <span
                              className="inline-block h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: categoryConfig.color }}
                            />
                            {[categoryConfig.label, business.city, business.country]
                              .filter(Boolean)
                              .join(" - ")}
                          </p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        business.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-200 text-zinc-600"
                      }`}>
                        {business.is_active ? "Active" : "Hidden"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                      <div className="rounded-2xl border border-white/14 bg-white/12 p-2">
                        <p className="font-black">{businessDeals.length}</p>
                        <p className="text-[10px] font-bold uppercase text-zinc-400">Deals</p>
                      </div>
                      <div className="rounded-2xl border border-white/14 bg-white/12 p-2">
                        <p className="font-black">{formatRating(getAverageRating(businessReviews))}</p>
                        <p className="text-[10px] font-bold uppercase text-zinc-400">Rating</p>
                      </div>
                      <div className="rounded-2xl border border-white/14 bg-white/12 p-2">
                        <p className="font-black">{businessReviews.length}</p>
                        <p className="text-[10px] font-bold uppercase text-zinc-400">Reviews</p>
                      </div>
                      <div className="rounded-2xl border border-white/14 bg-white/12 p-2">
                        <p className="font-black">{favoriteCount}</p>
                        <p className="text-[10px] font-bold uppercase text-zinc-400">Saved</p>
                      </div>
                    </div>
                    {ownerSection === "analytics" ? (
                    <section className="mt-4 rounded-[22px] border border-zinc-200 bg-zinc-50/80 p-3">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                            Business Analytics
                          </p>
                          <h4 className="mt-1 text-base font-bold text-zinc-950">
                            Customer engagement
                          </h4>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
                          {analyticsRange.label}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                        {analyticsMetrics.map((metric) => (
                          <div key={metric.key} className="rounded-2xl bg-white p-3">
                            <p className="text-xl font-black text-zinc-950">
                              {metric.key === "average_rating"
                                ? metric.value
                                : formatMetricValue(metric.value)}
                            </p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                              {metric.label}
                            </p>
                            <p className="mt-1 text-xs leading-4 text-zinc-500">
                              {metric.description}
                            </p>
                          </div>
                        ))}
                      </div>
                      <EngagementChart points={chartPoints} />
                      {!hasActivity ? (
                        <p className="mt-3 rounded-2xl border border-dashed border-zinc-200 bg-white/70 p-3 text-sm font-medium text-zinc-500">
                          No customer activity yet. Publish a live deal and share your profile to start building engagement.
                        </p>
                      ) : null}
                    </section>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={getBusinessPath(business)}
                        className="spotnera-secondary-action inline-flex min-h-10 items-center justify-center px-4 text-xs"
                      >
                        View public profile
                      </Link>
                      <CopyProfileLinkButton
                        businessId={business.id}
                        businessSlug={business.slug}
                        businessCategory={business.category}
                        city={business.city}
                        country={business.country}
                      />
                      <BusinessQrCode business={business} />
                      <Link
                        href={`/owner?section=businesses&editBusiness=${business.id}`}
                        className="spotnera-secondary-action inline-flex min-h-10 items-center justify-center px-4 text-xs"
                      >
                        Edit
                      </Link>
                      <DeleteBusinessButton
                        businessId={business.id}
                        businessName={business.name}
                        businessCategory={business.category}
                      />
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="rounded-3xl border border-dashed border-zinc-300 p-4 text-sm font-medium text-zinc-500">
                Create your first business to start publishing deals and tracking customer signals.
              </p>
            )}
          </div>
        </section>
        ) : null}

        {ownerSection === "businesses" ? (
          <section className="grid gap-4">
            {showCreateBusiness ? (
              <section className="spotnera-card rounded-[30px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">Create business profile</h2>
                  <Link href="/owner?section=businesses" className="text-xs font-bold text-white/58 hover:text-white">Cancel</Link>
                </div>
                <div className="mt-4"><BusinessForm action={createBusiness} imageError={imageError} submitLabel="Create profile" /></div>
              </section>
            ) : null}
            {editingBusinessId ? businesses.filter((business) => business.id === editingBusinessId).map((business) => (
              <section key={business.id} className="spotnera-card rounded-[30px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">Edit {business.name}</h2>
                  <Link href="/owner?section=businesses" className="text-xs font-bold text-white/58 hover:text-white">Cancel</Link>
                </div>
                <div className="mt-4"><BusinessForm action={updateBusiness} business={business} imageError={imageError} submitLabel="Save business" /></div>
              </section>
            )) : null}
          </section>
        ) : null}

        {ownerSection === "deals" ? (
          <section className="grid gap-4">
            <div className="flex justify-end">
              <Link href="/owner?section=deals&createDeal=1" className="spotnera-primary-action inline-flex min-h-11 items-center justify-center px-4 text-sm">
                + Create deal
              </Link>
            </div>
            {showCreateDeal ? (
              <section className="spotnera-card rounded-[30px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">Create deal</h2>
                  <Link href="/owner?section=deals" className="text-xs font-bold text-white/58 hover:text-white">Cancel</Link>
                </div>
                <div className="mt-4">
                  {businesses.length ? <DealForm action={createDeal} businesses={businesses} submitLabel="Create deal" /> : <p className="text-sm text-white/58">Create a business before adding deals.</p>}
                </div>
              </section>
            ) : null}
            {sortedDeals.length ? sortedDeals.map((deal) => {
              const status = getDealStatus(deal, now);
              const business = businesses.find((item) => item.id === deal.business_id);
              return (
                <article key={deal.id} className="spotnera-card rounded-[24px] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/48">{business?.name ?? "Business"}</p>
                      <h3 className="mt-1 text-lg font-bold">{deal.title}</h3>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${DEAL_STATUS_META[status].background} ${DEAL_STATUS_META[status].text}`}>
                      {DEAL_STATUS_META[status].label}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-white/54"><DealTimeLabel deal={deal} fallback="Promotion timing" /></p>
                  <p className="mt-1 text-xs font-bold text-[#72f0cc]"><DealAvailabilityLabel deal={deal} /></p>
                  {editingDealId === deal.id ? (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <DealForm action={updateDeal} deal={deal} businesses={businesses} submitLabel="Save deal" />
                    </div>
                  ) : (
                    <Link href={`/owner?section=deals&editDeal=${deal.id}`} className="spotnera-secondary-action mt-4 inline-flex min-h-10 items-center justify-center px-4 text-xs">Edit</Link>
                  )}
                </article>
              );
            }) : (
              <p className="rounded-3xl border border-dashed border-white/14 p-4 text-sm text-white/58">No promotions yet. Create a deal to start reaching customers.</p>
            )}
          </section>
        ) : null}

        {ownerSection === "reviews" ? (
        <section className="spotnera-card rounded-[30px] p-4">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Customer feedback
            </p>
            <h2 className="mt-1 text-xl font-semibold">Reviews</h2>
          </div>
          <div className="grid gap-3">
            {reviews.length ? (
              reviews.slice(0, 20).map((review) => {
                const business = businesses.find((item) => item.id === review.business_id);

                return (
                  <article key={review.id} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold">{business?.name ?? "Business"}</p>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-700">
                        {review.rating}.0
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      {review.comment || "No comment left."}
                    </p>
                  </article>
                );
              })
            ) : (
              <p className="rounded-3xl border border-dashed border-zinc-300 p-4 text-sm font-medium text-zinc-500">
                Reviews from customers will appear here.
              </p>
            )}
          </div>
        </section>
        ) : null}
        <SpotneraBottomNav />
      </section>
    </main>
  );
}
