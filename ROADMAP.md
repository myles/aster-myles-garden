# Roadmap

## Done

- [x] Core calculation (planets, houses, angles)
- [x] SVG chart wheel
- [x] Place search + historical time zone lookup
- [x] House system selector
- [x] Aspect lines and orbs
- [x] Export chart as PNG/SVG
- [x] Shareable chart links
- [x] Unknown birth time: a noon chart without houses or angles, noting any body that changed sign that day
- [x] Compare two birth charts: a bi-wheel, the aspects between them, and house overlays both ways
- [x] Transits: the sky at any moment, defaulting to now, against the natal chart, with aspects within 2°
- [x] Saved charts: named, in the browser only, to fill either form with one press
- [x] A written description of the wheel, read by screen readers and shown under the wheel
- [x] Coordinates for unlisted places, with the time zone suggested from the nearest listed place
- [x] Lilith and the South Node
- [x] Minor aspects and tight, standard or wide orbs, carried by share links and the API
- [x] Works offline as an installed app, using a service worker
- [x] Composite charts: the midpoints of two charts, with houses cast around the midpoint of their midheavens
- [x] Solar returns: the year's chart for the moment the Sun returns to its natal position, cast wherever you choose
- [x] House system and aspect settings remembered in the browser between visits
- [x] Clear the lint warnings, then have CI fail on new ones
- [x] Keep angle labels clear of bodies' degrees and retrograde marks
- [x] A solar return set against the natal chart as a bi-wheel, as well as on its own
- [x] Compare the browser tests' wheel screenshots against approved ones, so a label or glyph that moves fails the build
- [x] Secondary progressions: the chart moved on a day for each year of life, set against the natal chart as transits are
- [x] Lunar returns: the month's chart for the moment the Moon returns to its natal position, found the way solar returns are, on its own or against the natal chart
- [x] Exact transit dates: when each transit is exact, and when it comes into and leaves orb, found the way solar returns are
- [x] Sidereal zodiac, with a choice of ayanamsa
- [x] A guide for newcomers: each setting, table and chart explained in place behind a "?", and all together at /guide, written as Markdown anyone can edit

## Charts

- [ ] Optional high-precision ephemeris files, and Chiron with them: the built-in Moshier ephemeris has no asteroids

## Polish

- [ ] Listen to the page with a real screen reader, such as VoiceOver or NVDA, for reading order and anything read twice
- [ ] Measure angle labels' drawn size in the browser instead of estimating it, so they stay clear if the font or its size changes
- [ ] A smaller place index: at 2.6 MB, it's fetched and parsed whole on the first search, which may be slow on a phone. Measure first, then split or trim it if it is
- [x] Choose a light or dark wheel when downloading, rather than always taking the page's current theme
- [x] Measure the place index on a phone: `npm run places:measure`. Over Slow 4G, the first results take about 4 s, nearly all of it the 0.7 MB brotli download; parsing and searching take under 0.35 s, even at a sixth of the CPU
- [x] A faster first search: a small index of the cities of 100,000 or more, 120 KB, searched while the whole one loads. Over Slow 4G, the first results now come in about 0.9 s rather than 4 s

## API

A small API, in the same style as the other myles.garden sites, so the garden's MCP server can draw charts.

- [x] `POST /api/v1/chart`: takes a date, time, latitude, longitude, time zone and house system, and returns positions, houses, aspects and a share link.
- [x] `GET /api/v1/places?q=`: place search, so callers can find a GeoNames latitude and longitude.
- [x] A client in `@myles-garden/sdk`, and `get_birth_chart` and `search_places` tools in the MCP server.
- [x] Privacy: birth details only ever in request bodies, never logged, and the README, `llms.txt` and `ai.txt` updated to say the API runs on a server.
- [x] Bring the API up to date: the sidereal zodiac, and endpoints for transits, progressions, solar and lunar returns, comparisons and composites.
- [ ] Matching SDK methods in `@myles-garden/sdk`, and MCP tools in the garden's MCP server, for the new endpoints.

## WebMCP

Offer the page's own features as tools to an AI agent working in the browser, through [WebMCP](https://github.com/webmachinelearning/webmcp). Unlike the API, the tools run the calculation in the page, so birth details don't go to Aster's server. WebMCP is still a draft standard, so this is experimental and may need updating as the spec changes.

- [ ] Detect support and register nothing where the browser lacks it, so the page is unchanged for everyone else.
- [ ] Tools for drawing a chart, searching places, comparing two charts, and showing transits or a solar return, built on the chart service the form already uses.
- [ ] Draw each tool's result on screen and fill in the form, as if the person had entered it, so they can see and check what the agent asked for.
- [ ] Privacy: whatever a tool returns goes to the agent and the model behind it. Say so in the README, `llms.txt` and `ai.txt`, and don't let a tool read saved charts unless the person chooses one.

## AT Protocol

Connect Aster to your AT Protocol account (such as Bluesky) to keep your chart in your own PDS and compare charts with friends. Entirely optional: everything else keeps working without an account.

**Public rollout on hold** until [AT Protocol Spaces](https://atproto.com/blog/atproto-spaces-alpha) are more widely available. A personal trial is being built on `save-birth-chart-to-atproto`, isolated under [`src/experimental/atproto/`](src/experimental/atproto/README.md). It uses an existing permissioned Space for the configured account; the public-PDS flow and friend discovery below remain future work.

- [ ] Sign in with your AT Protocol account.
- [ ] Save your own birth chart to your PDS, as a record in an Aster lexicon.
- [ ] Compare with friends: list the people you follow who have saved an Aster chart, and compare yours with theirs.
- [ ] Only ever write the signed-in person's own chart to their PDS. Never a friend's chart, or anything made from one, such as a comparison or a composite, and never transits or a solar return. To compare with you, a friend saves their own chart from their own account.
- [ ] Privacy: PDS records are public, so anyone can read a saved chart. Say so plainly before saving, offer to leave out the birth time, and make deleting the record as easy as saving it.
