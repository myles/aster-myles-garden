import type { Locator } from "@playwright/test";

/**
 * The place suggestions in a birth form. Scoped to their list, since the
 * form's selects have options too, and the first of those can't be
 * clicked.
 */
export function placeOptions(form: Locator): Locator {
  return form
    .getByRole("listbox", { name: "Matching places" })
    .getByRole("option");
}
