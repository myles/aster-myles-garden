const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;
const OFFSET_WINDOW_MS = 2 * MS_PER_DAY;

/** Julian day of the Unix epoch, 1970-01-01T00:00:00Z. */
const UNIX_EPOCH_JULIAN_DAY = 2_440_587.5;

const UTC_TIME_ZONE = "UTC";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

const MONTHS_PER_YEAR = 12;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;

/** A calendar date with no time zone attached. */
export type LocalDate = {
  year: number;
  month: number;
  day: number;
};

/** A wall-clock time of day with no time zone attached. */
export type LocalTime = {
  hour: number;
  minute: number;
};

/** A wall-clock reading with no time zone attached. */
export type LocalDateTime = LocalDate & LocalTime;

/**
 * Parses the value of `<input type="date">`, rejecting dates that don't
 * exist, such as 31 February, rather than rolling them into the next month.
 * Example: "1990-05-15" → { year: 1990, month: 5, day: 15 }.
 */
export function parseLocalDate(date: string): LocalDate {
  const match = DATE_PATTERN.exec(date);
  if (!match) {
    throw new Error(`Invalid date: "${date}"`);
  }

  const parsed = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const isRealMonth = parsed.month >= 1 && parsed.month <= MONTHS_PER_YEAR;
  if (!isRealMonth || parsed.day < 1 || parsed.day > countDays(parsed)) {
    throw new Error(`Invalid date: "${date}"`);
  }

  return parsed;
}

/**
 * Parses the value of `<input type="time">`.
 * Example: "14:30" → { hour: 14, minute: 30 }.
 */
export function parseLocalTime(time: string): LocalTime {
  const match = TIME_PATTERN.exec(time);
  if (!match) {
    throw new Error(`Invalid time: "${time}"`);
  }

  const parsed = { hour: Number(match[1]), minute: Number(match[2]) };
  if (parsed.hour >= HOURS_PER_DAY || parsed.minute >= MINUTES_PER_HOUR) {
    throw new Error(`Invalid time: "${time}"`);
  }

  return parsed;
}

/**
 * Parses the values of `<input type="date">` and `<input type="time">`.
 * Example: ("1990-05-15", "14:30") → { year: 1990, month: 5, ... }.
 */
export function parseLocalDateTime(date: string, time: string): LocalDateTime {
  return { ...parseLocalDate(date), ...parseLocalTime(time) };
}

/**
 * Treats a wall-clock reading as if it were UTC and returns its epoch ms.
 * Uses setUTCFullYear because Date.UTC maps years 0–99 to 1900–1999.
 */
function toNaiveMs(local: LocalDateTime, second = 0): number {
  const date = new Date(0);
  date.setUTCFullYear(local.year, local.month - 1, local.day);
  date.setUTCHours(local.hour, local.minute, second, 0);
  return date.getTime();
}

/**
 * Offset of a time zone from UTC at a given instant, in ms.
 *
 * Reads the zone's wall clock via Intl, which carries the full IANA
 * history — including Local Mean Time offsets with seconds, such as
 * Toronto's −5:17:32 before 1895.
 */
function getOffsetMs(timeZone: string, epochMs: number): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    era: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(epochMs))
      .map((part) => [part.type, part.value]),
  );

  // Years before 1 CE come back as a positive year with era "BC".
  const year = parts.era === "BC" ? 1 - Number(parts.year) : Number(parts.year);

  const wallMs = toNaiveMs(
    {
      year,
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
    },
    Number(parts.second),
  );

  // Intl drops sub-second precision, so compare against whole seconds.
  const flooredMs = Math.floor(epochMs / 1000) * 1000;
  return wallMs - flooredMs;
}

/**
 * Converts a wall-clock reading in an IANA time zone to a UTC instant.
 *
 * When clocks fall back, an hour repeats; the earlier occurrence wins.
 * When clocks spring forward, an hour is skipped; a time inside the gap
 * is read with the pre-transition offset, landing just after the jump
 * (02:30 on a spring-forward night becomes 03:30).
 */
export function toUtc(local: LocalDateTime, timeZone: string): Date {
  const naiveMs = toNaiveMs(local);

  // Sample both sides, including full-day jumps across the date line.
  // A single guess can land after a transition and hide an earlier match.
  const offsets = new Set([
    getOffsetMs(timeZone, naiveMs - OFFSET_WINDOW_MS),
    getOffsetMs(timeZone, naiveMs),
    getOffsetMs(timeZone, naiveMs + OFFSET_WINDOW_MS),
  ]);
  const candidates = [...offsets].map((offset) => naiveMs - offset);
  const matches = candidates.filter(
    (epochMs) => epochMs + getOffsetMs(timeZone, epochMs) === naiveMs,
  );

  // Repeated times have two matches: choose the earlier instant. Gaps
  // have none: the later candidate uses the pre-transition offset.
  return new Date(
    matches.length > 0 ? Math.min(...matches) : Math.max(...candidates),
  );
}

/** Offset of a time zone from UTC at the given instant, in minutes. */
export function getOffsetMinutes(timeZone: string, instant: Date): number {
  return getOffsetMs(timeZone, instant.getTime()) / MS_PER_MINUTE;
}

/** Julian day (UT) for an instant, as Swiss Ephemeris expects. */
export function toJulianDay(instant: Date): number {
  return instant.getTime() / MS_PER_DAY + UNIX_EPOCH_JULIAN_DAY;
}

/**
 * The instant at a Julian day (UT); the inverse of toJulianDay. Rounded
 * to the millisecond, the finest a Date holds.
 */
export function fromJulianDay(julianDay: number): Date {
  return new Date(Math.round((julianDay - UNIX_EPOCH_JULIAN_DAY) * MS_PER_DAY));
}

/** Reads an instant on a time zone's wall clock; the inverse of toUtc. */
export function toLocal(instant: Date, timeZone: string): LocalDateTime {
  const epochMs = instant.getTime();
  // Shift by the offset, then read the shifted instant's UTC fields.
  const shifted = new Date(epochMs + getOffsetMs(timeZone, epochMs));

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** Example: 1 Jan 2000 → "2000-01-01", as `<input type="date">` holds it. */
export function formatDateValue(date: LocalDate): string {
  const year = String(date.year).padStart(4, "0");
  return `${year}-${padTwo(date.month)}-${padTwo(date.day)}`;
}

/** Example: 9:05 → "09:05", as `<input type="time">` holds it. */
export function formatTimeValue(time: LocalTime): string {
  return `${padTwo(time.hour)}:${padTwo(time.minute)}`;
}

/** The browser's own IANA time zone, e.g. "America/Toronto". */
export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * The IANA time zones this browser lists, with UTC, which some leave
 * out. Some are old spellings ("Asia/Calcutta" where GeoNames has
 * "Asia/Kolkata"); Intl accepts both, so a picker should add its current
 * zone if it's missing.
 */
export function listTimeZones(): string[] {
  const zones = new Set(Intl.supportedValuesOf("timeZone"));
  zones.add(UTC_TIME_ZONE);

  return [...zones].sort();
}

/** Whether this browser can read the clock in `timeZone`. */
export function isTimeZone(timeZone: string): boolean {
  if (!timeZone) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    // Intl throws a RangeError for a zone it doesn't know; that is the
    // answer, not a failure.
    return false;
  }
}

/**
 * Days in a date's month, by the proleptic Gregorian calendar the date
 * input uses: day 0 of the next month is this month's last day.
 */
function countDays({ year, month }: Pick<LocalDate, "year" | "month">): number {
  const lastDay = new Date(0);
  lastDay.setUTCFullYear(year, month, 0);
  return lastDay.getUTCDate();
}

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}
