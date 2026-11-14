import type { APIRoute } from "astro";

import { CACHE_PUBLIC_DAY, jsonResponse } from "@/lib/api/http";
import { buildOpenApiDocument } from "@/lib/api/openapi";

export const GET: APIRoute = () =>
  jsonResponse(buildOpenApiDocument(), { cacheControl: CACHE_PUBLIC_DAY });
