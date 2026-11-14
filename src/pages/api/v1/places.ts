import type { APIRoute } from "astro";

import { handlePlacesRequest } from "@/lib/api/places";

export const prerender = false;

export const GET: APIRoute = ({ request }) => handlePlacesRequest(request);
