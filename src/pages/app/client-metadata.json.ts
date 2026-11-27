import type { APIRoute } from "astro";

import { buildClientMetadata, parseAppOrigin } from "@/lib/atproto/config";

// Rendered per request so each deployment's origin gets its own metadata.
export const prerender = false;

export const GET: APIRoute = ({ request }) =>
  Response.json(buildClientMetadata(parseAppOrigin(request.url)));
