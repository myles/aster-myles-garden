import type { APIRoute } from "astro";

import { handleLunarReturnRequest } from "@/lib/api/returns";

export const prerender = false;

export const POST: APIRoute = ({ request }) =>
  handleLunarReturnRequest(request);
