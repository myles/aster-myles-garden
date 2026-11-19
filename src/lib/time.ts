import { Temporal } from "temporal-polyfill";

const MS_PER_DAY = 86_400_000;
const NS_PER_MINUTE = 60_000_000_000;

/** Julian day of the Unix epoch, 1970-01-01T00:00:00Z. */
const UNIX_EPOCH_JULIAN_DAY = 2_440_587.5;

const UTC_TIME_ZONE = "UTC";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/** Temporal rejects an impossible date rather than rolling it over. */
const REJECT_OVERFLOW = { overflow: "reject" } as const;

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

  try {
    if (!match) {
      throw new Error("Not YYYY-MM-DD");
    }
    const { year, month, day } = Temporal.PlainDate.from(
      {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      },
      REJECT_OVERFLOW,
    );
    return { year, month, day };
  } catch (cause) {
    throw new Error(`Invalid date: "${date}"`, { cause });
  }
}

/**
 * Parses the value of `<input type="time">`.
 * Example: "14:30" → { hour: 14, minute: 30 }.
 */
export function parseLocalTime(time: string): LocalTime {
  const match = TIME_PATTERN.exec(time);

  try {
    if (!match) {
      throw new Error("Not HH:MM");
    }
    const { hour, minute } = Temporal.PlainTime.from(
      { hour: Number(match[1]), minute: Number(match[2]) },
      REJECT_OVERFLOW,
    );
    return { hour, minute };
  } catch (cause) {
    throw new Error(`Invalid time: "${time}"`, { cause });
  }
}

/**
 * Parses the values of `<input type="date">` and `<input type="time">`.
 * Example: ("1990-05-15", "14:30") → { year: 1990, month: 5, ... }.
 */
export function parseLocalDateTime(date: string, time: string): LocalDateTime {
  return { ...parseLocalDate(date), ...parseLocalTime(time) };
}

/**
 * Converts a wall-clock reading in an IANA time zone to a UTC instant.
 * Temporal reads the zone's full history, including Local Mean Time
 * offsets with seconds, such as Toronto's −5:17:32 before 1895.
 *
 * When clocks fall back, an hour repeats; the earlier occurrence wins.
 * When clocks spring forward, an hour is skipped; a time inside the gap
 * lands just after the jump (02:30 on a spring-forward night becomes
 * 03:30). Temporal calls this "compatible" disambiguation.
 */
export function toUtc(local: LocalDateTime, timeZone: string): Date {
  const zoned = Temporal.ZonedDateTime.from(
    { ...local, timeZone },
    { disambiguation: "compatible" },
  );

  return new Date(zoned.epochMilliseconds);
}

/** Offset of a time zone from UTC at the given instant, in minutes. */
export function getOffsetMinutes(timeZone: string, instant: Date): number {
  return toZoned(instant, timeZone).offsetNanoseconds / NS_PER_MINUTE;
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
  const { year, month, day, hour, minute } = toZoned(instant, timeZone);

  return { year, month, day, hour, minute };
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

  return [...zones].toSorted();
}

/** Whether this browser can read the clock in `timeZone`. */
export function isTimeZone(timeZone: string): boolean {
  if (!timeZone) {
    return false;
  }

  try {
    const formatter = new Intl.DateTimeFormat("en", { timeZone });
    return Boolean(formatter.resolvedOptions().timeZone);
  } catch {
    // Intl throws a RangeError for a zone it doesn't know; that is the
    // answer, not a failure.
    return false;
  }
}

function toZoned(instant: Date, timeZone: string): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(
    instant.getTime(),
  ).toZonedDateTimeISO(timeZone);
}

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}
