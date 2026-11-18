// What every POST route shares: read a JSON body, check it against the
// route's schema, calculate, and answer. Birth details are personal, so
// nothing a caller sent is ever written to a log.

import type { z } from "astro/zod";

import { ChartInputError } from "@/lib/charts/errors";
import { toLocal, type LocalDate } from "@/lib/time";

import {
  errorResponse,
  HTTP_BAD_REQUEST,
  HTTP_INTERNAL_SERVER_ERROR,
  jsonResponse,
} from "./http";
import { formatValidationError } from "./schemas";

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    // Unparseable JSON is the caller's mistake, answered below as a 400.
    return undefined;
  }
}

/**
 * Answers a POST with whatever `calculate` returns for its validated
 * body. A body that isn't JSON or doesn't fit `schema`, or a
 * ChartInputError, such as a date outside the engine's range, is a 400;
 * anything else thrown is a 500.
 */
export async function handleJsonPost<T>(
  request: Request,
  schema: z.ZodType<T>,
  route: string,
  calculate: (input: T) => unknown,
): Promise<Response> {
  const body = await readJsonBody(request);
  if (body === undefined) {
    return errorResponse(HTTP_BAD_REQUEST, "body: Expected a JSON object");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(HTTP_BAD_REQUEST, formatValidationError(parsed.error));
  }

  try {
    return jsonResponse(calculate(parsed.data));
  } catch (error) {
    if (error instanceof ChartInputError) {
      return errorResponse(HTTP_BAD_REQUEST, error.message);
    }

    // Only the error's class: engine messages quote the Julian day, which
    // is the birth moment, and a ZodError would quote the chart.
    const name = error instanceof Error ? error.name : typeof error;
    console.error(`Unexpected ${name} in ${route}`);

    return errorResponse(HTTP_INTERNAL_SERVER_ERROR, "Internal server error");
  }
}

/** Today's date in a time zone, for a request that leaves its date out. */
export function todayIn(timeZone: string, now = new Date()): LocalDate {
  const { year, month, day } = toLocal(now, timeZone);
  return { year, month, day };
}
