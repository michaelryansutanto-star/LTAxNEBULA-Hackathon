# CommuteSure SG - Write-up

Problem statement 2: multi-modal, door-to-door journey planning that stays useful during a disruption.

## Persona

**Rachel** travels from Tampines to Raffles Place every weekday and must be at work by 8:45 AM. She keeps a 10 minute buffer, so her target arrival is 8:35 AM. She does not want another dashboard. She wants the app to stay quiet on a normal morning, interrupt her only for a serious delay, and then give one line of guidance she can act on while walking.

How the build serves her:

- **Silence by default.** The policy recommends a change only when her current route's ETA misses the target and another route arrives at least 10 minutes sooner. In the demo the fault makes her about 15 minutes late and the alternative about 20 minutes sooner, well above a 15 minute disruption.
- **One line.** The recommendation headline is the route to take ("Switch at Bugis to Downtown Line"), followed by one sentence: minutes saved, new arrival time, and the time by which she must act.
- **One notification.** Re-evaluating the same disruption never produces a second alert for the same reroute.
- **Works underground.** The latest recommendation and step-by-step contingency are stored on the device and expire on the device clock.

## What was built

| Capability | Where |
| --- | --- |
| Door-to-door multi-modal options (walk, MRT, transfer, express bus) with per-segment timeline | `services/api/commutesure/fixtures.py`, `apps/web/src/components/Timeline.tsx` |
| ETA, slow-day ETA and minutes early or late for every route | `simulation.py`, `domain.py`, `RoutesCard.tsx` |
| Stay or reroute decision with hysteresis and a decision deadline | `policy.py` |
| Disruption ingest with deduplication, revisions, stale and irrelevant alert rejection | `alerts.py` |
| Adult card fares, morning pre-peak discount, free off-peak rides, best-value pick, leave-earlier tip | `fares.py`, `RoutesCard.tsx` |
| OpenStreetMap route map with affected segments marked | `apps/web/src/components/RouteMap.tsx`, `lib/mapModel.ts` |
| Single notification, inbox, offline contingency card, PWA shell cache | `service.py`, `apps/web/src/lib/db.ts`, service worker |
| Deterministic replay controls (reset, start, advance, fault, resolve, stale data) | `/v1/demo/scenarios/rachel/*` |

Architecture: a FastAPI modular monolith (SQLite, seeded NumPy estimator) and a React, TypeScript and Vite PWA. The client consumes one atomic journey snapshot per request. Details are in `docs/SYSTEM_ARCHITECTURE.md` and `docs/IMPLEMENTATION_NOTES.md`; exact run and test commands are in `README.md`.

## Design decisions

- **Plain ETA instead of probability.** An earlier version reported the chance of arriving on time. It was removed: a commuter acts on a time. Each route now shows its ETA, a slow-day ETA, and minutes early or late against the target. The seeded estimator remains only as the way those two times are derived from segment durations.
- **Price against time.** A literal fare divided by ETA rewards slow routes, so it is not used. The app shows fare and minutes side by side, the extra cost per minute saved against the cheapest route, and one best-value route that minimises `fare + value of time x ETA minutes / 60`, chosen only among routes whose ETA meets the target when any do. A cheap route is never promoted over arriving on time.
- **Tap-in time is fixed by departure.** Discounts depend on when Rachel passes the fare gate, which is her departure plus a 6 minute access walk. The app therefore advises before she leaves ("leave by 7:38 to save $0.50") and never changes the fare mid-journey.
- **Only what is still ahead.** Once Rachel has departed, each ETA covers only the travel remaining, so it holds steady as the clock advances. The fault delays a route only if she would reach the affected stretch before it clears. Options whose switching point has passed (the bus after 7:48 AM) are shown as no longer reachable and drop out of fares and decisions.
- **Same code path for demo and evaluation.** Every demo control goes through the same ingest, estimation and policy code as an explicit evaluation.

## Evidence for quantitative claims

| Claim used in the product | Source |
| --- | --- |
| Adult card distance fare bands effective 27 Dec 2025 (for example 15.2 to 16.2 km costs S$2.11); express services cost S$1.00 more | LTA fare table: https://www.lta.gov.sg/content/dam/ltagov/img/map/bus/fare-table.pdf |
| Fares are charged on total journey distance across bus and MRT/LRT; up to 5 transfers within 2 hours | PTC: https://www.ptc.gov.sg/fares/distance-fares-and-transfer-rules/ |
| Tapping in at a rail station before 7:45 AM on weekdays (excluding public holidays) reduces the rail fare by up to S$0.50 | PTC: https://www.ptc.gov.sg/fares/morning-pre-peak-fares/ |
| From 27 Dec 2025, free rail rides when tapping in before 7:30 AM or from 9:00 to 9:45 AM on weekdays at Punggol Coast, Punggol, Sengkang, Buangkok, Hougang, Kovan and Sengkang-Punggol LRT stations, introduced to moderate morning peak demand | LTA: https://www.lta.gov.sg/content/ltagov/en/newsroom/2025/10/news-releases/free_morning_off-peak_rail_rides.html |
| 2026 public holidays used to switch discounts off | MOM: https://www.mom.gov.sg/employment-practices/public-holidays |

Numbers that are **assumptions or synthetic**, and labelled as such in the UI or code:

- Segment durations, spreads, route distances, station coordinates and the 46 to 54 minute fault duration are synthetic demo data.
- The value of time, S$12 per hour, is an adjustable setting (`COMMUTESURE_VALUE_OF_TIME_PER_HOUR`), not a measured figure.
- The 10 minute reroute threshold, 5 minute hysteresis and 2 minute minimum action window are product choices.
- One fare table is applied to rail and basic bus. The published LTA table is the bus table; PTC states the distance fare structure is shared.

## Data honesty

No live transport feed is used. Every route is named "(synthetic)", the header shows "Deterministic demo · Synthetic data", the routes panel states that fares are published numbers on synthetic distances, and the map states that lines are schematic. Nothing mocked is presented as live. No credentials exist in the project; `.env.example` holds non-secret local settings only and `.env` is git-ignored.

## Map, attribution and tile policy

The base map is OpenStreetMap standard tiles rendered with Leaflet. "(c) OpenStreetMap contributors" with a link to the copyright page is shown in the map's attribution control and again in text below the map. Tiles are requested only for the visible viewport, there is no prefetching or bulk download, and scroll-wheel zoom is disabled to avoid accidental tile bursts. A production deployment should move to a hosted tile provider or self-hosted tiles.

## Offline and underground handling

- The app shell is cached by a service worker and the latest recommendation and contingency are stored in IndexedDB.
- Offline, the app shows an explicit banner, the saved plan, its route version, and when it was last synced.
- The saved plan expires on the device clock. After expiry the card says not to rely on it and the recommendation is suppressed until reconnection.
- Map tiles are not cached. When they fail to load the map says so, and the route lines, legend and affected markings still render.

## Limitations

- One synthetic corridor with three fixed routes; no live routing, arrivals, alerts or crowding.
- Progress along a route is inferred from the time since departure and typical segment durations, not from a position fix.
- The fault is modelled as services held at the affected stretch (Bugis to Raffles Place) until it clears; partial or degraded service is not modelled.
- Monitoring is driven by evaluations and demo controls. With a manually advanced demo clock a background worker would have nothing to observe, so none is included, and there is no remote push.
- Single user, localhost only: no authentication, and the device cache is not encrypted.
- Adult card fares only; no concession, cash or pass fares.

## Verification

- API: `uv run pytest` - all tests pass, coverage about 97% (gate 80%).
- Web: `npm test` (28 unit tests), `npm run lint` with zero warnings, `npm run typecheck`.
- End to end: `npm run test:e2e` runs Rachel's full story on mobile and desktop viewports, including fare, ETA, OpenStreetMap attribution, the affected-segment legend, single notification, offline reload, expiry and reconnection.

## Demo recording

Link: _to be added by the team before submission._
