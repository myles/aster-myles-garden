import type { APIRoute } from "astro";

import { handleProgressionsRequest } from "@/lib/api/progressions";

export const prerender = false;

export const POST: APIRoute = ({ request }) =>
  handleProgressionsRequest(request);
