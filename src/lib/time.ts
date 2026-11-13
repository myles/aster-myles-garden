const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;

/** Julian day of the Unix epoch, 1970-01-01T00:00:00Z. */
const UNIX_EPOCH_JULIAN_DAY = 2_440_587.5;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/** A wall-clock reading with no time zone attached. */
export type LocalDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/**
 * Parses the values of `<input type="date">` and `<input type="time">`.
 * Example: ("1990-05-15", "14:30") → { year: 1990, month: 5, ... }.
 */
export function parseLocalDateTime(date: string, time: string): LocalDateTime {
  const dateMatch = DATE_PATTERN.exec(date);
  if (!dateMatch) {
    throw new Error(`Invalid date: "${date}"`);
  }

  const timeMatch = TIME_PATTERN.exec(time);
  if (!timeMatch) {
    throw new Error(`Invalid time: "${time}"`);
  }

  return {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  };
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

  // The offset at the naive instant is a first guess; re-check it at the
  // resulting instant in case a transition lies between the two.
  const firstOffsetMs = getOffsetMs(timeZone, naiveMs);
  const firstGuessMs = naiveMs - firstOffsetMs;
  const secondOffsetMs = getOffsetMs(timeZone, firstGuessMs);

  if (secondOffsetMs === firstOffsetMs) {
    return new Date(firstGuessMs);
  }

  const secondGuessMs = naiveMs - secondOffsetMs;
  if (getOffsetMs(timeZone, secondGuessMs) === secondOffsetMs) {
    return new Date(secondGuessMs);
  }

  return new Date(firstGuessMs);
}

/** Offset of a time zone from UTC at the given instant, in minutes. */
export function getOffsetMinutes(timeZone: string, instant: Date): number {
  return getOffsetMs(timeZone, instant.getTime()) / MS_PER_MINUTE;
}

/** Julian day (UT) for an instant, as Swiss Ephemeris expects. */
export function toJulianDay(instant: Date): number {
  return instant.getTime() / MS_PER_DAY + UNIX_EPOCH_JULIAN_DAY;
}
