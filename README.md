# Aster

A birth chart generator that runs entirely in the browser. Give it a date, a time, and a place, and it draws you a natal chart — no account, and no data leaving your machine unless you want it to.

Lives at [aster.myles.garden](https://aster.myles.garden). Named for the star-shaped flower — _aster_ is Greek for "star".

> **Status:** early. This README describes where the project is headed before most of it exists. Treat it as intent, not a changelog.

## Why

Most birth chart tools send your details off to a server you don't control, then wrap the result in ads. This one does the whole calculation client-side. The astronomy is handled by the [Swiss Ephemeris](https://www.astro.com/swisseph/), compiled to WebAssembly and run in the page — so the site can be served as static files and still produce professional-grade charts.

## Features

- **Fully client-side.** Positions, house cusps, and angles are computed in-browser via Swiss Ephemeris (WASM). Nothing is sent anywhere unless you want it to be.
- **Accurate by default.** High-precision ephemeris data, with sensible handling of historical time zones and daylight saving.
- **Static deploy.** Ships as a static Astro site — no backend to run or pay for.
- **Readable chart wheel.** Rendered as SVG, so it stays crisp at any size and is easy to style or export. A written description of what it shows is read out by screen readers and shown under the wheel.
- **Multiple house systems.** Placidus by default, with others available.

## How it works

```mermaid
flowchart LR
    A[Birth form:<br/>date · time · place] --> B[Geocode place<br/>→ lat/long + timezone]
    B --> C[Convert to UTC<br/>→ Julian day]
    C --> D[Swiss Ephemeris WASM<br/>positions · houses · angles]
    D --> E[Render SVG chart wheel]
```

Every step above happens in the browser. The WASM module is loaded once on first use; from then on, generating a chart is instant and offline-capable.

## Tech stack

| Layer     | Choice                 |
| --------- | ---------------------- |
| Framework | Astro                  |
| Language  | TypeScript             |
| Ephemeris | Swiss Ephemeris (WASM) |
| Hosting   | Vercel (static)        |
| Rendering | SVG                    |

## Getting started

```bash
# 1. Clone
git clone https://github.com/<you>/aster.git
cd aster

# 2. Install
npm install

# 3. Run locally
npm run dev

# 4. Test
npm test

# 5. Build
npm run build
```

### Place data

Place search runs offline against `public/data/places.json`, built from [GeoNames](https://www.geonames.org/) (CC BY 4.0) cities with a population over 15,000. To regenerate it:

1. Download `cities15000.zip`, `admin1CodesASCII.txt` and `countryInfo.txt` from <https://download.geonames.org/export/dump/> into one directory.
2. Unzip `cities15000.zip` there.
3. Run `node scripts/places-build.mjs <that-directory>`.

## Usage

1. Enter a birth date, time, and place. If you don't know the time, tick **I don't know the time** for a noon chart without houses. If the place isn't listed, choose **Not listed? Enter coordinates** and paste its latitude and longitude from any map; the time zone is suggested from the nearest listed place.
2. The place resolves, offline, to coordinates and an IANA time zone; the browser's time zone database supplies the historical offset, Local Mean Time included.
3. The chart is calculated and drawn as an SVG wheel.
4. Adjust the house system if you'd like a different one.
5. Press **Copy link** to share the chart. The link carries the date, time, GeoNames place ID and house system in its `#` fragment, which browsers never send to the server, and opening it fills in the form and draws the same chart.
6. Press **Compare with someone else** under the form to add a second person. The chart becomes a bi-wheel, with their planets outside the zodiac, plus the aspects between you and where each person's planets fall in the other's houses.
7. Press **See transits** to set the sky at a moment, now by default, against your chart. Transits count within 2° of exact, and the time is read in your own time zone.
8. Type a name under **Save as** to keep a chart's details in this browser. Saved charts appear at the top of each form, where **Use** fills it in and draws it, and **Forget** removes it. They're stored only in your browser's local storage and never sent anywhere.

## Roadmap

See [ROADMAP.md](./ROADMAP.md).

## Licence

**AGPL-3.0.**

This project bundles the Swiss Ephemeris, which is dual-licensed under the AGPL or a commercial licence from Astrodienst AG. Because the compiled library is shipped to the browser, the app as a whole is distributed under the AGPL. Code original to this repository is authored by me, but the combined, deployed work carries AGPL terms — including the obligation to make source available.

If you want to build on this in a closed-source or permissively-licensed project, you'll need either a commercial Swiss Ephemeris licence or a different ephemeris engine.

## Acknowledgements

- [Swiss Ephemeris](https://www.astro.com/swisseph/) by Dieter Koch and Alois Treindl, Astrodienst AG — the calculation engine that makes this possible.
- The maintainers of [`@swisseph/browser`](https://github.com/swisseph-js/swisseph), the WASM bindings that bring it to the web.
- [GeoNames](https://www.geonames.org/) for place data, under CC BY 4.0.

## Code quality

Run `npm run format` to check formatting and `npm run format:fix` to apply it. Oxfmt formats standard source and data files; Prettier handles Astro and Svelte files. Generated place data is excluded.

Run `npm run lint` for oxlint, or `npm run lint:fix` for automatic fixes. Existing style issues are warnings; correctness checks remain errors.

CI runs tests with coverage and JUnit reports, Astro checks, formatting and lint checks on pushes and pull requests to `main`. Use `npm run test:coverage` to generate coverage locally.

## Browser tests

The E2E suite uses [Playwright](https://playwright.dev/docs/test-webserver) against a production build. It starts its own preview server on `127.0.0.1:4399`; keep that port free.

1. Run `npx playwright install chromium` once to install the browser.
2. Run `npm run test:e2e` to build and test desktop and 375px mobile Chromium.
3. Run `npx playwright show-report` to inspect results and failure traces.

Use `npm run test:e2e:ui` for interactive debugging. Vitest remains separate under `npm test`.

Coverage includes JavaScript-disabled and delayed-hydration privacy guards, drawing a natal chart with the real WebAssembly engine, and creating and closing a comparison. Place search uses a small local fixture, so tests need no GeoNames download or third-party service. This does not verify the generated production place dataset.

The comparison-update regression for `ISSUES.md` issue 6 is marked as an expected failure. Playwright fails if it unexpectedly passes; remove that annotation when fixing the issue. CI runs the suite on pushes and pull requests to `main` and retains reports for 14 days.
