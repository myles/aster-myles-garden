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

## Charts

- [ ] Composite and solar return charts
- [ ] Chiron, Lilith and the South Node
- [ ] Minor aspects and adjustable orbs
- [ ] Sidereal zodiac, with a choice of ayanamsa
- [ ] Optional high-precision ephemeris files

## Places

- [ ] Coordinates for unlisted places: enter a latitude, longitude and time zone for towns too small for the place index.

## App

- [ ] Work offline as an installed app, using a service worker.
- [ ] A written description of the wheel for screen readers.

## API

A small API, in the same style as the other myles.garden sites, so the garden's MCP server can draw charts.

- [ ] `POST /api/v1/chart`: takes a date, time, GeoNames place ID and house system, and returns positions, houses, aspects and a share link.
- [ ] `GET /api/v1/places?q=`: place search, so callers can find a GeoNames ID.
- [ ] A client in `@myles-garden/sdk`, and `get_birth_chart` and `search_places` tools in the MCP server.
- [ ] Privacy: birth details only ever in request bodies, never logged, and the README, `llms.txt` and `ai.txt` updated to say the API runs on a server.
