import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BusinessEventLink } from "@/components/business-event-link";
import { BusinessProfileAnalytics } from "@/components/business-profile-analytics";
import { BusinessProfileFavorite } from "@/components/business-profile-favorite";
import { BusinessProfileMap } from "@/components/business-profile-map";
import { BusinessShareActions } from "@/components/business-share-actions";
import { LocalDealDateTime } from "@/components/deal-time-label";
import { getPrimaryLiveDeal } from "@/lib/deals";
import { getPromotionTypeLabel } from "@/lib/promotions";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

const APP_URL = "https://app.spotnera.com";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BUSINESS_SELECT = `
  id,
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
  is_active
`;

const DEAL_SELECT = `
  id,
  business_id,
  title,
  description,
  promotion_type,
  status,
  is_active,
  starts_at,
  ends_at
`;

const REVIEW_SELECT = `
  id,
  business_id,
  rating,
  comment,
  created_at,
  updated_at
`;

const SOCIAL_PROFILES = [
  {
    field: "facebook_url",
    label: "Facebook",
    hosts: ["facebook.com", "www.facebook.com", "fb.com", "www.fb.com"],
    buildUrl: (handle) => `https://www.facebook.com/${handle}`,
    handlePattern: /^[A-Za-z0-9.]{3,80}$/,
  },
  {
    field: "instagram_url",
    label: "Instagram",
    hosts: ["instagram.com", "www.instagram.com"],
    buildUrl: (handle) => `https://www.instagram.com/${handle}`,
    handlePattern: /^[A-Za-z0-9._]{1,30}$/,
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

function getDisplayValue(value) {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue || null;
}

function getBusinessUrl(id) {
  return `${APP_URL}/business/${id}`;
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

function getReviewLabel(reviewCount) {
  return `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`;
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
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "Website";
  }
}

function getPhoneHref(phone) {
  const normalizedPhone = String(phone ?? "").replace(/[^\d+]/g, "");
  return normalizedPhone ? `tel:${normalizedPhone}` : null;
}

function getEmailHref(email) {
  const publicEmail = getDisplayValue(email);

  if (!publicEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicEmail)) {
    return null;
  }

  return `mailto:${publicEmail}`;
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

function getSocialLinks(business) {
  return SOCIAL_PROFILES.map((profile) => ({
    label: profile.label,
    href: getSocialUrl(business[profile.field], profile),
  })).filter((profile) => profile.href);
}

function getContactActions(business) {
  const phone = getDisplayValue(business.phone);
  const phoneHref = phone ? getPhoneHref(phone) : null;
  const emailHref = getEmailHref(business.email);
  const websiteUrl = getWebsiteUrl(business.website_url);

  return [
    phone && phoneHref
      ? { label: "Call", detail: phone, href: phoneHref, external: false, eventType: "call_click" }
      : null,
    emailHref
      ? { label: "Email", detail: "Send email", href: emailHref, external: false, eventType: "email_click" }
      : null,
    websiteUrl
      ? {
          label: "Website",
          detail: getWebsiteDisplayLabel(websiteUrl),
          href: websiteUrl,
          external: true,
          eventType: "website_click",
        }
      : null,
  ].filter(Boolean);
}

async function getPublicBusiness(id) {
  if (!hasSupabaseEnv() || !UUID_PATTERN.test(id)) {
    return { business: null, error: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (businessError) {
    console.error("Public business query failed", businessError);
    return { business: null, error: "load_failed" };
  }

  if (!business) {
    return { business: null, error: null };
  }

  const now = new Date();
  const [{ data: deals, error: dealsError }, { data: reviews, error: reviewsError }] =
    await Promise.all([
      supabase
        .from("deals")
        .select(DEAL_SELECT)
        .eq("business_id", id)
        .eq("is_active", true)
        .or(`starts_at.is.null,starts_at.lte.${now.toISOString()}`)
        .or(`ends_at.is.null,ends_at.gt.${now.toISOString()}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("reviews")
        .select(REVIEW_SELECT)
        .eq("business_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (dealsError) {
    console.error("Public business deals query failed", dealsError);
  }

  if (reviewsError) {
    console.error("Public business reviews query failed", reviewsError);
  }

  let isFavorite = false;

  if (user) {
    const { data: favorite } = await supabase
      .from("favorites")
      .select("business_id")
      .eq("business_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    isFavorite = Boolean(favorite);
  }

  return {
    business: {
      ...business,
      deals: deals ?? [],
      reviews: reviews ?? [],
      isFavorite,
      isOwner: Boolean(user && business.owner_id === user.id),
      isAuthenticated: Boolean(user),
    },
    error: null,
  };
}

export async function generateMetadata({ params }) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id) || !hasSupabaseEnv()) {
    return {
      title: "Business not found | Spotnera",
      description: "This Spotnera business profile is not available.",
    };
  }

  const supabase = await createClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, category, city, country, description, logo_url, cover_image_url, is_active")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (!business) {
    return {
      title: "Business not found | Spotnera",
      description: "This Spotnera business profile is not available.",
    };
  }

  const title = `${business.name} | Spotnera`;
  const description =
    business.description ||
    [business.category, business.city, business.country].filter(Boolean).join(" in ") ||
    "Discover this business on Spotnera.";
  const image = business.cover_image_url || business.logo_url || "/icons/spotnera-icon-512.png";
  const url = getBusinessUrl(business.id);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "Spotnera",
      type: "website",
      images: [{ url: image, alt: business.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

function BrandedUnavailable({ title, message }) {
  return (
    <main className="spotnera-auth-shell flex min-h-screen items-center justify-center px-5 py-10">
      <section className="spotnera-card w-full max-w-md rounded-[30px] p-6 text-zinc-950 sm:p-8">
        <div className="flex items-center gap-3">
          <Image
            src="/icons/logo.png"
            alt="Spotnera"
            width={40}
            height={40}
            className="spotnera-brand-mark object-contain"
          />
          <div>
            <p className="spotnera-kicker text-zinc-500">Spotnera</p>
            <p className="text-sm font-bold">Business profile</p>
          </div>
        </div>
        <h1 className="mt-7 text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{message}</p>
        <Link
          href="/"
          className="spotnera-primary-action mt-6 inline-flex min-h-12 items-center justify-center px-5 text-sm"
        >
          Explore Spotnera
        </Link>
      </section>
    </main>
  );
}

export default async function BusinessProfilePage({ params }) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const { business, error } = await getPublicBusiness(id);

  if (error) {
    return (
      <BrandedUnavailable
        title="Business profile is temporarily unavailable"
        message="We could not load this Spotnera business right now. Try again in a moment."
      />
    );
  }

  if (!business) {
    notFound();
  }

  const reviews = business.reviews ?? [];
  const activeDeal = getPrimaryLiveDeal(business.deals);
  const averageRating = getAverageRating(reviews);
  const contactActions = getContactActions(business);
  const socialLinks = getSocialLinks(business);
  const locationLine = [business.city, business.country].filter(Boolean).join(", ");
  const reviewCount = reviews.length;

  return (
    <main className="spotnera-app-shell min-h-screen overflow-x-hidden">
      <BusinessProfileAnalytics
        businessId={business.id}
        businessCategory={business.category}
        city={business.city}
        country={business.country}
      />
      <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 pb-10 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:px-8">
        <header className="spotnera-surface flex items-center justify-between gap-3 rounded-[28px] px-4 py-3 lg:col-span-2">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/icons/logo.png"
              alt="Spotnera"
              width={40}
              height={40}
              className="spotnera-brand-mark shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="spotnera-kicker text-white/55">Spotnera</p>
              <p className="truncate text-sm font-bold text-white/82">Public business profile</p>
            </div>
          </Link>
          <Link
            href="/"
            className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white/78 transition hover:bg-white/16 sm:px-4"
          >
            Explore Spotnera
          </Link>
        </header>

        <section className="overflow-hidden rounded-[32px] border border-white/12 bg-white/10 shadow-[0_28px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl lg:col-span-2">
          <div
            className="relative min-h-[280px] bg-cover bg-center sm:min-h-[360px]"
            style={{
              backgroundImage: business.cover_image_url
                ? `linear-gradient(180deg,rgba(0,0,0,0.16),rgba(0,0,0,0.72)),url(${business.cover_image_url})`
                : "linear-gradient(135deg,rgba(255,122,89,0.42),rgba(51,214,166,0.26) 48%,rgba(16,18,23,0.95))",
            }}
          >
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <div
                    className="mb-4 grid h-20 w-20 place-items-center rounded-[24px] border border-white/18 bg-white/14 bg-cover bg-center text-2xl font-black text-white shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl"
                    style={{
                      backgroundImage: business.logo_url ? `url(${business.logo_url})` : undefined,
                    }}
                    aria-label={`${business.name} logo`}
                  >
                    {business.logo_url ? null : business.name.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="spotnera-kicker text-[#72f0cc]">{business.category}</p>
                  <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-normal sm:text-5xl lg:text-6xl">
                    {business.name}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-white/72">
                    {locationLine ? <span>{locationLine}</span> : null}
                    {locationLine ? <span className="text-white/32">/</span> : null}
                    <span>
                      {formatRating(averageRating)} rating
                      <span className="text-white/44"> ({getReviewLabel(reviewCount)})</span>
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <BusinessShareActions
                    businessId={business.id}
                    businessCategory={business.category}
                    city={business.city}
                    country={business.country}
                    title={business.name}
                  />
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <BusinessProfileFavorite
                      businessId={business.id}
                      businessCategory={business.category}
                      city={business.city}
                      country={business.country}
                      initialIsFavorite={business.isFavorite}
                      isAuthenticated={business.isAuthenticated}
                    />
                    {business.isOwner ? (
                      <Link
                        href="/owner"
                        className="spotnera-secondary-action inline-flex min-h-12 items-center justify-center px-5 text-sm"
                      >
                        Manage business
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5">
          <section className="spotnera-surface rounded-[30px] p-4 sm:p-5">
            <p className="spotnera-kicker text-[#72f0cc]">Live deal</p>
            {activeDeal ? (
              <div className="mt-4 rounded-[26px] border border-[#33d6a6]/24 bg-[#33d6a6]/14 p-4">
                <h2 className="text-2xl font-semibold">{activeDeal.title}</h2>
                {activeDeal.promotion_type ? (
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-[#72f0cc]">
                    {getPromotionTypeLabel(activeDeal.promotion_type)}
                  </p>
                ) : null}
                {activeDeal.description ? (
                  <p className="mt-3 text-sm leading-6 text-white/68">
                    {activeDeal.description}
                  </p>
                ) : null}
                {activeDeal.ends_at ? (
                  <p className="mt-4 text-xs font-bold uppercase text-white/48">
                    <LocalDealDateTime prefix="Valid until " value={activeDeal.ends_at} />
                  </p>
                ) : null}
                <BusinessEventLink
                  business={business}
                  dealId={activeDeal.id}
                  eventType="deal_view"
                  gaEventName="deal_view"
                  gaParameters={{ deal_id: activeDeal.id }}
                  href="#contact"
                  className="mt-5 inline-flex min-h-11 items-center rounded-2xl bg-white px-4 text-sm font-bold text-zinc-950 transition hover:bg-white/90"
                >
                  View deal
                </BusinessEventLink>
              </div>
            ) : (
              <p className="mt-4 rounded-[26px] border border-white/10 bg-white/8 p-4 text-sm font-semibold text-white/62">
                No live deals right now.
              </p>
            )}
          </section>

          {business.description ? (
            <section className="spotnera-surface rounded-[30px] p-4 sm:p-5">
              <p className="spotnera-kicker text-white/42">About</p>
              <p className="mt-3 text-base leading-7 text-white/72">{business.description}</p>
            </section>
          ) : null}

          <section id="contact" className="spotnera-surface rounded-[30px] p-4 sm:p-5">
            <p className="spotnera-kicker text-white/42">Contact</p>
            {contactActions.length ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {contactActions.map((action) => (
                  <BusinessEventLink
                    business={business}
                    eventType={action.eventType}
                    gaParameters={{
                      contact_method: action.eventType.replace("_click", ""),
                    }}
                    key={action.href}
                    href={action.href}
                    target={action.external ? "_blank" : undefined}
                    rel={action.external ? "noopener noreferrer" : undefined}
                    className="rounded-2xl border border-white/10 bg-white/10 p-3 transition hover:bg-white/16"
                  >
                    <span className="block text-sm font-black text-white">{action.label}</span>
                    <span className="mt-1 block truncate text-xs font-semibold text-white/52">
                      {action.detail}
                    </span>
                  </BusinessEventLink>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm font-semibold text-white/58">
                Contact details are not available yet.
              </p>
            )}
          </section>

          {socialLinks.length ? (
            <section className="spotnera-surface rounded-[30px] p-4 sm:p-5">
              <p className="spotnera-kicker text-white/42">Social</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {socialLinks.map((link) => (
                  <BusinessEventLink
                    business={business}
                    eventType="social_click"
                    gaEventName="social_click"
                    gaParameters={{
                      social_platform: link.label.toLowerCase(),
                    }}
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white/74 transition hover:bg-white/16 hover:text-white"
                  >
                    {link.label}
                  </BusinessEventLink>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="grid gap-5">
          <section className="spotnera-surface rounded-[30px] p-4 sm:p-5">
            <p className="spotnera-kicker text-white/42">Location</p>
            <div className="mt-4">
              <BusinessProfileMap
                latitude={business.latitude}
                longitude={business.longitude}
                name={business.name}
              />
            </div>
            <div className="mt-4 text-sm leading-6 text-white/68">
              {business.address ? <p>{business.address}</p> : null}
              {locationLine ? <p>{locationLine}</p> : null}
              {!business.address && !locationLine ? <p>Location details are not available yet.</p> : null}
            </div>
          </section>

          <section className="spotnera-surface rounded-[30px] p-4 sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="spotnera-kicker text-white/42">Reviews</p>
                <h2 className="mt-2 text-3xl font-semibold">{formatRating(averageRating)}</h2>
              </div>
              <p className="text-sm font-semibold text-white/56">{getReviewLabel(reviewCount)}</p>
            </div>
            <div className="mt-4 grid gap-3">
              {reviews.length ? (
                reviews.slice(0, 8).map((review) => (
                  <article
                    key={review.id}
                    className="rounded-[24px] border border-white/10 bg-white/8 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-white">Customer review</p>
                      <span className="rounded-full bg-[#ffd166]/18 px-2.5 py-1 text-xs font-black text-[#ffd166]">
                        {review.rating}.0
                      </span>
                    </div>
                    {review.comment ? (
                      <p className="mt-2 text-sm leading-6 text-white/62">{review.comment}</p>
                    ) : (
                      <p className="mt-2 text-sm text-white/42">No comment left.</p>
                    )}
                  </article>
                ))
              ) : (
                <p className="rounded-[24px] border border-white/10 bg-white/8 p-4 text-sm font-semibold text-white/58">
                  No reviews yet.
                </p>
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
