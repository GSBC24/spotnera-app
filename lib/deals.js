export const DEAL_STATUS = {
  DISABLED: "DISABLED",
  SCHEDULED: "SCHEDULED",
  LIVE: "LIVE",
  EXPIRED: "EXPIRED",
};

export const DEAL_STATUS_META = {
  [DEAL_STATUS.LIVE]: {
    label: "LIVE",
    color: "#33d6a6",
    background: "bg-emerald-100",
    text: "text-emerald-700",
    rank: 0,
  },
  [DEAL_STATUS.SCHEDULED]: {
    label: "SCHEDULED",
    color: "#8ea7ff",
    background: "bg-indigo-100",
    text: "text-indigo-700",
    rank: 1,
  },
  [DEAL_STATUS.EXPIRED]: {
    label: "EXPIRED",
    color: "#a1a1aa",
    background: "bg-zinc-200",
    text: "text-zinc-600",
    rank: 2,
  },
  [DEAL_STATUS.DISABLED]: {
    label: "DISABLED",
    color: "#71717a",
    background: "bg-zinc-200",
    text: "text-zinc-600",
    rank: 3,
  },
};

function getTime(value) {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function isDealEnabled(deal) {
  if (typeof deal?.is_active === "boolean") {
    return deal.is_active;
  }

  return deal?.status !== "paused" && deal?.status !== "ended";
}

export function getDealStatus(deal, now = new Date()) {
  if (!isDealEnabled(deal)) {
    return DEAL_STATUS.DISABLED;
  }

  const nowTime = now.getTime();
  const startsAt = getTime(deal?.starts_at);
  const endsAt = getTime(deal?.ends_at);

  if (startsAt && startsAt > nowTime) {
    return DEAL_STATUS.SCHEDULED;
  }

  if (endsAt && endsAt <= nowTime) {
    return DEAL_STATUS.EXPIRED;
  }

  return DEAL_STATUS.LIVE;
}

export function isLiveDeal(deal, now = new Date()) {
  return getDealStatus(deal, now) === DEAL_STATUS.LIVE;
}

export function getLiveDeals(deals = [], now = new Date()) {
  return deals.filter((deal) => isLiveDeal(deal, now));
}

export function getPrimaryLiveDeal(deals = [], now = new Date()) {
  return getLiveDeals(deals, now).sort((left, right) => {
    const leftEndsAt = getTime(left.ends_at) ?? Number.POSITIVE_INFINITY;
    const rightEndsAt = getTime(right.ends_at) ?? Number.POSITIVE_INFINITY;

    return leftEndsAt - rightEndsAt;
  })[0];
}

export function sortDealsByComputedStatus(deals = [], now = new Date()) {
  return [...deals].sort((left, right) => {
    const leftStatus = getDealStatus(left, now);
    const rightStatus = getDealStatus(right, now);
    const leftRank = DEAL_STATUS_META[leftStatus].rank;
    const rightRank = DEAL_STATUS_META[rightStatus].rank;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftTime = getTime(left.starts_at) ?? getTime(left.ends_at) ?? 0;
    const rightTime = getTime(right.starts_at) ?? getTime(right.ends_at) ?? 0;

    return rightTime - leftTime;
  });
}

export function toDateTimeLocalValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

export function formatDealDateTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getDealTimingLabel(deal, now = new Date()) {
  const status = getDealStatus(deal, now);

  if (status === DEAL_STATUS.DISABLED) {
    return "Disabled by owner";
  }

  if (status === DEAL_STATUS.SCHEDULED) {
    const startsAt = formatDealDateTime(deal.starts_at);
    return startsAt ? `Starts ${startsAt}` : "Scheduled";
  }

  if (status === DEAL_STATUS.EXPIRED) {
    const endsAt = formatDealDateTime(deal.ends_at);
    return endsAt ? `Ended ${endsAt}` : "Expired";
  }

  const endsAt = formatDealDateTime(deal.ends_at);
  const startsAt = formatDealDateTime(deal.starts_at);

  if (endsAt) {
    return `Live until ${endsAt}`;
  }

  if (startsAt) {
    return `Live since ${startsAt}`;
  }

  return "Live now";
}
