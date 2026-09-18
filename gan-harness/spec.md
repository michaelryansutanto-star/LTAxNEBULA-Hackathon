# CommuteSure SG MVP build specification

Source of truth: `docs/BUILD_PROMPT.md`, supplemented by `docs/SYSTEM_ARCHITECTURE.md`.

Build a local-only, single-user demo consisting of a FastAPI/SQLite modular monolith and a React/TypeScript/Vite PWA. The deterministic Rachel scenario must use the same provider-ingestion, simulation, policy, persistence, notification, and evaluation paths as ordinary API operations.

The complete journey is: load Rachel's synthetic Tampines-to-Raffles Place commute; start monitoring; advance normally without notification; inject an EWL fault; recompute seeded Monte Carlo arrival distributions; produce one actionable reroute; accept and persist it; reload the service-worker-enabled app offline; expire the cached plan using clock progression; reconnect and reconcile; reset coherently.

All probabilities are computed in Python, reproducible for identical inputs, and visibly labelled simulated. Candidate itineraries are synthetic and schematic. Demo mutation endpoints are disabled when demo mode is off. Authentication, live providers, remote push, encryption/signing, and calibrated predictions are deferred and must not be claimed.

The nested `everything-claude-code/` directory is excluded from the application and must not be modified.
