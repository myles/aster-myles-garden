import type { APIRoute } from "astro";

import { handleSynastryRequest } from "@/lib/api/comparison";

export const prerender = false;

export const POST: APIRoute = ({ request }) => handleSynastryRequest(request);
