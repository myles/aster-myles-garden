import type { APIRoute } from "astro";

import { handleSolarReturnRequest } from "@/lib/api/returns";

export const prerender = false;

export const POST: APIRoute = ({ request }) =>
  handleSolarReturnRequest(request);
