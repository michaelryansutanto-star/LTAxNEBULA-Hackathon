import { Accessibility, Check, Footprints, GitCompareArrows } from 'lucide-react'
import { formatProbability, formatTime } from '../lib/format'
import type { RouteView } from '../types'

export function RoutesCard({ routes, recommendedRouteId, onAccept, disabled }: { routes: RouteView[]; recommendedRouteId: string | null; onAccept: (id: string) => void; disabled: boolean }) {
  return <section className="panel" aria-labelledby="routes-heading"><div className="section-heading"><div><p className="eyebrow">Up to three feasible options</p><h2 id="routes-heading">Route comparison</h2></div><GitCompareArrows aria-hidden="true" /></div>
    {routes.length === 0 ? <p className="empty-message">No route candidates are available at this location.</p> : <div className="route-grid">{routes.map((route) => <article className={`route-card ${route.id === recommendedRouteId ? 'recommended' : ''} ${!route.available ? 'unavailable' : ''}`} key={route.id} data-testid="route-card">
      <div className="route-card-head"><div>{route.id === recommendedRouteId && <span className="mini-label">Recommended</span>}<h3>{route.name}</h3></div><strong className="route-probability">{formatProbability(route.probability)}</strong></div>
      <p>{route.description || (route.available ? 'Synthetic route evaluated from the current decision point.' : 'This transfer is no longer reachable.')}</p><dl className="route-stats"><div><dt>Likely ETA</dt><dd>{formatTime(route.p50)}</dd></div><div><dt>Conservative ETA</dt><dd>{formatTime(route.p90)}</dd></div></dl>
      <div className="route-meta"><span><Footprints size={14} /> {route.walkingMinutes} min</span><span><Accessibility size={14} /> {route.transfers} transfer{route.transfers === 1 ? '' : 's'}</span></div>{route.qualityReasons.length > 0 && <p className="quality-note">Data note: {route.qualityReasons.join(' · ')}</p>}
      {route.selected ? <div className="selected-label"><Check size={15} /> Selected route</div> : <button className="button secondary full" type="button" onClick={() => onAccept(route.id)} disabled={disabled || !route.available}>Accept this route</button>}
    </article>)}</div>}<p className="schematic-note">Schematic synthetic routes for demonstration—not live navigation advice.</p></section>
}
