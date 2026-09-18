import { AlertOctagon, ChevronDown, CirclePause, Clock, Play, RefreshCcw, ShieldX } from 'lucide-react'

export function DemoControls({ busy, disabled, onAction, onAdvance }: { busy: string | null; disabled: boolean; onAction: (action: 'reset' | 'start' | 'pause' | 'fault' | 'resolve' | 'stale') => void; onAdvance: (minutes: number) => void }) {
  return <details className="panel disclosure demo-controls" open><summary><span><Play size={18} aria-hidden="true" /> Rachel demo controls</span><ChevronDown aria-hidden="true" /></summary><div className="disclosure-content">
    <p>All controls feed the same ingestion, simulation, and policy path used by monitoring.</p><div className="control-grid">
      <button className="button secondary" type="button" disabled={disabled} onClick={() => onAction('start')}><Play size={15} /> Start monitoring</button>
      <button className="button secondary" type="button" disabled={disabled} onClick={() => onAction('pause')}><CirclePause size={15} /> Pause</button>
      <button className="button secondary" type="button" disabled={disabled} onClick={() => onAdvance(5)}><Clock size={15} /> Advance 5 min</button>
      <button className="button danger" type="button" disabled={disabled} onClick={() => onAction('fault')}><AlertOctagon size={15} /> Trigger EWL fault</button>
      <button className="button secondary" type="button" disabled={disabled} onClick={() => onAction('resolve')}><ShieldX size={15} /> Resolve fault</button>
      <button className="button secondary" type="button" disabled={disabled} onClick={() => onAction('stale')}><Clock size={15} /> Simulate stale data</button>
      <button className="button quiet" type="button" disabled={disabled} onClick={() => onAction('reset')}><RefreshCcw size={15} /> Reset scenario</button>
    </div>{busy && <p className="busy-label" role="status"><span className="spinner" /> Running: {busy}…</p>}
  </div></details>
}
