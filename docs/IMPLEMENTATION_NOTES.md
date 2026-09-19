# CommuteSure SG implementation notes

## Scope and assumptions

- This is a single-user, localhost-only hackathon demo. Authentication, authorization, tenant ownership, and safe public hosting are deferred.
- Rachel's Tampines-to-Raffles Place itinerary is deterministic synthetic data. Every route is labelled **synthetic** and the UI is a **schematic**, not verified live transport advice.
- The event deadline is 08:45 Asia/Singapore. The default 10-minute early-arrival buffer makes the target arrival 08:35.
- Decisions and the UI use a plain ETA. On-time probability was removed at the product owner's request (2026-09-19): `EvaluationResult` carries `eta`, `conservative_eta` and `late_minutes` against the target, and the policy reroutes only when the current ETA misses the target and an alternative arrives at least 10 minutes sooner (5 minute hysteresis after an accepted switch). The seeded estimator is kept internally only to derive the typical and slow-day arrival from segment durations; it is not calibrated against real commuter outcomes.
- Fares use published LTA/PTC adult card numbers (`commutesure/fares.py`, sources recorded beside each constant) applied to synthetic route distances. Best value minimises fare plus time priced at `COMMUTESURE_VALUE_OF_TIME_PER_HOUR` (default 12), restricted to routes whose ETA meets the target when any do.
- The rail tap-in time is fixed by the departure (start time plus a 6 minute access walk), so a discount cannot appear or vanish mid-journey.
- Known modelling gaps: every evaluation estimates the full route from the current clock rather than the remaining segments; the `bugis-dtl` route omits the access walk and its East-West Line ride is not tagged as affected, so only `wait-ewl` and `ride-ewl` are drawn as disrupted; monitoring is driven by explicit evaluations and demo controls, not a background worker.
- UTC is used for persistence and API timestamps; Asia/Singapore is used for scheduling and display.

## Architecture decisions

- A FastAPI modular monolith contains provider adapters, route validation, simulation, policy, persistence, notification, monitoring, and replay boundaries.
- SQLite is accessed behind focused repository methods. PostgreSQL migration remains future work.
- One evaluation service is shared by explicit evaluation and all demo controls so replay cannot bypass production decision logic.
- A monotonic snapshot sequence prevents an older evaluation from replacing newer journey state.
- ETA estimation runs outside the API event loop. A single sampled incident duration is conditioned on elapsed incident time and charged once per run.
- The route map uses Leaflet with OpenStreetMap standard tiles and visible attribution; segment paths are approximate station coordinates served by the API.
- The React PWA consumes an atomic journey snapshot. Its service worker caches the application shell; IndexedDB stores the latest recommendation and contingency snapshot.
- Offline expiry is calculated on the device. A disconnected backend cannot update the browser.

## Deliberately deferred production work

- Live transit, maps, weather, and calendar providers; independently verified routing; historical model training and calibration.
- OAuth and encrypted token storage, per-user ownership enforcement, audit retention, and location-history deletion controls.
- Redis-backed distributed monitoring, multiple workers, remote/background push delivery, and durable retry queues.
- Browser-cache encryption, signed contingency payloads, key management, and tamper verification.
- Crowd prediction, island-wide routing, and evening briefings.

Exact setup, verification, and demo commands are maintained in the project README after the implementation is validated.
