import type { APIRoute } from "astro";

import { handleTransitsRequest } from "@/lib/api/transits";

export const prerender = false;

export const POST: APIRoute = ({ request }) => handleTransitsRequest(request);
