import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, RefreshCw } from 'lucide-react'
import type { PlanState, SnapshotView } from '../types'
import { formatDateTime, formatLateness, formatMinutesSaved, formatTime } from '../lib/format'

export function RecommendationCard({ snapshot, state, cached, onEvaluate, disabled }: { snapshot: SnapshotView; state: PlanState; cached: boolean; onEvaluate: () => void; disabled: boolean }) {
  const recommendation = snapshot.recommendation
  const recommendedRoute = snapshot.routes.find((route) => route.id === recommendation?.routeId) ?? snapshot.routes.find((route) => route.selected)
  const isExpired = state === 'expired'
  // The headline already names the route, so the detail line only adds the timing.
  const detail = recommendation ? recommendation.reason.replace(`Change to: ${recommendation.action}. `, '') : ''
  const sooner = recommendation?.kind === 'reroute' ? formatMinutesSaved(recommendation.minutesSaved) : null
  if (!recommendation) return <section className="hero-card empty-card" aria-labelledby="recommendation-heading"><Clock3 aria-hidden="true" /><div><p className="eyebrow">Recommendation</p><h1 id="recommendation-heading">No evaluation yet</h1><p>Start monitoring to compare Rachel's routes.</p></div></section>
  const icon = recommendation.kind === 'reroute' ? <ArrowRight aria-hidden="true" /> : recommendation.kind === 'uncertain' || isExpired ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />
  return <section className={`hero-card action-${recommendation.kind} ${isExpired ? 'expired' : ''}`} aria-labelledby="recommendation-heading" data-testid="recommendation-card">
    <div className="hero-topline"><span className="eyebrow">{isExpired ? 'Saved plan expired' : cached ? 'Saved recommendation' : 'Recommended now'}</span><span className={`state-pill ${state}`}>{state}</span></div>
    <div className="hero-title"><span className="action-icon">{icon}</span><div><h1 id="recommendation-heading">{isExpired ? 'Reconnect for current advice' : recommendation.action}</h1>{isExpired ? <p>This plan expired {formatDateTime(recommendation.expiresAt)} and is shown only for history.</p> : detail !== recommendation.action && <p>{detail}</p>}</div></div>
    {!isExpired && <div className="eta-block" data-testid="recommended-eta"><strong>{formatTime(recommendedRoute?.eta ?? null)}</strong><span>expected arrival · {formatLateness(recommendedRoute?.lateMinutes ?? null)} against target</span>{sooner && <b>{sooner}</b>}</div>}
    <dl className="hero-facts"><div><dt>Event deadline</dt><dd>{formatTime(snapshot.eventDeadline)}</dd></div><div><dt>Target with {snapshot.bufferMinutes} min buffer</dt><dd>{formatTime(snapshot.targetArrival)}</dd></div><div><dt>Latest useful switch</dt><dd>{formatTime(recommendation.decisionDeadline)}</dd></div></dl>
    <div className="hero-footer"><span>Generated {formatDateTime(recommendation.generatedAt)}</span><button className="button ghost-light" type="button" onClick={onEvaluate} disabled={disabled}><RefreshCw size={15} aria-hidden="true" /> Re-evaluate</button></div>
  </section>
}
