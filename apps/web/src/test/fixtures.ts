import type { SnapshotView } from '../types'

export function snapshot(overrides: Partial<SnapshotView> = {}): SnapshotView {
  return {
    journeyId: 'journey-1', status: 'monitoring', origin: 'Tampines', destination: 'Raffles Place',
    clock: '2026-09-21T07:45:00+08:00', eventDeadline: '2026-09-21T08:45:00+08:00', targetArrival: '2026-09-21T08:35:00+08:00',
    bufferMinutes: 10, sequence: 1, scenario: 'Rachel', seed: 42, modelVersion: 'demo-v1', sampleCount: 5000,
    inputSnapshotId: 'input-1', freshness: 'fresh', freshnessReason: '', selectedRouteId: 'ewl', notifications: [],
    routes: [{ id: 'ewl', name: 'EWL', probability: .86, p50: '2026-09-21T08:20:00+08:00', p90: '2026-09-21T08:31:00+08:00', walkingMinutes: 6, transfers: 0, selected: true, available: true, synthetic: true, segments: [], qualityReasons: [] }],
    recommendation: { action: 'Stay on the East-West Line', kind: 'stay', reason: 'Current route remains reliable.', improvement: null, routeId: 'ewl', generatedAt: '2026-09-21T07:45:00+08:00', expiresAt: '2026-09-21T08:15:00+08:00', decisionDeadline: '2026-09-21T08:06:00+08:00', contingencyCondition: 'If no movement for six minutes', contingencyAction: 'Switch at Bugis', routeVersion: 'rachel-v1' },
    ...overrides,
  }
}
