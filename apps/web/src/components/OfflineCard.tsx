import { CloudOff, Database, ShieldAlert } from 'lucide-react'
import { currentOfflineAction } from '../lib/planState'
import { formatDateTime, formatTime } from '../lib/format'
import type { CachedPlan, PlanState } from '../types'

export function OfflineCard({ plan, state, now }: { plan: CachedPlan | null; state: PlanState; now: Date }) {
  const recommendation = plan?.snapshot.recommendation
  const action = currentOfflineAction(plan, now)
  return <section className={`panel offline-card state-${state}`} aria-labelledby="offline-heading" data-testid="offline-plan">
    <div className="section-heading"><div><p className="eyebrow">Stored on this device</p><h2 id="offline-heading">Offline contingency</h2></div>{state === 'expired' ? <ShieldAlert aria-hidden="true" /> : <CloudOff aria-hidden="true" />}</div>
    {!plan || !recommendation ? <div className="empty-message"><Database aria-hidden="true" /><p>No plan saved yet. Connect and start monitoring to prepare for a tunnel or provider outage.</p></div> : <>
      <div className="offline-status"><span className={`state-pill ${state}`}>{state}</span><span>Last synced {formatDateTime(plan.cachedAt)}</span></div>
      {action ? <div className="contingency-action"><small>If</small><p>{recommendation.contingencyCondition}</p><small>Then</small><strong>{recommendation.contingencyAction}</strong></div> : <div className="expired-warning" role="alert"><strong>Do not rely on this plan.</strong><span>It expired {formatDateTime(recommendation.expiresAt)}. Reconnect for a current recommendation.</span></div>}
      <dl className="offline-meta"><div><dt>Generated</dt><dd>{formatDateTime(recommendation.generatedAt)}</dd></div><div><dt>Expires</dt><dd>{formatDateTime(recommendation.expiresAt)}</dd></div><div><dt>Decision deadline</dt><dd>{formatTime(recommendation.decisionDeadline)}</dd></div><div><dt>Route version</dt><dd>{recommendation.routeVersion}</dd></div></dl>
    </>}
    <p className="privacy-note">Stores only this synthetic commute on this device. Local cache is not encrypted or cryptographically signed.</p>
  </section>
}
