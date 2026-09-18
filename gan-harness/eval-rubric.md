# CommuteSure SG MVP evaluation rubric

Score each category from 0 to 2. Passing score: 8/10, with no zero in correctness or offline behavior.

1. **Decision correctness** — real seeded Monte Carlo simulation, remaining-travel semantics, deadline minus buffer, shared incident delay, feasible routes, and transparent quality reasons.
2. **Lifecycle and policy** — persisted journey/route state, exact reroute gates, freshness, action deadline, hysteresis/cooldown, semantic notification deduplication, and coherent replay reset.
3. **Offline behavior** — production service worker and IndexedDB snapshot survive actual network disconnection; generation, expiry, route version, decision deadline, and last sync are shown; expired plans are not current advice.
4. **User experience and safeguards** — responsive accessible UI, visible synthetic/schematic labels, structured errors, correlation IDs, bounded demo controls, localhost defaults, and demo-mode endpoint gate.
5. **Verification and documentation** — backend coverage at least 80%, frontend tests/typecheck/lint/build pass, Playwright exercises the actual backend and offline build, and README/implementation notes contain exact commands and honest limitations.
