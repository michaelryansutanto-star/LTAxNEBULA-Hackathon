import { AlertCircle, FlaskConical, LoaderCircle, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DemoControls } from './components/DemoControls'
import { DeveloperPanel } from './components/DeveloperPanel'
import { Header } from './components/Header'
import { Inbox } from './components/Inbox'
import { OfflineCard } from './components/OfflineCard'
import { RecommendationCard } from './components/RecommendationCard'
import { RouteMap } from './components/RouteMap'
import { RoutesCard } from './components/RoutesCard'
import { SetupCard } from './components/SetupCard'
import { Timeline } from './components/Timeline'
import { useJourney } from './hooks/useJourney'
import { classifyPlan, effectivePlanTime } from './lib/planState'

export function App() {
  const journey = useJourney()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 15_000); return () => window.clearInterval(timer) }, [])
  const effectiveNow = journey.online ? new Date(journey.snapshot?.clock ?? now) : effectivePlanTime(journey.cachedPlan, now)
  const planState = classifyPlan(journey.cachedPlan?.snapshot ?? journey.snapshot, effectiveNow)
  const selectedRoute = useMemo(() => journey.snapshot?.routes.find((route) => route.selected) ?? journey.snapshot?.routes[0], [journey.snapshot])
  const disabled = Boolean(journey.busy) || !journey.online

  return <><Header online={journey.online} /><main id="main" className="app-shell">
    <div className="page-intro"><div><span className="demo-badge"><FlaskConical size={14} /> Deterministic demo · synthetic data</span><p className="kicker">Good morning, Rachel</p><h1>Your commute, with a plan B.</h1><p>Deadline-aware guidance for Tampines → Raffles Place.</p></div>{journey.snapshot && <div className="journey-status"><span className={journey.snapshot.status.toLowerCase().includes('monitor') ? 'pulse-dot' : 'status-dot'} /><div><small>Journey status</small><strong>{journey.snapshot.status}</strong></div></div>}</div>
    {!journey.online && <div className="offline-banner" role="status"><AlertCircle size={18} /><span><strong>You’re offline.</strong> Showing the last plan stored on this device. Controls are unavailable until reconnection.</span></div>}
    {journey.error && <div className="error-banner" role="alert"><AlertCircle size={18} /><span>{journey.error}</span><button aria-label="Dismiss error" onClick={() => journey.setError(null)}><X size={17} /></button></div>}
    {journey.loading && !journey.snapshot ? <div className="loading-state" role="status"><LoaderCircle className="spinner-icon" /><strong>Preparing Rachel’s commute…</strong><span>Loading the latest route evaluation.</span></div> : !journey.snapshot ? <section className="panel empty-state"><AlertCircle /><h2>Journey unavailable</h2><p>Start the local API, then reconnect to load Rachel’s deterministic demo.</p><button className="button primary" type="button" disabled={!journey.online} onClick={() => void journey.refresh()}>Try again</button></section> : <>
      <SetupCard snapshot={journey.snapshot} disabled={disabled} onSaved={() => journey.refresh()} />
      <div className="dashboard-grid"><div className="primary-column">
        <RecommendationCard snapshot={journey.snapshot} state={planState} cached={!journey.online} disabled={disabled} onEvaluate={() => void journey.journey('evaluate')} />
        <RoutesCard routes={journey.snapshot.routes} fares={journey.snapshot.fares} recommendedRouteId={journey.snapshot.recommendation?.routeId ?? null} disabled={disabled} onAccept={(id) => void journey.accept(id)} />
        <RouteMap routes={journey.snapshot.routes} recommendedRouteId={journey.snapshot.recommendation?.routeId ?? null} origin={journey.snapshot.origin} destination={journey.snapshot.destination} />
        <Timeline route={selectedRoute} />
      </div><aside className="side-column">
        <OfflineCard plan={journey.cachedPlan} state={planState} now={effectiveNow} />
        <Inbox notifications={journey.snapshot.notifications} />
        <DemoControls busy={journey.busy} disabled={disabled} onAction={(action) => void journey.demo(action)} onAdvance={(minutes) => void journey.advance(minutes)} />
        <DeveloperPanel snapshot={journey.snapshot} />
      </aside></div>
    </>}
    <footer><span>CommuteSure SG · Local single-user MVP</span><span>Simulated estimates, not live transport advice.</span></footer>
  </main></>
}
