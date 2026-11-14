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

## Charts

- [ ] Sidereal zodiac, with a choice of ayanamsa
- [ ] Optional high-precision ephemeris files, and Chiron with them: the built-in Moshier ephemeris has no asteroids
- [ ] Secondary progressions: the chart moved on a day for each year of life, set against the natal chart as transits are
- [ ] A solar return set against the natal chart as a bi-wheel, as well as on its own

## Polish

- [ ] Keep the angle labels clear on the wheel: bodies' degrees and retrograde marks can sit on top of AC and DC
- [ ] Clear the lint warnings, then have CI fail on new ones
- [ ] Listen to the page with a real screen reader, such as VoiceOver or NVDA, for reading order and anything read twice

## API

A small API, in the same style as the other myles.garden sites, so the garden's MCP server can draw charts.

- [x] `POST /api/v1/chart`: takes a date, time, latitude, longitude, time zone and house system, and returns positions, houses, aspects and a share link.
- [x] `GET /api/v1/places?q=`: place search, so callers can find a GeoNames latitude and longitude.
- [x] A client in `@myles-garden/sdk`, and `get_birth_chart` and `search_places` tools in the MCP server.
- [x] Privacy: birth details only ever in request bodies, never logged, and the README, `llms.txt` and `ai.txt` updated to say the API runs on a server.
- [ ] Bring the API up to date once the chart features settle: the new bodies' and settings' documentation, plus composites, solar returns and transits, with matching SDK methods and MCP tools.

## AT Protocol

Connect Aster to your AT Protocol account (such as Bluesky) to keep your chart in your own PDS and compare charts with friends. Entirely optional: everything else keeps working without an account.

**On hold** until [AT Protocol Spaces](https://atproto.com/blog/atproto-spaces-alpha) are more widely available. Spaces are in alpha; this starts once they're something most people can use.

- [ ] Sign in with your AT Protocol account.
- [ ] Save your own birth chart to your PDS, as a record in an Aster lexicon.
- [ ] Compare with friends: list the people you follow who have saved an Aster chart, and compare yours with theirs.
- [ ] Only ever write the signed-in person's own chart to their PDS. Never a friend's chart, or anything made from one, such as a comparison or a composite, and never transits or a solar return. To compare with you, a friend saves their own chart from their own account.
- [ ] Privacy: PDS records are public, so anyone can read a saved chart. Say so plainly before saving, offer to leave out the birth time, and make deleting the record as easy as saving it.
