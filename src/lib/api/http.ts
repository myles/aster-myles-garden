// JSON responses for the API routes, in the shape every myles.garden API
// uses: pretty-printed JSON, and errors as `{ "error": "..." }`.

export const HTTP_OK = 200;
export const HTTP_BAD_REQUEST = 400;
export const HTTP_INTERNAL_SERVER_ERROR = 500;

/** For anything computed from what a caller sent: never cache it. */
export const CACHE_NO_STORE = "no-store";

/** For answers that only change when the site is rebuilt. */
export const CACHE_PUBLIC_DAY =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400";

const JSON_INDENT_SPACES = 2;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

type ResponseOptions = {
  status?: number;
  cacheControl?: string;
};

export function jsonResponse(
  data: unknown,
  { status = HTTP_OK, cacheControl = CACHE_NO_STORE }: ResponseOptions = {},
): Response {
  return new Response(JSON.stringify(data, null, JSON_INDENT_SPACES), {
    status,
    headers: {
      "Content-Type": JSON_CONTENT_TYPE,
      "Cache-Control": cacheControl,
    },
  });
}

export function errorResponse(status: number, error: string): Response {
  return jsonResponse({ error }, { status });
}
