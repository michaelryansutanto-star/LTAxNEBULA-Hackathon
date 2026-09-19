import { BusFront, Footprints, Route, TrainFront } from 'lucide-react'
import type { RouteView } from '../types'
const icons = { walk: Footprints, walking: Footprints, mrt: TrainFront, train: TrainFront, rail: TrainFront, bus: BusFront, express: BusFront }
export function Timeline({ route }: { route?: RouteView }) {
  return <section className="panel" aria-labelledby="timeline-heading"><div className="section-heading"><div><p className="eyebrow">From the current location only</p><h2 id="timeline-heading">Route timeline</h2></div><Route aria-hidden="true" /></div>
    {!route || route.segments.length === 0 ? <p className="empty-message">Detailed steps will appear after a route is evaluated.</p> : <ol className="timeline">{route.segments.map((segment, index) => { const Icon = icons[segment.mode as keyof typeof icons] ?? Route; return <li className={segment.completed ? 'completed' : ''} key={segment.id}><span className="timeline-icon"><Icon size={17} aria-hidden="true" /></span><div><small>Step {index + 1} · {segment.mode}</small><strong>{segment.instruction}</strong><span>{segment.from} → {segment.to}{segment.durationMinutes ? ` · about ${segment.durationMinutes} min` : ''}</span></div></li> })}</ol>}
  </section>
}
