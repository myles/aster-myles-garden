# Website review issues

Review date: 13 November 2026. Findings are ordered by recommended fix priority. P1 means fix first, P2 means fix next, and P3 covers lower-priority usability work.

## P1 — Fix first

### 1. Birth details can reach the server if JavaScript fails

**Location:** `src/components/App.svelte`, birth-details form.

The rendered form has no explicit submission method or action, so browsers default to a GET request to the current page. Before hydration, or if JavaScript fails to load, pressing **Draw chart** can submit the date, time and place as URL query parameters. This contradicts the site's privacy promise and can expose those details to server access logs and browser history.

**Suggested fix:** Prevent native submission before the application is ready. Disable the form controls until hydration and provide a JavaScript-required message. Cover Enter-key submission as well as the submit button.

**Verification:** Identified from the rendered HTML and form implementation; not exercised in a real browser.

### 2. Daylight-saving transitions resolve inconsistently

**Location:** `src/lib/time.ts`, `toUtc`.

The conversion does not consistently implement its documented policy of choosing the earlier occurrence of a repeated time and moving a skipped time forwards. For Berlin, `2024-10-27 02:30` resolves to `01:30 UTC`, the later occurrence, rather than `00:30 UTC`. Berlin's `2024-03-31 02:30` resolves to `00:30 UTC`, moving backwards across the spring-forward gap instead of forwards. The resulting one-hour difference affects chart positions and houses.

**Suggested fix:** Resolve ambiguous and nonexistent local times consistently, with an explicit policy. Add regression tests for zones east of UTC alongside the existing Toronto cases.

**Verification:** Reproduced by calling the time-conversion functions directly.

## P2 — Fix next

### 3. Polar charts display the wrong house-system label

**Location:** `src/lib/ephemeris.ts`, `calculateHouses`; house-system labels in chart views.

Swiss Ephemeris falls back to Porphyry when it cannot calculate a requested system such as Placidus at polar latitudes. The application retains the requested system in the chart details, so the result is still labelled Placidus. At latitude `69.65`, longitude `18.96`, and Julian day `2451545`, the Placidus request returned cusps identical to an explicit Porphyry request.

**Suggested fix:** Surface the fallback and display the actual house system, or ask the visitor to choose a supported system. Ensure comparisons and shared charts communicate the same behaviour.

**Verification:** Reproduced against the installed WebAssembly calculation engine.

### 4. Unsupported transit dates can throw outside error handling

**Location:** `src/components/App.svelte`, the `transits` derived value and `showTransits`.

The date field permits dates through year `9999`, but the bundled calculation engine rejects that year as outside its supported range. Transit calculations run in a derived value outside the submit handler's `try/catch`, so a calculation failure escapes the form's error handling and can interrupt rendering.

**Suggested fix:** Validate dates against the calculation engine's supported range and handle calculation errors before updating the transit view. Apply consistent limits to natal dates, transit dates and shared links.

**Verification:** Confirmed that the installed engine rejects year `9999`; the uncaught calculation path was identified in code. The resulting browser behaviour remains unverified.

### 5. Shared links accept impossible dates and times

**Location:** `src/lib/time.ts`, `parseLocalDate` and `parseLocalTime`; `src/lib/share.ts`.

The parsers validate string shape but not calendar validity or time ranges. `2024-02-31` is accepted and normalised to 2 March during conversion, while `99:99` rolls into another day. A shared link containing these values passes parsing instead of being rejected, allowing calculations for an unintended instant.

**Suggested fix:** Validate real calendar dates, the supported year range, hours from 0 to 23 and minutes from 0 to 59. Reuse this validation when reading shared links and saved charts.

**Verification:** Direct conversion reproduced the normalisation. A temporary regression test confirmed that a shared link with `date=2024-02-31&time=99:99` does not throw.

## P3 — Usability

### 6. Place suggestions do not reopen after leaving the field

**Location:** `src/components/PlacePicker.svelte`, `loadIndex` and keyboard handling.

Search for London, move focus away, then return to the place field and press Arrow Down. The suggestions remain closed until the text changes: blur clears the results, focus returns early because the index is already loaded, and keyboard handling returns early while the list is closed.

**Suggested fix:** Re-run the search on focus when an index is available, and allow Arrow Down to reopen matching suggestions.

**Verification:** Reproduced with a temporary component regression test.

## Review checks and limitations

- All 270 existing tests passed.
- Astro type checking completed without errors or warnings.
- The production build and formatting checks passed.
- Two temporary regression tests reproduced issues 5 and 6; both were removed after the review.
- Browser access was unavailable. Mobile layout, visual contrast and real-browser interactions were not verified.
- No application fixes were made as part of the review.
