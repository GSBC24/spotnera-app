import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminAction } from "@/components/admin-action";
import { getBusinessPath } from "@/lib/business-url";
import { getPlatformAdmin } from "@/lib/server/platform-admin";
import { available, getAdminUserDetails, listAdminUsers } from "@/lib/server/admin-directory.mjs";

export const dynamic = "force-dynamic";

const SECTIONS = ["overview", "businesses", "deals", "reviews", "users"];
const card = "rounded-2xl border border-white/10 bg-[#171d1a] p-5";

function adminDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.valueOf()) ? date.toLocaleDateString("en-GB") : "Date unavailable";
}

function Detail({ label, value }) {
  return <p><span className="text-white/50">{label}:</span> {value}</p>;
}

function UserKinds({ person }) {
  return <div className="flex flex-wrap gap-2 text-xs font-semibold">
    <span className="rounded-full border border-white/15 px-2 py-1 text-white/70">Registered user</span>
    {person.businesses.length ? <span className="rounded-full border border-[#72f0cc]/35 px-2 py-1 text-[#72f0cc]">Business owner</span> : null}
    {person.isPlatformAdmin ? <span className="rounded-full border border-amber-300/35 px-2 py-1 text-amber-200">Platform administrator</span> : null}
  </div>;
}

function Filter({ section, query }) {
  return <form action="/admin" className="mb-5 flex gap-2">
    <input type="hidden" name="section" value={section} />
    <input name="q" defaultValue={query} maxLength={80} placeholder={`Search ${section}`}
      className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#1b2520] px-4 py-2 text-white" />
    <button className="rounded-xl bg-[#33d6a6] px-4 py-2 font-semibold text-[#092019]">Search</button>
  </form>;
}

function ErrorNotice() {
  return <p role="alert" className={`${card} text-red-200`}>Admin data could not be loaded. Please refresh and try again.</p>;
}

async function count(admin, table, configure = (query) => query) {
  const { count: value, error } = await configure(admin.from(table).select("id", { count: "exact", head: true }));
  if (error) throw error;
  return value ?? 0;
}

async function Overview({ admin }) {
  let stats;
  let audit;
  try {
    const [businesses, verified, suspended, activeDeals, disabledDeals, reviews, users, auditResult] = await Promise.all([
      count(admin, "businesses"),
      count(admin, "businesses", (q) => q.not("verified_at", "is", null)),
      count(admin, "businesses", (q) => q.not("suspended_at", "is", null)),
      (async () => {
        const { count: value, error } = await admin.from("deals")
          .select("id, businesses!inner(id)", { count: "exact", head: true })
          .eq("is_active", true).eq("status", "active")
          .is("admin_disabled_at", null)
          .eq("businesses.is_active", true).is("businesses.suspended_at", null)
          .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`);
        if (error) throw error;
        return value ?? 0;
      })(),
      count(admin, "deals", (q) => q.not("admin_disabled_at", "is", null)),
      count(admin, "reviews", (q) => q.is("admin_hidden_at", null)),
      count(admin, "profiles"),
      admin.from("admin_audit_log").select("id, action, target_type, target_id, created_at")
        .order("created_at", { ascending: false }).limit(8),
    ]);
    if (auditResult.error) throw auditResult.error;
    audit = auditResult;
    stats = [
      ["Businesses", businesses], ["Verified businesses", verified],
      ["Awaiting verification", businesses - verified], ["Suspended businesses", suspended],
      ["Active Deals", activeDeals], ["Disabled Deals", disabledDeals],
      ["Visible reviews", reviews], ["Users", users],
    ];
  } catch { return <ErrorNotice />; }
  return <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([label, value]) =>
        <div key={label} className={card}><p className="text-sm text-white/60">{label}</p><p className="mt-2 text-3xl font-bold text-[#72f0cc]">{value}</p></div>)}</div>
      <section className={`${card} mt-6`}><h2 className="text-lg font-semibold">Recent actions</h2>
        <div className="mt-3 grid gap-2 text-sm text-white/65">{audit.data?.length ? audit.data.map((item) =>
          <p key={item.id}>{item.action.replaceAll("_", " ")} · {item.target_type} {item.target_id.slice(0, 8)} · {new Date(item.created_at).toLocaleDateString("en-GB")}</p>) :
          <p>No administrative actions yet.</p>}</div></section>
    </>;
}

async function Businesses({ admin, query, selected }) {
  let list = admin.from("businesses")
    .select("id, name, category, city, is_active, verified_at, suspended_at")
    .order("created_at", { ascending: false }).limit(100);
  if (query) list = list.or(`name.ilike.%${query}%,city.ilike.%${query}%`);
  const [{ data, error }, detail] = await Promise.all([
    list,
    selected ? admin.from("businesses")
      .select("id, slug, name, category, city, address, country, owner_id, description, phone, email, website_url, is_active, verified_at, suspended_at, created_at")
      .eq("id", selected).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (error || detail.error) return <ErrorNotice />;
  let owner = null;
  try {
    if (detail.data?.owner_id) owner = await getAdminUserDetails(admin, detail.data.owner_id);
  } catch { return <ErrorNotice />; }
  return <><Filter section="businesses" query={query} />
    {detail.data ? <section className={`${card} mb-5 space-y-5 text-sm text-white/70`}>
      <h2 className="text-xl font-semibold text-white">{detail.data.name}</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <h3 className="font-semibold text-white">Business owner · personal contact</h3>
          <Detail label="Name" value={owner?.name ?? "Name unavailable"} />
          <Detail label="Email" value={owner?.email ?? "Email unavailable"} />
          <Detail label="Phone" value={owner?.phone ?? "Phone not provided"} />
          <p className="break-all text-xs text-white/45">Owner ID: {detail.data.owner_id ?? "Unavailable"}</p>
        </div>
        <div className="grid content-start gap-2">
          <h3 className="font-semibold text-white">Business · public contact</h3>
          <Detail label="Phone" value={available(detail.data.phone, "Phone not provided")} />
          <Detail label="Email" value={available(detail.data.email, "Email unavailable")} />
          <Detail label="Address" value={available(detail.data.address, "Address not provided")} />
          <Detail label="City" value={available(detail.data.city, "City unavailable")} />
          {detail.data.country ? <Detail label="Country" value={detail.data.country} /> : null}
          {detail.data.website_url ? <Detail label="Website" value={detail.data.website_url} /> : null}
        </div>
      </div>
      <div className="grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-2">
        <Detail label="Category" value={available(detail.data.category, "Unavailable")} />
        <Detail label="Created" value={adminDate(detail.data.created_at)} />
        <Detail label="Verification" value={detail.data.verified_at ? "Verified" : "Not verified"} />
        <Detail label="Operational" value={detail.data.suspended_at ? "Suspended" : detail.data.is_active ? "Active" : "Owner hidden"} />
        <p className="break-all text-xs text-white/45">Business ID: {detail.data.id}</p>
      </div>
      {detail.data.description ? <p>{detail.data.description}</p> : null}
      <Link className="text-[#72f0cc] underline" href={getBusinessPath(detail.data)}>View public profile</Link>
    </section> : null}
    <div className="grid gap-3">{data?.map((business) => <article key={business.id} className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div>
        <h2 className="font-semibold">{business.name}</h2>
        <p className="text-sm text-white/60">{business.category} · {business.city}</p>
        <p className="mt-2 text-sm">{business.verified_at ? "Verified ✓" : "Not verified"} · {business.suspended_at ? "Suspended" : "Active"}{!business.is_active ? " · Owner hidden" : ""}</p>
      </div><Link href={`/admin?section=businesses&selected=${business.id}`} className="text-sm text-[#72f0cc] underline">Inspect</Link></div>
      <div className="mt-4 flex flex-wrap gap-2">
        <AdminAction action={business.verified_at ? "BUSINESS_VERIFICATION_REMOVED" : "BUSINESS_VERIFIED"}
          targetId={business.id} label={business.verified_at ? "Remove verification" : "Verify business"} confirm={Boolean(business.verified_at)} />
        <AdminAction action={business.suspended_at ? "BUSINESS_RESTORED" : "BUSINESS_SUSPENDED"}
          targetId={business.id} label={business.suspended_at ? "Restore business" : "Suspend business"}
          confirm={!business.suspended_at} reason={!business.suspended_at} />
      </div>
    </article>)}{!data?.length ? <p className="text-white/60">No businesses found.</p> : null}</div></>;
}

async function Deals({ admin, query }) {
  let list = admin.from("deals")
    .select("id, business_id, title, description, is_active, status, admin_disabled_at, created_at, businesses(name, slug)")
    .order("created_at", { ascending: false }).limit(100);
  if (query) list = list.ilike("title", `%${query}%`);
  const { data, error } = await list;
  if (error) return <ErrorNotice />;
  return <><Filter section="deals" query={query} /><div className="grid gap-3">{data?.map((deal) =>
    <article key={deal.id} className={card}>
      <h2 className="font-semibold">{deal.title}</h2>
      <p className="mt-1 text-sm text-white/60">{deal.businesses?.name} · {deal.status} · {deal.admin_disabled_at ? "Disabled by admin" : deal.is_active ? "Owner active" : "Owner paused"}</p>
      {deal.description ? <p className="mt-2 text-sm text-white/70">{deal.description}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {deal.businesses ? <Link className="text-sm text-[#72f0cc] underline" href={getBusinessPath({ id: deal.business_id, slug: deal.businesses.slug })}>View Deal</Link> : null}
        <AdminAction action={deal.admin_disabled_at ? "DEAL_RESTORED" : "DEAL_DISABLED"}
          targetId={deal.id} label={deal.admin_disabled_at ? "Restore Deal" : "Disable Deal"}
          confirm={!deal.admin_disabled_at} reason={!deal.admin_disabled_at} />
      </div>
    </article>)}{!data?.length ? <p className="text-white/60">No Deals found.</p> : null}</div></>;
}

async function Reviews({ admin, query }) {
  let list = admin.from("reviews")
    .select("id, business_id, user_id, rating, comment, admin_hidden_at, created_at, businesses(name)")
    .order("created_at", { ascending: false }).limit(100);
  if (query) list = list.ilike("comment", `%${query}%`);
  const { data, error } = await list;
  if (error) return <ErrorNotice />;
  return <><Filter section="reviews" query={query} /><div className="grid gap-3">{data?.map((review) =>
    <article key={review.id} className={card}>
      <p className="font-semibold">{review.businesses?.name} · {review.rating}/5</p>
      <p className="mt-1 text-xs text-white/45">Review {review.id} · Author {review.user_id}</p>
      <p className="mt-2 whitespace-pre-line text-sm text-white/70">{review.comment || "No comment"}</p>
      <p className="my-2 text-sm">{review.admin_hidden_at ? "Hidden by admin" : "Visible"}</p>
      <AdminAction action={review.admin_hidden_at ? "REVIEW_RESTORED" : "REVIEW_HIDDEN"}
        targetId={review.id} label={review.admin_hidden_at ? "Restore Review" : "Hide Review"}
        confirm={!review.admin_hidden_at} reason={!review.admin_hidden_at} />
    </article>)}{!data?.length ? <p className="text-white/60">No reviews found.</p> : null}</div></>;
}

async function Users({ admin, query, selected }) {
  let users;
  let detail;
  try {
    [users, detail] = await Promise.all([
      listAdminUsers(admin, query),
      selected ? getAdminUserDetails(admin, selected) : Promise.resolve(null),
    ]);
  } catch { return <ErrorNotice />; }
  return <><Filter section="users" query={query} />
    <p className="mb-4 text-xs text-white/45">Showing up to 100 accounts. Search filters this list by name, email or ID.</p>
    {detail ? <section className={`${card} mb-5 space-y-4 text-sm text-white/70`}>
      <h2 className="text-xl font-semibold text-white">User details</h2>
      <UserKinds person={detail} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Detail label="Name" value={detail.name} />
        <Detail label="Email" value={detail.email} />
        <Detail label="Phone" value={detail.phone} />
        <Detail label="Registered" value={adminDate(detail.createdAt)} />
        <Detail label="Platform admin" value={detail.isPlatformAdmin ? "Yes" : "No"} />
        <Detail label="Businesses owned" value={detail.businesses.length} />
        <p className="break-all text-xs text-white/45 sm:col-span-2">User ID: {detail.id}</p>
      </div>
      {detail.businesses.length ? <div className="border-t border-white/10 pt-4">
        <h3 className="font-semibold text-white">Owned businesses</h3>
        <ul className="mt-2 list-inside list-disc space-y-1">{detail.businesses.map((business) => <li key={business.id}>{business.name}</li>)}</ul>
      </div> : null}
    </section> : null}
    <div className="grid gap-3">{users.map((user) => <article key={user.id} className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h2 className="font-semibold">{user.name}</h2>
          <p className="break-all text-sm text-white/60">{user.email}</p>
          <UserKinds person={user} />
          <p className="break-all text-xs text-white/45">{user.id} · Joined {adminDate(user.createdAt)} · {user.businesses.length} businesses</p>
        </div>
        <Link href={`/admin?section=users&selected=${user.id}`} className="text-sm text-[#72f0cc] underline">Inspect</Link>
      </div>
    </article>)}{!users.length ? <p className="text-white/60">No users found.</p> : null}</div></>;
}

export default async function AdminPage({ searchParams }) {
  const access = await getPlatformAdmin();
  if (access.status === 401) redirect("/?auth=1&next=/admin");
  if (access.status !== 200) notFound();
  const params = await searchParams;
  const section = SECTIONS.includes(params?.section) ? params.section : "overview";
  const rawQuery = typeof params?.q === "string" ? params.q.trim().slice(0, 80) : "";
  const query = section === "users" ? rawQuery : rawQuery.replace(/[^\p{L}\p{N}\s-]/gu, "");
  const selected = typeof params?.selected === "string" && /^[0-9a-f-]{36}$/i.test(params.selected) ? params.selected : null;
  return <main className="min-h-screen bg-[#0d1310] px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-[#72f0cc]">Spotnera</p>
          <h1 className="mt-1 text-3xl font-semibold">Admin</h1></div>
        <Link href="/" className="text-sm text-white/60 underline">Back to Spotnera</Link>
      </div>
      <nav aria-label="Admin sections" className="mb-8 flex flex-wrap gap-2">{SECTIONS.map((item) =>
        <Link key={item} href={`/admin?section=${item}`} aria-current={section === item ? "page" : undefined}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${section === item ? "bg-[#33d6a6] text-[#092019]" : "border border-white/15 text-white/75"}`}>
          {item[0].toUpperCase() + item.slice(1)}</Link>)}</nav>
      {section === "overview" ? <Overview admin={access.admin} /> : null}
      {section === "businesses" ? <Businesses admin={access.admin} query={query} selected={selected} /> : null}
      {section === "deals" ? <Deals admin={access.admin} query={query} /> : null}
      {section === "reviews" ? <Reviews admin={access.admin} query={query} /> : null}
      {section === "users" ? <Users admin={access.admin} query={query} selected={selected} /> : null}
    </div>
  </main>;
}
