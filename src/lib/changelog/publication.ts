// Aster's standard.site publication: the record its release notes belong
// to, which tells AT Protocol readers what the site is called and where
// it lives. https://standard.site

import type { BlobRef } from "@/lib/atproto/xrpc";

import { PUBLICATION_COLLECTION } from "@/lib/changelog/document";

export type Publication = {
  $type: typeof PUBLICATION_COLLECTION;
  url: string;
  name: string;
  description: string;
  icon: BlobRef;
};

type PublicationFields = Omit<Publication, "$type">;

/** The publication's URL is the site's, without a trailing slash. */
export function buildPublication({
  url,
  ...fields
}: PublicationFields): Publication {
  return {
    $type: PUBLICATION_COLLECTION,
    url: url.replace(/\/+$/u, ""),
    ...fields,
  };
}
