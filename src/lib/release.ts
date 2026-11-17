import { SOURCE_URL } from "@/consts";

/**
 * The GitHub Release for a version, which release-please tags as
 * "v" and the version. Example: "0.2.0" → ".../releases/tag/v0.2.0".
 */
export function buildReleaseUrl(version: string): string {
  return `${SOURCE_URL}/releases/tag/v${version}`;
}
