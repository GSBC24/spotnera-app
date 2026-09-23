export const DEAL_STATUS = {
  DISABLED: "DISABLED",
  SCHEDULED: "SCHEDULED",
  LIVE: "LIVE",
  EXPIRED: "EXPIRED",
};

export const DEAL_AVAILABILITY_MODE = {
  CONTINUOUS: "continuous",
  WEEKLY: "weekly",
};

export const DEFAULT_DEAL_AVAILABILITY_TIMEZONE = "Europe/Oslo";

export const DEAL_WEEKDAYS = [
  { value: 1, label: "Monday", shortLabel: "Mon" },
  { value: 2, label: "Tuesday", shortLabel: "Tue" },
  { value: 3, label: "Wednesday", shortLabel: "Wed" },
  { value: 4, label: "Thursday", shortLabel: "Thu" },
  { value: 5, label: "Friday", shortLabel: "Fri" },
  { value: 6, label: "Saturday", shortLabel: "Sat" },
  { value: 7, label: "Sunday", shortLabel: "Sun" },
];

const WEEKDAY_NUMBER_BY_SHORT_LABEL = new Map(
  DEAL_WEEKDAYS.map((weekday) => [weekday.shortLabel, weekday.value]),
);

export const DEAL_STATUS_META = {
  [DEAL_STATUS.LIVE]: {
    label: "ACTIVE",
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

function getScheduleTimeMinutes(value) {
  const match = String(value ?? "").match(/^(\d{2}):(\d{2})/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function getDealSchedules(deal) {
  return Array.isArray(deal?.deal_schedules) ? deal.deal_schedules : [];
}

function getZonedDateParts(now, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const dayOfWeek = WEEKDAY_NUMBER_BY_SHORT_LABEL.get(values.weekday);
    const hour = Number(values.hour);
    const minute = Number(values.minute);

    if (!dayOfWeek || !Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }

    return { dayOfWeek, minuteOfDay: hour * 60 + minute };
  } catch {
    return null;
  }
}

function scheduleMatchesNow(schedule, zonedNow) {
  const scheduleDay = Number(schedule.day_of_week);
  const start = getScheduleTimeMinutes(schedule.start_time);
  const end = getScheduleTimeMinutes(schedule.end_time);

  if (!scheduleDay || start === null || end === null || start === end) {
    return false;
  }

  if (!schedule.spans_midnight) {
    return (
      zonedNow.dayOfWeek === scheduleDay &&
      zonedNow.minuteOfDay >= start &&
      zonedNow.minuteOfDay < end
    );
  }

  const followingDay = scheduleDay === 7 ? 1 : scheduleDay + 1;
  return (
    (zonedNow.dayOfWeek === scheduleDay && zonedNow.minuteOfDay >= start) ||
    (zonedNow.dayOfWeek === followingDay && zonedNow.minuteOfDay < end)
  );
}

export function isDealAvailableNow(deal, now = new Date()) {
  if (!isLiveDeal(deal, now)) {
    return false;
  }

  if (deal?.availability_mode !== DEAL_AVAILABILITY_MODE.WEEKLY) {
    return true;
  }

  const zonedNow = getZonedDateParts(
    now,
    deal.availability_timezone || DEFAULT_DEAL_AVAILABILITY_TIMEZONE,
  );

  if (!zonedNow) {
    return false;
  }

  return getDealSchedules(deal).some((schedule) =>
    scheduleMatchesNow(schedule, zonedNow),
  );
}

export function formatScheduleTime(value) {
  const match = String(value ?? "").match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "";
}

function getNextWeeklySchedule(deal, now) {
  const zonedNow = getZonedDateParts(
    now,
    deal.availability_timezone || DEFAULT_DEAL_AVAILABILITY_TIMEZONE,
  );

  if (!zonedNow) {
    return null;
  }

  return getDealSchedules(deal)
    .map((schedule) => {
      const dayOfWeek = Number(schedule.day_of_week);
      const start = getScheduleTimeMinutes(schedule.start_time);

      if (!dayOfWeek || start === null) {
        return null;
      }

      let dayOffset = (dayOfWeek - zonedNow.dayOfWeek + 7) % 7;
      let minutesUntil = dayOffset * 1440 + start - zonedNow.minuteOfDay;

      if (minutesUntil <= 0) {
        dayOffset += 7;
        minutesUntil += 7 * 1440;
      }

      return { schedule, dayOffset, minutesUntil };
    })
    .filter(Boolean)
    .sort((left, right) => left.minutesUntil - right.minutesUntil)[0] ?? null;
}

export function getDealAvailabilityLabel(deal, now = new Date()) {
  if (!isLiveDeal(deal, now)) {
    return getDealTimingLabel(deal, now);
  }

  if (isDealAvailableNow(deal, now)) {
    return "Available now";
  }

  if (deal?.availability_mode !== DEAL_AVAILABILITY_MODE.WEEKLY) {
    return "Active";
  }

  const next = getNextWeeklySchedule(deal, now);

  if (!next) {
    return "No weekly hours set";
  }

  const start = formatScheduleTime(next.schedule.start_time);
  const end = formatScheduleTime(next.schedule.end_time);
  const timeRange = end ? `${start}–${end}` : start;

  if (next.dayOffset === 0) {
    return `Today ${timeRange}`;
  }

  const weekday = DEAL_WEEKDAYS.find(
    (item) => item.value === Number(next.schedule.day_of_week),
  );
  return `Next available ${weekday?.label ?? "soon"} ${start}`;
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
    return `Active until ${endsAt}`;
  }

  if (startsAt) {
    return `Active since ${startsAt}`;
  }

  return "Active";
}
