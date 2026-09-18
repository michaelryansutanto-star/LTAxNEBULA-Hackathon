# CommuteSure SG implementation notes

## Scope and assumptions

- This is a single-user, localhost-only hackathon demo. Authentication, authorization, tenant ownership, and safe public hosting are deferred.
- Rachel's Tampines-to-Raffles Place itinerary is deterministic synthetic data. Every route is labelled **synthetic** and the UI is a **schematic**, not verified live transport advice.
- The event deadline is 08:45 Asia/Singapore. The default 10-minute early-arrival buffer makes the target arrival 08:35.
- Arrival probabilities come from a seeded Monte Carlo model and are not calibrated against real commuter outcomes. Data quality is reported separately from sampling uncertainty.
- UTC is used for persistence and API timestamps; Asia/Singapore is used for scheduling and display.

## Architecture decisions

- A FastAPI modular monolith contains provider adapters, route validation, simulation, policy, persistence, notification, monitoring, and replay boundaries.
- SQLite is accessed behind focused repository methods. PostgreSQL migration remains future work.
- One evaluation service is shared by explicit evaluation and all demo controls so replay cannot bypass production decision logic.
- A monotonic snapshot sequence prevents an older evaluation from replacing newer journey state.
- Simulation work runs outside the API event loop. A single sampled incident duration is conditioned on elapsed incident time and charged once per run.
- The React PWA consumes an atomic journey snapshot. Its service worker caches the application shell; IndexedDB stores the latest recommendation and contingency snapshot.
- Offline expiry is calculated on the device. A disconnected backend cannot update the browser.

## Deliberately deferred production work

- Live transit, maps, weather, and calendar providers; independently verified routing; historical model training and calibration.
- OAuth and encrypted token storage, per-user ownership enforcement, audit retention, and location-history deletion controls.
- Redis-backed distributed monitoring, multiple workers, remote/background push delivery, and durable retry queues.
- Browser-cache encryption, signed contingency payloads, key management, and tamper verification.
- Crowd prediction, island-wide routing, and evening briefings.

Exact setup, verification, and demo commands are maintained in the project README after the implementation is validated.
