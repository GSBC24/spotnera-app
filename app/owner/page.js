import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";

const BUSINESS_FIELDS = `
  id,
  owner_id,
  name,
  category,
  description,
  city,
  address,
  latitude,
  longitude,
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
  status,
  starts_at,
  ends_at,
  created_at,
  updated_at
`;

const REVIEW_FIELDS = `
  id,
  business_id,
  rating,
  comment,
  created_at
`;

const DEAL_STATUSES = ["active", "scheduled", "paused", "ended"];

function getString(formData, key) {
  return String(formData.get(key) ?? "").trim();
}

function getNullableString(formData, key) {
  const value = getString(formData, key);
  return value || null;
}

function getNumber(formData, key) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : null;
}

function getNullableTimestamp(formData, key) {
  const value = getString(formData, key);
  return value ? new Date(value).toISOString() : null;
}

function formatDateTimeLocal(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 16);
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

function buildBusinessPayload(formData, userId) {
  return {
    owner_id: userId,
    name: getString(formData, "name"),
    category: getString(formData, "category"),
    description: getNullableString(formData, "description"),
    city: getString(formData, "city"),
    address: getNullableString(formData, "address"),
    latitude: getNumber(formData, "latitude"),
    longitude: getNumber(formData, "longitude"),
    is_active: formData.get("is_active") === "on",
    updated_at: new Date().toISOString(),
  };
}

function buildDealPayload(formData, userId) {
  const status = getString(formData, "status");

  return {
    business_id: getString(formData, "business_id"),
    owner_id: userId,
    title: getString(formData, "title"),
    description: getNullableString(formData, "description"),
    status: DEAL_STATUSES.includes(status) ? status : "active",
    starts_at: getNullableTimestamp(formData, "starts_at"),
    ends_at: getNullableTimestamp(formData, "ends_at"),
    updated_at: new Date().toISOString(),
  };
}

function validateBusiness(payload) {
  if (!payload.name || !payload.category || !payload.city) {
    return "Name, category, and city are required.";
  }

  if (payload.latitude === null || payload.longitude === null) {
    return "Latitude and longitude are required.";
  }

  return null;
}

function validateDeal(payload) {
  if (!payload.business_id || !payload.title) {
    return "Choose a business and add a deal title.";
  }

  if (payload.starts_at && payload.ends_at && payload.starts_at >= payload.ends_at) {
    return "Deal end time must be after the start time.";
  }

  return null;
}

async function getSignedInUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return { supabase, user };
}

function redirectWithError(message) {
  redirect(`/owner?error=${encodeURIComponent(message)}`);
}

async function createBusiness(formData) {
  "use server";

  const { supabase, user } = await getSignedInUser();
  const payload = buildBusinessPayload(formData, user.id);
  const validationError = validateBusiness(payload);

  if (validationError) {
    redirectWithError(validationError);
  }

  const { error } = await supabase.from("businesses").insert(payload);

  if (error) {
    redirectWithError(error.message);
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

  const { error } = await supabase
    .from("businesses")
    .update(payload)
    .eq("id", businessId)
    .eq("owner_id", user.id);

  if (error) {
    redirectWithError(error.message);
  }

  revalidatePath("/owner");
  redirect("/owner");
}

async function createDeal(formData) {
  "use server";

  const { supabase, user } = await getSignedInUser();
  const payload = buildDealPayload(formData, user.id);
  const validationError = validateDeal(payload);

  if (validationError) {
    redirectWithError(validationError);
  }

  const { error } = await supabase.from("deals").insert(payload);

  if (error) {
    redirectWithError(error.message);
  }

  revalidatePath("/owner");
  redirect("/owner");
}

async function updateDeal(formData) {
  "use server";

  const { supabase, user } = await getSignedInUser();
  const dealId = getString(formData, "deal_id");
  const payload = buildDealPayload(formData, user.id);
  const validationError = validateDeal(payload);

  if (!dealId || validationError) {
    redirectWithError(validationError ?? "Missing deal id.");
  }

  const { error } = await supabase
    .from("deals")
    .update(payload)
    .eq("id", dealId)
    .eq("owner_id", user.id);

  if (error) {
    redirectWithError(error.message);
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
      className="h-12 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/10"
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className="min-h-20 resize-none rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/10"
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="h-12 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/10"
    />
  );
}

function SubmitButton({ children }) {
  return (
    <button
      type="submit"
      className="h-12 rounded-2xl bg-zinc-950 px-4 text-sm font-bold text-white shadow-[0_18px_40px_rgba(24,24,27,0.2)] transition hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

function BusinessForm({ action, business, submitLabel }) {
  return (
    <form action={action} className="grid gap-3">
      {business ? <input type="hidden" name="business_id" value={business.id} /> : null}
      <Field label="Business name">
        <TextInput name="name" required minLength={2} maxLength={120} defaultValue={business?.name ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <TextInput name="category" required minLength={2} maxLength={80} defaultValue={business?.category ?? ""} />
        </Field>
        <Field label="City">
          <TextInput name="city" required minLength={2} maxLength={120} defaultValue={business?.city ?? ""} />
        </Field>
      </div>
      <Field label="Description">
        <TextArea name="description" maxLength={1000} defaultValue={business?.description ?? ""} />
      </Field>
      <Field label="Address">
        <TextInput name="address" defaultValue={business?.address ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude">
          <TextInput name="latitude" required type="number" step="any" min="-90" max="90" defaultValue={business?.latitude ?? ""} />
        </Field>
        <Field label="Longitude">
          <TextInput name="longitude" required type="number" step="any" min="-180" max="180" defaultValue={business?.longitude ?? ""} />
        </Field>
      </div>
      <label className="flex h-12 items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-800">
        Active listing
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={business?.is_active ?? true}
          className="h-5 w-5 accent-zinc-950"
        />
      </label>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

function DealForm({ action, deal, businesses, submitLabel }) {
  return (
    <form action={action} className="grid gap-3">
      {deal ? <input type="hidden" name="deal_id" value={deal.id} /> : null}
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <Select name="status" defaultValue={deal?.status ?? "active"}>
            {DEAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Starts">
          <TextInput name="starts_at" type="datetime-local" defaultValue={formatDateTimeLocal(deal?.starts_at)} />
        </Field>
      </div>
      <Field label="Ends">
        <TextInput name="ends_at" type="datetime-local" defaultValue={formatDateTimeLocal(deal?.ends_at)} />
      </Field>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
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
  const { supabase, user } = await getSignedInUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
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
  let favorites = [];

  if (businessIds.length) {
    const [
      { data: dealRows },
      { data: reviewRows },
      { data: favoriteRows },
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
      supabase
        .from("favorites")
        .select("business_id")
        .in("business_id", businessIds),
    ]);

    deals = dealRows ?? [];
    reviews = reviewRows ?? [];
    favorites = favoriteRows ?? [];
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
  for (const favorite of favorites) {
    favoriteCountsByBusinessId.set(
      favorite.business_id,
      (favoriteCountsByBusinessId.get(favorite.business_id) ?? 0) + 1,
    );
  }

  const totalFavorites = favorites.length;
  const activeDealCount = deals.filter((deal) => deal.status === "active").length;
  const averageRating = getAverageRating(reviews);

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-zinc-950">
      <section className="mx-auto flex min-h-screen w-full max-w-[720px] flex-col gap-5 px-4 pb-10 pt-4 sm:px-6">
        <header className="rounded-[2rem] border border-white bg-white/86 p-4 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">
                Owner dashboard
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {profile?.username ? `${profile.username}'s businesses` : "Your businesses"}
              </h1>
            </div>
            <Link
              href="/"
              className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700"
            >
              Explore
            </Link>
          </div>
          {resolvedSearchParams?.error ? (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {resolvedSearchParams.error}
            </p>
          ) : null}
          {businessesError ? (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {businessesError.message}
            </p>
          ) : null}
        </header>

        <section className="grid grid-cols-2 gap-3">
          <StatTile label="Businesses" value={businesses.length} />
          <StatTile label="Active deals" value={activeDealCount} />
          <StatTile label="Reviews" value={reviews.length} />
          <StatTile label="Favorites" value={totalFavorites} />
        </section>

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                Portfolio
              </p>
              <h2 className="mt-1 text-xl font-semibold">Business statistics</h2>
            </div>
            <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-bold text-white">
              {formatRating(averageRating)} avg
            </span>
          </div>

          <div className="grid gap-3">
            {businesses.length ? (
              businesses.map((business) => {
                const businessDeals = dealsByBusinessId.get(business.id) ?? [];
                const businessReviews = reviewsByBusinessId.get(business.id) ?? [];
                const favoriteCount = favoriteCountsByBusinessId.get(business.id) ?? 0;

                return (
                  <article key={business.id} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold">{business.name}</h3>
                        <p className="mt-1 text-sm text-zinc-500">
                          {business.category} - {business.city}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        business.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-200 text-zinc-600"
                      }`}>
                        {business.is_active ? "Active" : "Hidden"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                      <div className="rounded-2xl bg-white p-2">
                        <p className="font-black">{businessDeals.length}</p>
                        <p className="text-[10px] font-bold uppercase text-zinc-400">Deals</p>
                      </div>
                      <div className="rounded-2xl bg-white p-2">
                        <p className="font-black">{formatRating(getAverageRating(businessReviews))}</p>
                        <p className="text-[10px] font-bold uppercase text-zinc-400">Rating</p>
                      </div>
                      <div className="rounded-2xl bg-white p-2">
                        <p className="font-black">{businessReviews.length}</p>
                        <p className="text-[10px] font-bold uppercase text-zinc-400">Reviews</p>
                      </div>
                      <div className="rounded-2xl bg-white p-2">
                        <p className="font-black">{favoriteCount}</p>
                        <p className="text-[10px] font-bold uppercase text-zinc-400">Saved</p>
                      </div>
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

        <section className="grid gap-4">
          <details open className="rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-lg font-bold">Create business</summary>
            <div className="mt-4">
              <BusinessForm action={createBusiness} submitLabel="Create business" />
            </div>
          </details>

          {businesses.map((business) => (
            <details key={business.id} className="rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-lg font-bold">Edit {business.name}</summary>
              <div className="mt-4">
                <BusinessForm action={updateBusiness} business={business} submitLabel="Save business" />
              </div>
            </details>
          ))}
        </section>

        <section className="grid gap-4">
          <details open={Boolean(businesses.length)} className="rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-lg font-bold">Create deal</summary>
            <div className="mt-4">
              {businesses.length ? (
                <DealForm action={createDeal} businesses={businesses} submitLabel="Create deal" />
              ) : (
                <p className="text-sm font-medium text-zinc-500">Create a business before adding deals.</p>
              )}
            </div>
          </details>

          {deals.map((deal) => (
            <details key={deal.id} className="rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-lg font-bold">Edit {deal.title}</summary>
              <div className="mt-4">
                <DealForm action={updateDeal} deal={deal} businesses={businesses} submitLabel="Save deal" />
              </div>
            </details>
          ))}
        </section>

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm">
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
      </section>
    </main>
  );
}
