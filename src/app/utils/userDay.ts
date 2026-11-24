import prisma from "./prisma.js";

/** Users without a saved timezone are treated as UK users. */
export const DEFAULT_TIMEZONE = "Europe/London";
const DAY_MS = 24 * 60 * 60 * 1000;

const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
};

/** "YYYY-MM-DD" of `date` as seen in `timeZone`. */
export const localDateString = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

/** Minutes `timeZone` is ahead of UTC at `date`. */
const offsetMinutes = (date: Date, timeZone: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(date)
      .map(p => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUtc - date.getTime()) / 60000);
};

export const getUserTimeZone = async (authId: string) => {
  const auth = await prisma.auth.findUnique({
    where: { id: authId },
    select: { timezone: true },
  });
  const tz = auth?.timezone;
  return tz && isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
};

/**
 * A tracker calendar day (stored at UTC midnight, as the jobs expect).
 * - A value already at UTC midnight is a plain day ("2026-05-01") and is kept.
 * - Any other instant is mapped to the day it falls on in the user's timezone
 *   (e.g. 2026-05-01T00:30+01:00 is 1 May for a UK user, not 30 April).
 */
export const toCalendarDay = (date: Date, timeZone: string) => {
  const isUtcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;
  if (isUtcMidnight) return new Date(date.getTime());
  return new Date(`${localDateString(date, timeZone)}T00:00:00.000Z`);
};

/** Both ranges for one local calendar date ("YYYY-MM-DD") in `timeZone`. */
export const rangesForLocalDate = (localDate: string, timeZone: string) => {
  const day = new Date(`${localDate}T00:00:00.000Z`);
  const nextDay = new Date(day.getTime() + DAY_MS);
  // local midnight -> next local midnight, in real instants (for timestamps)
  const start = new Date(day.getTime() - offsetMinutes(day, timeZone) * 60000);
  const end = new Date(
    nextDay.getTime() - offsetMinutes(nextDay, timeZone) * 60000
  );
  return {
    localDate,
    /** UTC midnight of the user's local date */
    day,
    /** range for calendar-day fields (stored at UTC midnight) */
    dayRange: { gte: day, lt: nextDay },
    /** range for timestamp fields (e.g. when a dose was marked taken) */
    instantRange: { gte: start, lt: end },
  };
};

/** The user's "today": as a stored calendar day, and as a real-time window. */
export const getUserToday = (timeZone: string, now = new Date()) =>
  rangesForLocalDate(localDateString(now, timeZone), timeZone);

/**
 * Matches one calendar day for a field that holds calendar days (UTC midnight)
 * but may still hold older raw timestamps from before normalisation.
 */
export const sameDayWhere = (day: Date, timeZone: string) => {
  const { dayRange, instantRange } = rangesForLocalDate(
    day.toISOString().slice(0, 10),
    timeZone
  );
  return [{ date: dayRange }, { date: instantRange }];
};

/** Range for a calendar-day field: one stored UTC-midnight day. */
export const calendarDayRange = (day: Date) => ({
  gte: day,
  lt: new Date(day.getTime() + DAY_MS),
});

/**
 * Returns `payload` with the given Date fields turned into calendar days
 * (see toCalendarDay). Only looks up the timezone when one is present.
 */
export const withCalendarDays = async <T extends object>(
  authId: string,
  payload: T,
  keys: (keyof T)[]
): Promise<T> => {
  const present = keys.filter(key => payload[key] instanceof Date);
  if (!present.length) return payload;
  const timeZone = await getUserTimeZone(authId);
  const result = { ...payload };
  for (const key of present) {
    result[key] = toCalendarDay(
      payload[key] as unknown as Date,
      timeZone
    ) as T[keyof T];
  }
  return result;
};
