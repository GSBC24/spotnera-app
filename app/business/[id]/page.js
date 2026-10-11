import Link from "next/link";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { BusinessEventLink } from "@/components/business-event-link";
import { BusinessProfileAnalytics } from "@/components/business-profile-analytics";
import { BusinessProfileBottomNav } from "@/components/business-profile-bottom-nav";
import { HelpLink } from "@/components/help-link";
import { BusinessProfileFavorite } from "@/components/business-profile-favorite";
import { BusinessProfileMap } from "@/components/business-profile-map";
import { BusinessOpeningHoursPanel, BusinessOpeningStatus } from "@/components/business-opening-hours";
import { BusinessLocationActions } from "@/components/business-location-actions";
import { BusinessProfileDeals } from "@/components/business-profile-deals";
import { BusinessProfileReviews } from "@/components/business-profile-reviews";
import { BusinessShareActions } from "@/components/business-share-actions";
import { BusinessContactActions } from "@/components/business-contact-actions";
import { getBusinessAddressLines } from "@/lib/business-address.mjs";
import { getBusinessPath, getBusinessUrl } from "@/lib/business-url";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BUSINESS_SELECT = `
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
  verified_at,
  business_opening_hours (id, day_of_week, is_closed, open_time, close_time, spans_midnight)
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
  ends_at,
  availability_mode,
  availability_timezone,
  deal_schedules (
    id,
    day_of_week,
    start_time,
    end_time,
    spans_midnight
  )
`;

const REVIEW_SELECT = `
  id,
  business_id,
  user_id,
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
  return SOCIAL_PROFILES.map((profile) => {
    const href = getSocialUrl(business[profile.field], profile);
    if (!href) return null;
    const url = new URL(href);
    return {
      label: profile.label,
      href,
      detail: `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}${url.search}`,
    };
  }).filter(Boolean);
}

function getContactActions(business) {
  const phone = getDisplayValue(business.phone);
  const phoneHref = phone ? getPhoneHref(phone) : null;
  const emailHref = getEmailHref(business.email);
  const websiteUrl = getWebsiteUrl(business.website_url);

  return [
    phone && phoneHref
      ? { label: "Phone", action: "Call", icon: "phone", detail: phone, href: phoneHref, external: false, eventType: "call_click" }
      : null,
    emailHref
      ? { label: "Email", action: "Send email", icon: "email", detail: getDisplayValue(business.email), href: emailHref, external: false, eventType: "email_click" }
      : null,
    websiteUrl
      ? {
          label: "Website",
          action: "Visit",
          icon: "website",
          detail: getWebsiteDisplayLabel(websiteUrl),
          href: websiteUrl,
          external: true,
          eventType: "website_click",
        }
      : null,
  ].filter(Boolean);
}

function ContactIcon({ kind }) {
  const path = {
    phone: "M6.6 3.7 9 6.1 7.7 8.5a15.1 15.1 0 0 0 7.8 7.8l2.4-1.3 2.4 2.4-1.4 2.6a2 2 0 0 1-2.1 1A19.5 19.5 0 0 1 3 7.2a2 2 0 0 1 1-2.1l2.6-1.4Z",
    email: "M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Zm0 0 9 7 9-7",
    website: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-9 10h18M12 2c2.5 2.7 3.8 6 3.8 10S14.5 19.3 12 22M12 2c-2.5 2.7-3.8 6-3.8 10S9.5 19.3 12 22",
  }[kind];
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-[#72f0cc]"><path d={path} /></svg>;
}

function applyBusinessIdentifier(query, identifier) {
  return UUID_PATTERN.test(identifier)
    ? query.eq("id", identifier)
    : query.eq("slug", identifier);
}

async function getPublicBusiness(identifier) {
  if (!hasSupabaseEnv()) {
    return { business: null, error: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const businessQuery = supabase
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("is_active", true)
    .is("suspended_at", null);
  const { data: business, error: businessError } = await applyBusinessIdentifier(
    businessQuery,
    identifier,
  ).maybeSingle();

  if (businessError) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Public business query failed", businessError.message);
    }
    return { business: null, error: "load_failed" };
  }

  if (!business) {
    return { business: null, error: null };
  }

  if (UUID_PATTERN.test(identifier)) {
    permanentRedirect(getBusinessPath(business));
  }

  const businessId = business.id;

  const now = new Date();
  const [{ data: deals, error: dealsError }, { data: reviews, error: reviewsError }] =
    await Promise.all([
      supabase
        .from("deals")
        .select(DEAL_SELECT)
        .eq("business_id", businessId)
        .eq("is_active", true)
        .is("admin_disabled_at", null)
        .or(`ends_at.is.null,ends_at.gt.${now.toISOString()}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("reviews")
        .select(REVIEW_SELECT)
        .eq("business_id", businessId)
        .is("admin_hidden_at", null)
        .order("created_at", { ascending: false }),
    ]);

  if (dealsError) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Public business deals query failed", dealsError.message);
    }
  }

  if (reviewsError) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Public business reviews query failed", reviewsError.message);
    }
  }

  let isFavorite = false;

  if (user) {
    const { data: favorite } = await supabase
      .from("favorites")
      .select("business_id")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();

    isFavorite = Boolean(favorite);
  }

  return {
    business: {
      ...business,
      deals: deals ?? [],
      reviews: reviews ?? [],
      currentUserId: user?.id ?? null,
      isFavorite,
      isOwner: Boolean(user && business.owner_id === user.id),
      isAuthenticated: Boolean(user),
    },
    error: null,
  };
}

export async function generateMetadata({ params }) {
  const { id } = await params;

  if (!hasSupabaseEnv()) {
    return {
      title: "Business not found | Spotnera®",
      description: "This Spotnera business profile is not available.",
    };
  }

  const supabase = await createClient();
  const metadataQuery = supabase
    .from("businesses")
    .select("id, slug, name, category, city, country, description, logo_url, cover_image_url, is_active")
    .eq("is_active", true)
    .is("suspended_at", null);
  const { data: business } = await applyBusinessIdentifier(metadataQuery, id).maybeSingle();

  if (!business) {
    return {
      title: "Business not found | Spotnera®",
      description: "This Spotnera business profile is not available.",
    };
  }

  const title = `${business.name} | Spotnera®`;
  const description =
    business.description ||
    [business.category, business.city, business.country].filter(Boolean).join(" in ") ||
    "Discover this business on Spotnera.";
  const image = business.cover_image_url || business.logo_url || "/icons/spotnera-icon-512.png";
  const url = getBusinessUrl(business);

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
      siteName: "Spotnera®",
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
            <p className="spotnera-kicker text-zinc-500">Spotnera®</p>
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
  const ownReview = business.isAuthenticated
    ? reviews.find((review) => review.user_id === business.currentUserId) ?? null : null;
  const publicReviews = reviews.map(({ id, rating, comment, created_at }) => ({
    id, rating, comment, created_at,
  }));
  const averageRating = getAverageRating(reviews);
  const contactActions = getContactActions(business);
  const socialLinks = getSocialLinks(business);
  const locationLine = [business.city, business.country].filter(Boolean).join(", ");
  const addressLines = getBusinessAddressLines(business);
  const reviewCount = reviews.length;
  const profileDealBusiness = {
    id: business.id,
    slug: business.slug,
    name: business.name,
    category: business.category,
    address: business.address,
    city: business.city,
    country: business.country,
    is_active: business.is_active,
  };

  return (
    <main className="spotnera-app-shell spotnera-functional-area min-h-screen overflow-x-hidden">
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
              <p className="spotnera-kicker text-white/55">Spotnera®</p>
              <p className="truncate text-sm font-bold text-white/82">Public business profile</p>
            </div>
          </Link>
          <HelpLink />
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
            <div className="relative flex min-h-[280px] w-full min-w-0 items-end bg-gradient-to-b from-black/45 via-[#151821]/85 to-[#151821] p-5 sm:min-h-[360px] sm:bg-none sm:p-6 lg:p-8">
              <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-5 grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[24px] border border-white/30 bg-white text-2xl font-black text-zinc-900 shadow-[0_18px_50px_rgba(0,0,0,0.32)] sm:mb-4">
                    {business.logo_url ? (
                      <Image src={business.logo_url} alt={`${business.name} logo`} width={96} height={96} unoptimized className="h-full w-full object-contain object-center p-2" />
                    ) : business.name.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="spotnera-kicker text-[#72f0cc] [overflow-wrap:anywhere]">{business.category}</p>
                  <h1 className="mt-2 max-w-3xl text-3xl font-semibold leading-tight tracking-normal [overflow-wrap:anywhere] sm:text-5xl sm:leading-[1.02] lg:text-6xl">
                    {business.name}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <BusinessOpeningStatus hours={business.business_opening_hours} />
                    <span className="rounded-full border border-[#33d6a6]/30 bg-[#33d6a6]/12 px-3 py-1 text-xs font-semibold text-[#72f0cc]">Public listing</span>
                    <span className="text-xs font-semibold text-[#72f0cc]">{business.verified_at ? "✓ Verified business" : "Business information not yet verified"}</span>
                  </div>
                  <p className="mt-2 max-w-2xl text-xs text-white/55">Verification means Spotnera checked information or control associated with this business. It does not guarantee quality, prices, safety, reliability, or individual Deals.</p>
                  <div className="mt-4 flex min-w-0 flex-col items-start gap-2 text-sm font-semibold text-white/72 sm:mt-3 sm:flex-row sm:flex-wrap sm:items-center">
                    {locationLine ? <span className="[overflow-wrap:anywhere]">{locationLine}</span> : null}
                    {locationLine ? <span className="hidden text-white/32 sm:inline">/</span> : null}
                    <a href="#reviews" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] [overflow-wrap:anywhere]">
                      {formatRating(averageRating)} rating
                      <span className="text-white/44"> ({getReviewLabel(reviewCount)})</span>
                    </a>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-3 lg:items-end">
                  <BusinessShareActions
                    businessId={business.id}
                    businessSlug={business.slug}
                    businessCategory={business.category}
                    city={business.city}
                    country={business.country}
                    title={business.name}
                  >
                    <BusinessProfileFavorite
                      businessId={business.id}
                      businessSlug={business.slug}
                      businessCategory={business.category}
                      city={business.city}
                      country={business.country}
                      initialIsFavorite={business.isFavorite}
                      isAuthenticated={business.isAuthenticated}
                    />
                  </BusinessShareActions>
                  {business.isOwner ? (
                    <Link href="/owner" className="spotnera-secondary-action inline-flex min-h-12 items-center justify-center gap-2 self-start px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] lg:self-end">
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0"><path d="M4 7h16M4 17h16M9 4v6M15 14v6" /></svg>
                      Manage business
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5">
          <BusinessOpeningHoursPanel hours={business.business_opening_hours} />
          <BusinessProfileDeals business={profileDealBusiness} deals={business.deals} initialNow={new Date().toISOString()} />

          {business.description ? (
            <section className="spotnera-surface rounded-[30px] p-4 sm:p-5">
              <p className="spotnera-kicker text-white/42">About</p>
              <p className="mt-3 text-base leading-7 text-white/72">{business.description}</p>
            </section>
          ) : null}

          <section id="contact" className="spotnera-surface rounded-[30px] p-4 sm:p-5">
            <p className="spotnera-kicker text-white/42">Contact</p>
            {contactActions.length ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {contactActions.map((action) => (
                  action.icon === "phone" || action.icon === "email" ? (
                    <BusinessContactActions key={action.href} business={business} action={action} />
                  ) : (
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
                    className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]"
                  >
                    <ContactIcon kind={action.icon} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-white">{action.label}</span>
                      <span className="mt-1 block text-xs font-semibold text-white/70 [overflow-wrap:anywhere]">{action.detail}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-[#72f0cc]">{action.action}</span>
                  </BusinessEventLink>
                  )
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
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
                    className="min-w-0 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]"
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-bold text-white"><span>{link.label}</span><span aria-hidden="true" className="text-[#72f0cc]">↗</span></span>
                    <span className="mt-1 block text-xs font-semibold text-white/70 [overflow-wrap:anywhere]">{link.detail}</span>
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
            <div className="mt-4 min-w-0 text-sm leading-6 text-white/68 [overflow-wrap:anywhere]">
              {addressLines.length ? addressLines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>Location details are not available yet.</p>}
            </div>
            <BusinessLocationActions business={business} className="mt-3" source="business_profile" />
          </section>

          <BusinessProfileReviews business={{ id: business.id, slug: business.slug,
            category: business.category, city: business.city, country: business.country }}
            initialReviews={publicReviews}
            initialOwnReview={ownReview ? { id: ownReview.id, rating: ownReview.rating,
              comment: ownReview.comment, created_at: ownReview.created_at } : null}
            isAuthenticated={business.isAuthenticated} />
        </aside>
      </section>
      <BusinessProfileBottomNav isAuthenticated={business.isAuthenticated} />
    </main>
  );
}
