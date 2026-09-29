import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminAction } from "@/components/admin-action";
import { getBusinessPath } from "@/lib/business-url";
import { getPlatformAdmin } from "@/lib/server/platform-admin";

export const dynamic = "force-dynamic";

const SECTIONS = ["overview", "businesses", "deals", "reviews", "users"];
const card = "rounded-2xl border border-white/10 bg-[#171d1a] p-5";

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
    .select("id, slug, name, category, city, address, owner_id, description, created_at, is_active, verified_at, suspended_at")
    .order("created_at", { ascending: false }).limit(100);
  if (query) list = list.or(`name.ilike.%${query}%,city.ilike.%${query}%`);
  const [{ data, error }, detail] = await Promise.all([
    list,
    selected ? admin.from("businesses")
      .select("id, slug, name, category, city, address, country, owner_id, description, phone, email, website_url, is_active, verified_at, suspended_at, created_at")
      .eq("id", selected).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (error || detail.error) return <ErrorNotice />;
  return <><Filter section="businesses" query={query} />
    {detail.data ? <section className={`${card} mb-5 grid gap-2 text-sm text-white/70`}>
      <h2 className="text-xl font-semibold text-white">{detail.data.name}</h2>
      <p>{detail.data.category} · {detail.data.city}, {detail.data.country}</p>
      {detail.data.address ? <p>{detail.data.address}</p> : null}
      {detail.data.description ? <p>{detail.data.description}</p> : null}
      <p>Owner ID: {detail.data.owner_id}</p>
      <p>Business ID: {detail.data.id}</p>
      <p>Created: {new Date(detail.data.created_at).toLocaleDateString("en-GB")}</p>
      <p>Verification: {detail.data.verified_at ? "Verified" : "Not verified"}</p>
      <p>Operational: {detail.data.suspended_at ? "Suspended" : "Active"}</p>
      {detail.data.phone ? <p>Public business phone: {detail.data.phone}</p> : null}
      {detail.data.email ? <p>Public business email: {detail.data.email}</p> : null}
      {detail.data.website_url ? <p>Website: {detail.data.website_url}</p> : null}
      <Link className="text-[#72f0cc] underline" href={getBusinessPath(detail.data)}>View public profile</Link>
    </section> : null}
    <div className="grid gap-3">{data?.map((business) => <article key={business.id} className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div>
        <h2 className="font-semibold">{business.name}</h2>
        <p className="text-sm text-white/60">{business.category} · {business.city}{business.address ? ` · ${business.address}` : ""}</p>
        <p className="mt-1 text-xs text-white/45">Owner {business.owner_id}</p>
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

async function Users({ admin, query }) {
  let list = admin.from("profiles").select("id, username, first_name, last_name, created_at")
    .order("created_at", { ascending: false }).limit(100);
  if (query) list = list.ilike("username", `%${query}%`);
  const { data, error } = await list;
  if (error) return <ErrorNotice />;
  return <><Filter section="users" query={query} /><p className="mb-4 text-xs text-white/45">Showing up to 100 accounts.</p>
    <div className="grid gap-3">{data?.map((user) => <article key={user.id} className={card}>
      <h2 className="font-semibold">{[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username}</h2>
      <p className="text-sm text-white/60">@{user.username}</p>
      <p className="mt-1 text-xs text-white/45">{user.id} · Joined {new Date(user.created_at).toLocaleDateString("en-GB")}</p>
    </article>)}{!data?.length ? <p className="text-white/60">No users found.</p> : null}</div></>;
}

export default async function AdminPage({ searchParams }) {
  const access = await getPlatformAdmin();
  if (access.status === 401) redirect("/?auth=1&next=/admin");
  if (access.status !== 200) notFound();
  const params = await searchParams;
  const section = SECTIONS.includes(params?.section) ? params.section : "overview";
  const query = typeof params?.q === "string" ? params.q.trim().slice(0, 80).replace(/[^\p{L}\p{N}\s-]/gu, "") : "";
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
      {section === "users" ? <Users admin={access.admin} query={query} /> : null}
    </div>
  </main>;
}
