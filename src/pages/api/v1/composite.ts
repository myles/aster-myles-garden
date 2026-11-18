import type { APIRoute } from "astro";

import { handleCompositeRequest } from "@/lib/api/comparison";

export const prerender = false;

export const POST: APIRoute = ({ request }) => handleCompositeRequest(request);
