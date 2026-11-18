// What every POST route shares: read a JSON body, check it against the
// route's schema, calculate, and answer. Birth details are personal, so
// nothing a caller sent is ever written to a log.

import type { z } from "astro/zod";

import {
  errorResponse,
  HTTP_BAD_REQUEST,
  HTTP_INTERNAL_SERVER_ERROR,
  jsonResponse,
} from "./http";
import { formatValidationError } from "./schemas";

/**
 * A request the schema accepts but that can't be answered, such as a date
 * outside the engine's range. Its message goes back to the caller as a
 * 400, so it must only describe the problem, never the details sent.
 */
export class InputError extends Error {
  override name = "InputError";
}

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
 * body. A body that isn't JSON or doesn't fit `schema`, or an InputError,
 * is a 400; anything else thrown is a 500.
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
    if (error instanceof InputError) {
      return errorResponse(HTTP_BAD_REQUEST, error.message);
    }

    // Only the error's class: engine messages quote the Julian day, which
    // is the birth moment, and a ZodError would quote the chart.
    const name = error instanceof Error ? error.name : typeof error;
    console.error(`Unexpected ${name} in ${route}`);

    return errorResponse(HTTP_INTERNAL_SERVER_ERROR, "Internal server error");
  }
}
