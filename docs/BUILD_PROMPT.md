# CommuteSure SG build prompt

> **Update 2026-09-19:** the product owner dropped on-time probability. Decisions and the UI now use a plain ETA, a slow-day ETA and minutes early or late against the target, and the build adds adult card fares with a best-value pick and an OpenStreetMap route map. Where this document mentions probabilities, percentages or Monte Carlo outputs, read it as the original design; the current behaviour is described in the README and IMPLEMENTATION_NOTES.md.

Copy the prompt below into your coding agent's chat while this repository is open. This is an implementation request for a local hackathon MVP.

---

Build a working CommuteSure SG MVP in this repository. Read `README.md`, `docs/SYSTEM_ARCHITECTURE.md`, and applicable repository instructions before editing. Implement the application, run it, and verify the complete demo. Do not stop after producing a plan or scaffold.

## Objective and scope

The app helps a Singapore commuter decide whether to wait or reroute when a disruption threatens their arrival deadline. Its central output is one useful recommendation backed by simulated arrival-time distributions, an explanation, and an offline contingency plan.

Implement the MVP described below. Treat calendar OAuth, evening briefings from live feeds, crowd prediction, historical model training, and full island-wide routing as future work. Document them without making the demo depend on them.

Inspect existing files and dependencies first; preserve user changes and extend existing implementation where appropriate. The `everything-claude-code/` directory is a separate coding toolkit, not this application's source or runtime dependency. Do not modify it or import its entire repository into the application.

Make routine implementation decisions and continue. Ask only when a missing decision prevents safe progress. Keep brief progress updates and record significant assumptions in `docs/IMPLEMENTATION_NOTES.md`.

## Implementation choices

Use these defaults unless the repository already contains a working alternative:

- Frontend: React, TypeScript, and Vite, built as a responsive PWA in `apps/web/`.
- Backend: Python, FastAPI, Pydantic, and NumPy in `services/api/`.
- Storage: SQLite with migrations for the local MVP; keep persistence behind focused repository interfaces so PostgreSQL can be adopted later.
- Monitoring: a single-process background task with an injectable clock. Use the same evaluation service for background monitoring and demo controls. Redis and a separate worker deployment are deferred.
- Offline support: service-worker app-shell caching and IndexedDB for recommendation snapshots and contingency cards.
- Tests: pytest for backend behaviour and Playwright for the browser journey. Add frontend unit tests where they verify meaningful behaviour.

Build a modular monolith with clear modules for models, providers, routing, simulation, policy, persistence, notifications, and replay. Avoid creating empty services or duplicating Python business logic in TypeScript. Use the API schema as the contract between frontend and backend. Choose compatible dependencies, include lockfiles, and verify unfamiliar APIs against official documentation.

The complete local demo must run without external API keys, paid accounts, Docker, or a live transport feed. Provide Windows PowerShell setup instructions as well as conventional shell instructions. Bind development services to localhost by default. Keep this task local; do not publish or deploy the application.

## Functional requirements

### 1. Commute setup and journey lifecycle

Allow the user to save an origin, destination, recurring weekday schedule, arrival deadline, and early-arrival buffer. Seed Rachel's Tampines-to-Raffles-Place commute with an 08:45 deadline and a clearly specified buffer.

Support creating a dated journey, starting monitoring, accepting an alternative route, and ending the journey. Persist the selected route so later evaluations and alerts reflect the user's actual choice. Changing the deadline or buffer must affect the computed results.

Use timezone-aware timestamps, UTC for persistence, and `Asia/Singapore` for commute scheduling and display. Distinguish the event deadline from the target arrival time after subtracting the buffer.

### 2. Provider adapters and candidate routes

Define interfaces for transport observations, normalized alerts, route candidates, and notification delivery. Implement deterministic fixture adapters in `data/demo/` first.

Evaluate the current route and at most two alternatives from the same current location and evaluation time. Include walking, waiting, riding, transfers, and the physical cost of switching. Recompute remaining travel only; do not add segments the user has already completed.

Use a connected route graph or validated fixture itineraries with explicit endpoints, decision points, and transfer durations. Check candidate continuity and reject unavailable or unreachable transfers. A schematic route display is sufficient and must be labelled as such.

Treat bus numbers and routes in the existing documents as illustrative until independently verified. If a real itinerary cannot be verified, label the fixture route as synthetic. Do not present fictional transport instructions as live travel advice.

Normalize alerts with stable incident IDs, separate revision IDs, affected transport entities, severity, start time, observed time, source, and extraction status. Handle duplicate, updated, resolved, malformed, irrelevant, and stale events. LLM parsing is optional; deterministic validated fixtures must exercise the complete pipeline without an LLM key.

### 3. Probabilistic arrival engine

Implement a real seeded Monte Carlo calculation in Python. Each route contains nonnegative segment-duration distributions. Return estimated on-time probability, p50 and p90 arrival times, sample count, model version, seed, input snapshot ID, and data-quality reasons.

Compute `P(arrival <= deadline - buffer)` using the journey's current location and clock. Sample segments in travel order so arrival at a transfer influences the next wait. Use simple, documented assumptions for headways and disruption duration.

Represent a shared disruption delay consistently within a simulation run. Do not independently charge the full incident delay to every affected segment. Where the scenario supplies total incident duration samples, condition remaining delay on the disruption already having lasted its observed elapsed time. Document assumptions when data is insufficient.

Make simulation count and seed configurable; use a practical default such as 5,000 samples. Keep simulation work from blocking the API event loop. Identical inputs, configuration, model version, clock, and seed must reproduce results.

The README's 55% and 92% are illustrative, not required exact outputs. Select transparent synthetic timing assumptions that demonstrate a meaningful improvement, then display the computed numbers. Never hardcode probabilities in the UI or claim the model is calibrated against real commuter outcomes. Label estimates as simulated in demo mode.

Keep data quality separate from arrival probability and Monte Carlo sampling uncertainty. Use understandable quality labels and reasons instead of an unexplained confidence number. More simulation samples do not fix missing or inaccurate transport data.

### 4. Recommendation policy and monitoring

Implement the documented initial rerouting gates as configurable defaults:

- Current-route on-time probability below 0.70.
- Alternative improvement of at least 0.15, expressed as 15 percentage points.
- Alternative on-time probability at least 0.75.
- Sufficient time to act before the decision deadline.
- Fresh inputs and a feasible alternative.

Account for transfer and switching time in route durations before comparing probabilities. Apply user constraints separately; do not subtract arbitrary probabilities as a switching penalty.

Define and test explicit hysteresis and cooldown rules. Explain the selected action, the probability improvement, freshness, and the latest useful switching time. If no alternative meets the gates, return an honest stay/monitor or uncertain recommendation with a reason; do not imply staying guarantees punctuality.

Reevaluate on relevant event changes and clock progression, including when an observation becomes stale. Ignore unrelated alerts. Prevent older asynchronous evaluations from overwriting newer snapshots. Use the same policy for replay, explicit evaluation, and background monitoring.

### 5. Useful notifications

Implement a persistent in-app notification inbox and banner through a notification adapter. This must work without browser permissions. An optional browser notification can be enabled only after a user gesture; clearly document that remote/background push is deferred if it is not implemented.

Emit one alert when a material actionable recommendation appears. Suppress equivalent alerts across repeated evaluations, incident revisions, refreshes, and retries. Base deduplication on the semantic action and journey, not a newly generated evaluation ID. Persist delivery state and define when a meaningful escalation may bypass cooldown. Never claim a notification was delivered when only queued.

### 6. Offline contingency

Fetch and cache the latest recommendation, route instructions, and contingency while connected. Prefetch them on journey start and update them after each new recommendation. The backend cannot update a disconnected device.

After one successful online load, the app must reopen or reload offline and show the saved plan. Include generation time, expiry, route version, trigger condition, decision deadline, and the last sync time. Visually distinguish fresh, stale, expired, and unavailable plans. Expired instructions must not appear as current recommendations.

Offline clock progression must still expire a plan. A UI toggle alone is not proof of offline operation; verify with actual browser network disconnection. Reconcile newer snapshots after reconnecting.

For this local demo, store only the minimal synthetic commute data. Do not claim the browser cache is encrypted or payloads are signed unless those mechanisms and verification actually exist; document these as deferred production requirements if omitted.

### 7. Deterministic Rachel demo

Create a fixture with a fixed scenario date, injectable clock, and seed. Provide controls for reset, start, pause, advance time, trigger an EWL signalling fault, resolve the fault, and simulate stale provider data.

Demonstrate this complete sequence:

1. Load Rachel's commute and start monitoring with a high baseline on-time probability.
2. Advance time under normal conditions; no disruption notification appears.
3. Inject a fault through the normal alert-ingestion interface.
4. Recompute current and alternative routes through the real simulator and policy.
5. Show the changed probabilities, one actionable alert, and a useful alternative.
6. Accept the alternative; persist that selection and refresh the contingency.
7. Disconnect the browser, reload, and inspect the cached plan.
8. Advance past the plan's expiry and show that it is no longer current.
9. Reconnect and recover the latest state; reset and reproduce the scenario.

Ensure the scenario leaves enough physical time to perform the recommended transfer. Reset only the selected demo scenario's data and isolate it from unrelated user records. Every demo reset must restore its clock, seed, event state, selected route, evaluation history, and notification state coherently.

## UI requirements

Create a polished mobile-first interface with commute setup, journey status, a recommendation card, a compact comparison of up to three routes, a route timeline, the offline contingency card, and an expandable demo-control panel.

Give the recommended action visual priority. Show probability, ETA range, walking/transfers, reason, and data freshness in plain language. Keep seed values and raw events in a developer panel. Use accessible colours, text labels alongside colour, keyboard navigation, labelled inputs, and readable layouts on phones and desktops.

Handle loading, empty state, invalid input, failed API requests, stale data, unavailable routes, and offline states. Persisted changes must survive a reload. Core buttons must perform real backend actions. Show a visible demo/synthetic-data label.

## API, persistence, and safeguards

Implement the architecture's relevant endpoints, adding journey creation/start/finish, route acceptance, notification retrieval, and clock/replay controls where needed. Return structured validation and error responses. Make timestamps, identifiers, and probability units consistent across the API.

Persist plans, journeys, routes, events and revisions, evaluations, recommendations, and notification state. Add migrations, health checks, environment configuration, `.env.example`, targeted rate limits, bounded requests, and correlation IDs in logs. Never put credentials in source or logs.

A clearly labelled single-user local demo is acceptable. If production authentication is deferred, do not describe the API as authenticated or multi-user secure. Gate demo mutation endpoints behind demo configuration, disable them outside demo mode, and document production authentication and ownership checks as requirements before hosting.

## Build order

1. Inspect the repository, write a short implementation plan, and establish setup commands.
2. Implement domain contracts, fixtures, the clock, and persistence.
3. Implement and test the simulator, route feasibility, and recommendation policy.
4. Connect ingestion, monitoring, notifications, and replay to API endpoints.
5. Build the frontend against those endpoints and implement offline caching.
6. Run the complete demo, exercise failures, and fix discovered problems.
7. Update the README with exact setup, run, test, and demo commands. Record implementation choices, limitations, and deferred components in `docs/IMPLEMENTATION_NOTES.md`.

## Acceptance checks

Add meaningful automated coverage for:

- Seed reproducibility; probabilities in [0, 1]; nonnegative durations; correctly ordered arrival percentiles.
- Deadline and buffer calculations, Singapore timezone boundaries, elapsed travel, and infeasible transfers.
- A later deadline cannot reduce on-time probability for identical sampled journeys; adding nonnegative delay cannot increase it. Do not assert that all uncertainty always shrinks when more evidence arrives.
- Normal commute, disruption, recovery, missed decision point, unavailable alternatives, and stale evidence.
- Threshold boundaries, hysteresis, route acceptance, cooldown, duplicate/revised events, and persistent notification deduplication.
- Plan persistence, input validation, demo-endpoint gating, coherent replay reset, and API error handling.
- A Playwright journey that exercises the actual backend, confirms probabilities change after a fault, receives exactly one equivalent alert, accepts the alternative, reloads offline, shows expiry, and reconnects successfully.

Run backend tests, frontend type checking, linting, a production frontend build, and browser tests against the service-worker-enabled build. Inspect the interface at mobile and desktop sizes. Report commands and outcomes accurately, including any checks that could not run and why.

Finish with the working local application, exact commands to launch it, a short demo walkthrough, verified checks, and remaining limitations. Keep going through implementation and verification; a static mockup or plan alone does not complete this task.
