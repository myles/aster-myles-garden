import type { APIRoute } from "astro";

import { handleChartRequest } from "@/lib/api/chart";

export const prerender = false;

export const POST: APIRoute = ({ request }) => handleChartRequest(request);
