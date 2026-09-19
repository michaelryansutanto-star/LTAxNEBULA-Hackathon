import { Accessibility, Check, Footprints, GitCompareArrows, PiggyBank } from 'lucide-react'
import { formatCostPerMinute, formatDate, formatFare, formatLateness, formatTime } from '../lib/format'
import type { FareContextView, FareView, RouteView } from '../types'

const SCHEME_LABELS = { pre_peak: 'pre-peak discount', free_off_peak: 'free off-peak ride' }

function FareBadges({ fare }: { fare: FareView }) {
  const badges = [fare.bestValue && 'Best value', fare.cheapest && 'Cheapest', fare.fastest && 'Fastest'].filter(Boolean)
  return badges.length === 0 ? null : <div className="fare-badges">{badges.map((badge) => <span className={badge === 'Best value' ? 'fare-badge best' : 'fare-badge'} key={String(badge)}>{badge}</span>)}</div>
}

function FareLine({ fare }: { fare: FareView }) {
  const perMinute = formatCostPerMinute(fare.extraCostPerMinuteSaved)
  return <p className="fare-note">{Math.round(fare.etaMinutes)} min for {formatFare(fare.amount)}{fare.scheme && ` after ${formatFare(fare.discount)} ${SCHEME_LABELS[fare.scheme]}`}{perMinute && ` · ${perMinute} against the cheapest option`}</p>
}

export function RoutesCard({ routes, fares, recommendedRouteId, onAccept, disabled }: { routes: RouteView[]; fares: FareContextView | null; recommendedRouteId: string | null; onAccept: (id: string) => void; disabled: boolean }) {
  return <section className="panel" aria-labelledby="routes-heading"><div className="section-heading"><div><p className="eyebrow">Up to three feasible options</p><h2 id="routes-heading">Route comparison</h2></div><GitCompareArrows aria-hidden="true" /></div>
    {fares?.tip && <p className="fare-tip" role="note" data-testid="fare-tip"><PiggyBank size={18} aria-hidden="true" /><span>Leave by <b>{formatTime(fares.tip.leaveBy)}</b>, {fares.tip.minutesEarlier} min earlier, to tap in before {formatTime(fares.tip.tapInBefore)} and save <b>{formatFare(fares.tip.saving)}</b> on the train fare.</span></p>}
    {routes.length === 0 ? <p className="empty-message">No route candidates are available at this location.</p> : <div className="route-grid">{routes.map((route) => <article className={`route-card ${route.id === recommendedRouteId ? 'recommended' : ''} ${!route.available ? 'unavailable' : ''}`} key={route.id} data-testid="route-card">
      <div className="route-card-head"><div>{route.id === recommendedRouteId && <span className="mini-label">Recommended</span>}<h3>{route.name}</h3></div><strong className="route-eta" data-testid="route-eta">{formatTime(route.eta)}</strong></div>
      <p>{route.description || (route.available ? 'Synthetic route evaluated from the current decision point.' : 'This transfer is no longer reachable.')}</p><dl className="route-stats"><div><dt>Against target</dt><dd className={route.lateMinutes !== null && route.lateMinutes > 0 ? 'late' : undefined} data-testid="route-lateness">{formatLateness(route.lateMinutes)}</dd></div><div><dt>Slow-day ETA</dt><dd>{formatTime(route.conservativeEta)}</dd></div>{route.fare && <div><dt>Adult card fare</dt><dd data-testid="route-fare">{formatFare(route.fare.amount)}</dd></div>}</dl>
      {route.fare && <><FareBadges fare={route.fare} /><FareLine fare={route.fare} /></>}
      <div className="route-meta"><span><Footprints size={14} /> {route.walkingMinutes} min</span><span><Accessibility size={14} /> {route.transfers} transfer{route.transfers === 1 ? '' : 's'}</span></div>{route.qualityReasons.length > 0 && <p className="quality-note">Data note: {route.qualityReasons.join(' · ')}</p>}
      {route.selected ? <div className="selected-label"><Check size={15} /> Selected route</div> : <button className="button secondary full" type="button" onClick={() => onAccept(route.id)} disabled={disabled || !route.available}>Accept this route</button>}
    </article>)}</div>}
    {fares && <p className="schematic-note">Best value weighs fare against travel time at {formatFare(fares.valueOfTimePerHour)} per hour, an adjustable assumption, and only considers routes expected to arrive by the target when any do. Fares use the published adult card table effective {formatDate(fares.tableEffective)} on synthetic distances. Sources: {fares.sources.map((source, index) => <span key={source.url}>{index > 0 && ', '}<a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></span>)}.</p>}
    <p className="schematic-note">Schematic synthetic routes for demonstration - not live navigation advice.</p></section>
}
