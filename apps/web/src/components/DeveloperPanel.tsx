import { Code2 } from 'lucide-react'
import type { SnapshotView } from '../types'
export function DeveloperPanel({ snapshot }: { snapshot: SnapshotView }) {
  return <details className="panel disclosure developer-panel"><summary><span><Code2 size={18} /> Developer telemetry</span><span>sequence {snapshot.sequence}</span></summary><div className="disclosure-content"><dl className="dev-grid"><div><dt>Scenario clock</dt><dd>{snapshot.clock}</dd></div><div><dt>Model</dt><dd>{snapshot.modelVersion}</dd></div><div><dt>Seed</dt><dd>{snapshot.seed ?? 'not supplied'}</dd></div><div><dt>Samples</dt><dd>{snapshot.sampleCount ?? 'not supplied'}</dd></div><div><dt>Input snapshot</dt><dd>{snapshot.inputSnapshotId || 'not supplied'}</dd></div><div><dt>Freshness</dt><dd>{snapshot.freshness}{snapshot.freshnessReason ? ` — ${snapshot.freshnessReason}` : ''}</dd></div></dl></div></details>
}
