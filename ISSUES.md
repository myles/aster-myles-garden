# Website review issues

Review date: 13 November 2026. Findings are ordered by recommended fix priority. P1 means fix first, P2 means fix next, and P3 covers lower-priority usability work.

## P1 — Fix first

### 1. Birth details can reach the server if JavaScript fails — fixed

**Location:** `src/components/App.svelte`, birth-details form.

The rendered form has no explicit submission method or action, so browsers default to a GET request to the current page. Before hydration, or if JavaScript fails to load, pressing **Draw chart** can submit the date, time and place as URL query parameters. This contradicts the site's privacy promise and can expose those details to server access logs and browser history.

**Suggested fix:** Prevent native submission before the application is ready. Disable the form controls until hydration and provide a JavaScript-required message. Cover Enter-key submission as well as the submit button.

**Verification:** Identified from the rendered HTML and form implementation; not exercised in a real browser.

**Resolution:** The birth form renders with its controls inside a disabled fieldset, which is enabled only after hydration. This blocks native button and Enter-key submission before the app is ready and excludes birth fields from form data. A message explains how to enable the form and remains visible until hydration succeeds. Server-rendering regression tests failed before the fix and now confirm disabled controls and empty form data; a client test confirms controls become enabled after hydration. Playwright now verifies disabled controls, native click and Enter attempts, and delayed hydration in desktop and 375px mobile Chromium.

### 2. Daylight-saving transitions resolve inconsistently — fixed

**Location:** `src/lib/time.ts`, `toUtc`.

The conversion does not consistently implement its documented policy of choosing the earlier occurrence of a repeated time and moving a skipped time forwards. For Berlin, `2024-10-27 02:30` resolves to `01:30 UTC`, the later occurrence, rather than `00:30 UTC`. Berlin's `2024-03-31 02:30` resolves to `00:30 UTC`, moving backwards across the spring-forward gap instead of forwards. The resulting one-hour difference affects chart positions and houses.

**Suggested fix:** Resolve ambiguous and nonexistent local times consistently, with an explicit policy. Add regression tests for zones east of UTC alongside the existing Toronto cases.

**Verification:** Reproduced by calling the time-conversion functions directly.

**Resolution:** `toUtc` now checks offsets on both sides of a transition, chooses the earlier matching instant for repeated times, and uses the pre-transition offset for skipped times. Regression tests cover Berlin, Lord Howe’s half-hour transitions and Apia’s skipped day alongside the existing Toronto cases. All five new cases failed before the fix and pass afterwards.

## P2 — Fix next

### 3. Polar charts display the wrong house-system label — fixed

**Location:** `src/lib/ephemeris.ts`, `calculateHouses`; house-system labels in chart views. In the API: `src/lib/server/ephemeris.ts`, `calculateHouses`, and `src/lib/api/chart.ts`.

Swiss Ephemeris falls back to Porphyry when it cannot calculate a requested system such as Placidus at polar latitudes. The application retains the requested system in the chart details, so the result is still labelled Placidus. At latitude `69.65`, longitude `18.96`, and Julian day `2451545`, the Placidus request returned cusps identical to an explicit Porphyry request.

**Suggested fix:** Surface the fallback and display the actual house system, or ask the visitor to choose a supported system. Ensure comparisons and shared charts communicate the same behaviour.

**Verification:** Reproduced against the installed WebAssembly calculation engine.

**API:** The native engine behind `POST /api/v1/chart` (`@swisseph/node`) didn't fall back: it threw "Failed to calculate houses" where the WebAssembly engine returns Porphyry cusps. At the same latitude and longitude, Placidus and Koch requests returned HTTP 500, while Porphyry and Whole Sign returned 200. Reproduced by calling `handleChartRequest` directly.

**Resolution (API):** Both drivers now report the system they actually cast with, as `houseSystem` on `HousePositions`. Swiss Ephemeris only falls back for Placidus and Koch (`SWE_POLAR_LIMITED_SYSTEMS` in `src/lib/ephemeris-codes.ts`). The native driver catches the binding's error for those two systems alone and casts Porphyry itself; any other error is rethrown. The WebAssembly binding drops the engine's error code, so the browser driver detects a fallback when the cusps exactly match Porphyry's. The API returns `effectiveHouseSystem` alongside the requested `houseSystem`, and leaves it out when there's no birth time. Driver tests at Tromsø failed before the fix and pass for both drivers; API tests confirm a 200 with `effectiveHouseSystem: "porphyry"` for Placidus and Koch. The built Vercel function returns the same.

**Resolution (site):** The chart view's subheading names the system the houses were actually cast with, read from `chart.houses.houseSystem`. When that differs from the one chosen, a note explains: "Placidus houses can't be cast this close to the pole, so these are Porphyry houses." A comparison labels its houses by your chart, since the overlays use your houses, and adds a note for each person whose chart fell back, as the two can be at different latitudes. `usesFallbackHouses` in `src/lib/chart.ts` makes the comparison, and `describeHouseFallback` in `src/lib/houses.ts` writes the note. Component tests for a Tromsø chart failed before the fix and pass afterwards. Shared charts open through the same views, so they behave the same way.

### 4. Unsupported transit dates can throw outside error handling — fixed

**Location:** `src/components/App.svelte`, the `transits` derived value and `showTransits`.

The date field permits dates through year `9999`, but the bundled calculation engine rejects that year as outside its supported range. Transit calculations run in a derived value outside the submit handler's `try/catch`, so a calculation failure escapes the form's error handling and can interrupt rendering.

**Suggested fix:** Validate dates against the calculation engine's supported range and handle calculation errors before updating the transit view. Apply consistent limits to natal dates, transit dates and shared links.

**Verification:** Confirmed that the installed engine rejects year `9999`; the uncaught calculation path was identified in code. The resulting browser behaviour remains unverified.

**API:** Not affected: the API has no transits, and `POST /api/v1/chart` rejects birth dates outside the engine's range with a 400 before calculating.

**Resolution:** `canCalculateMoment` and `canCalculateDate` in `src/lib/chart.ts` check against the engine's span, Julian days 625,000.5 to 2,818,000.5 (`SWE_MIN_JULIAN_DAY` and `SWE_MAX_JULIAN_DAY`). That runs from about 3000 BCE to 29 April 3003. A date is checked across its whole local day, since a chart without a birth time reads both ends. The site and the API's `isInEngineRange` share these checks. Birth dates, comparison dates, typed transit moments and transit moments from share links are all checked before calculating, and the form says the supported span instead of passing on the engine's error. Transits are calculated inside a try/catch, so any remaining failure is reported in the transit form instead of interrupting rendering. Every date field now stops at 31 December 3002. Unit tests cover the range boundaries, including a date whose local day runs past the end west of UTC. App tests cover a birth date, a transit date and a share link in the year 9999, plus a transit calculation that throws. All failed before the fix and pass afterwards.

### 5. Shared links accept impossible dates and times — fixed

**Location:** `src/lib/time.ts`, `parseLocalDate` and `parseLocalTime`; `src/lib/share.ts`.

The parsers validate string shape but not calendar validity or time ranges. `2024-02-31` is accepted and normalised to 2 March during conversion, while `99:99` rolls into another day. A shared link containing these values passes parsing instead of being rejected, allowing calculations for an unintended instant.

**Suggested fix:** Validate real calendar dates, the supported year range, hours from 0 to 23 and minutes from 0 to 59. Reuse this validation when reading shared links and saved charts.

**Verification:** Direct conversion reproduced the normalisation. A temporary regression test confirmed that a shared link with `date=2024-02-31&time=99:99` does not throw.

**API:** Input was not affected: `chartRequestSchemaV1` in `src/lib/api/schemas.ts` already rejected `2024-02-31` and `99:99` with a 400.

**Resolution:** `parseLocalDate` now rejects months outside 1–12 and days that don't exist in their month, by the proleptic Gregorian calendar the date input uses, so `2024-02-29` is accepted and `1900-02-29` isn't. `parseLocalTime` rejects hours past 23 and minutes past 59. Shared links and saved charts already read dates and times through these parsers, so both now reject impossible values: a shared link reports the bad field, and stored charts with one are reported as damaged. A link's transit moment was read by `Date`, which also rolls `2024-02-31T12:00Z` into March and accepts `24:00`; it's now read through the same parsers. The year range is checked separately, by issue 4's range checks. The API validates with its own schema, so a table test checks that the schema and the parsers accept and reject the same dates and times. The parser, share-link and saved-chart tests failed before the fix and pass afterwards.

### 6. Comparison updates can leave mismatched charts — fixed

**Location:** `src/components/App.svelte`, `draw`.

Draw a comparison, clear the second person's place, then change the house system. The application updates your chart before attempting to rebuild theirs. Their calculation fails, leaving their previous chart alongside your updated chart. The comparison is labelled with the new house system even though the two charts now use different systems. A raw error appears: `Cannot read properties of undefined (reading 'timeZone')`.

**Suggested fix:** Validate both forms before rebuilding a comparison. Calculate both charts before replacing either displayed chart, so a failure preserves a consistent result. Show an actionable validation message beside the incomplete form.

**Verification:** Reproduced in the browser by switching between Koch and Placidus after clearing the second person's place.

**Resolution:** Both birth forms are validated before rebuilding a comparison. Both charts are calculated before either displayed result is replaced, including when retrying after a failed house-system change. Missing details are explained beside the relevant form. Unit regressions cover missing places, calculation failures and retries; the browser regression now runs without an expected-failure annotation and covers preserving the comparison and repairing the form.

## P3 — Usability

### 7. Place suggestions do not reopen after leaving the field — fixed

**Location:** `src/components/PlacePicker.svelte`, `loadIndex` and keyboard handling.

Search for London, move focus away, then return to the place field and press Arrow Down. The suggestions remain closed until the text changes: blur clears the results, focus returns early because the index is already loaded, and keyboard handling returns early while the list is closed.

**Suggested fix:** Re-run the search on focus when an index is available, and allow Arrow Down to reopen matching suggestions.

**Verification:** Reproduced with a temporary component regression test.

**Resolution:** Focusing the place field re-runs the search once the index has loaded, so leaving and returning reopens the suggestions for the text still there. With the list closed, Arrow Down re-runs the search and opens it, as the WAI-ARIA combobox pattern expects. A place that's already chosen stays closed either way, because the search skips the text of a chosen place. Component tests for refocusing, and for Arrow Down after Escape, failed before the fix and pass afterwards. A further test checks that a chosen place's list stays closed.

### 8. Mobile wheel labels are too small — fixed

**Location:** `src/components/ChartWheel.svelte`; wheel sizing in `src/lib/wheel.ts`.

At a 375px viewport, the comparison wheel scales its degree labels to roughly 5px. The chart fits the screen, but reading the labels requires substantial magnification.

**Suggested fix:** Provide an enlarged wheel view or zoom controls. Retain the position tables and written description as readable alternatives.

**Verification:** Inspected the rendered natal and comparison wheels at a 375px viewport.

**Resolution:** An **Enlarge wheel** toggle under every wheel (natal, comparison and transits) widens it to 56rem inside a box that scrolls sideways, rather than fitting it to the screen. The page itself doesn't scroll sideways. While enlarged, the box is a labelled, focusable region, so it can also be scrolled from the keyboard. The button keeps one label and reports its state with `aria-pressed`. The size is set on a wrapper, not on the `<svg>` that D3 owns, so downloads are unchanged. At 375px in Chromium, the wheel grows from 343px to 896px wide and its label boxes from 8px to 20px tall. The tables and written description remain the readable alternatives. Component tests for the toggle and the scrollable region failed before the fix and pass afterwards.

### 9. Successful submission leaves the wheel below the viewport — fixed

**Location:** `src/components/App.svelte`, successful chart and comparison submission.

On mobile, focus remains on **Draw chart** or **Compare charts** after calculation. The result heading appears near the bottom of the viewport, while the wheel remains below the visible area, requiring the visitor to scroll to inspect the result.

**Suggested fix:** Scroll to and focus the result heading after a successful submission on narrow layouts. Preserve the form position when validation fails.

**Verification:** Reproduced at a 375px by 812px viewport. After drawing a natal chart, the result heading began at 722px and the wheel began at 854px, below the viewport.

**Resolution:** After **Draw chart** or **Compare charts** succeeds on a layout narrower than 64rem, where the result stacks below the forms, focus moves to the result's heading and it scrolls to the top of the viewport. Screen readers are told where the result is, as well as the page showing it. On a wide layout the result is already beside the form, so focus stays put. A failed validation leaves the form where it is. Share links and saved charts draw without moving the page. `draw` and `compare` now report whether they published a result, so only a real result is revealed. At 375px by 812px in Chromium, the heading now starts at 0px with focus on it. At 1280px nothing moves. App tests for the natal and comparison submissions on a narrow layout failed before the fix and pass afterwards. Further tests check that a wide layout and a failed validation leave focus and scroll alone.

## Review checks and limitations

- All 270 existing tests passed.
- Astro type checking completed without errors or warnings.
- The production build and formatting checks passed.
- Two temporary regression tests reproduced issues 5 and 6; both were removed after the review.
- Browser access became available for a follow-up review. Layouts were checked at widths of 320px, 375px and 1280px, with no horizontal overflow found in the tested views.
- Browser checks covered natal charts, comparisons, transits, unknown birth times, saving and using a test chart, and reopening a shared chart link. The saved test chart was removed afterwards.
- SVG, PNG and CSV downloads completed. The exported comparison PNG was visually inspected.
- Dark mode and a full accessibility audit remain unchecked.
- No application fixes were made as part of the review.
