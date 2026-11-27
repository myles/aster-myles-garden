// Aster's standard.site publication: the record its release notes belong
// to, which tells AT Protocol readers what the site is called and where
// it lives. https://standard.site

import type { BlobRef } from "@atproto/lex-schema";

import * as sitePublication from "@/lexicons/site/standard/publication";

export type Publication = sitePublication.Main;

type PublicationFields = {
  url: string;
  name: string;
  description: string;
  icon: BlobRef;
};

/**
 * The publication's URL is the site's, without a trailing slash. Checked
 * against the lexicon, so a malformed publication never leaves.
 */
export function buildPublication({
  url,
  ...fields
}: PublicationFields): Publication {
  return sitePublication.$parse({
    $type: sitePublication.$type,
    url: url.replace(/\/+$/u, ""),
    ...fields,
  });
}
