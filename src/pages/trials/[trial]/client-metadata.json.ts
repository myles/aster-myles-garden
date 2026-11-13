import type { APIRoute } from "astro";

import { getTrialPaths } from "@/experimental/atproto/build";
import {
  buildClientMetadata,
  type TrialConfig,
} from "@/experimental/atproto/config";

export const getStaticPaths = getTrialPaths;

export const GET: APIRoute = ({ props }) =>
  Response.json(buildClientMetadata(props.config as TrialConfig));
