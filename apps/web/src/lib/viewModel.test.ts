import { describe, expect, it } from 'vitest'
import { normalizeSnapshot, scenarioJourneyId } from './viewModel'

const raw = { success: true, data: {
  clock: '2026-09-21T07:40:00+08:00', sequence: 4,
  journey: { id: 'rachel-1', status: 'monitoring', selected_route_id: 'ewl' },
  plan: { origin: 'Tampines', destination: 'Raffles Place', deadline: '2026-09-21T08:45:00+08:00', buffer_minutes: 10 },
  evaluation: { sequence: 4, target_arrival: '2026-09-21T08:35:00+08:00', routes: [{ route_id: 'ewl', on_time_probability: .91, p50_arrival: '2026-09-21T08:20:00+08:00', p90_arrival: '2026-09-21T08:30:00+08:00', seed: 7, sample_count: 5000, model_version: 'mc-v1', input_snapshot_id: 'input-4' }] },
  routes: [{ id: 'ewl', name: 'EWL synthetic', available: true, segments: [{ id: 'walk', kind: 'walk', from: 'Home', to: 'Station', base_minutes: 6, instructions: 'Walk to station.' }] }],
  recommendation: { action: 'stay', route_id: 'ewl', explanation: 'Stay on the EWL.', improvement: 0, generated_at: '2026-09-21T07:40:00+08:00', expires_at: '2026-09-21T08:10:00+08:00', decision_deadline: '2026-09-21T08:06:00+08:00', freshness: 'fresh' },
  contingency: { primary_action: 'Stay on the EWL.', trigger_condition: 'If movement stops', route_version: 'rachel-v1' },
  notifications: [{ id: 'n1', title: 'Update', body: 'Stay', state: 'delivered', created_at: '2026-09-21T07:40:00+08:00' }],
} }

describe('snapshot API view model', () => {
  it('unwraps the envelope and merges simulation metrics into route fixtures', () => {
    const result = normalizeSnapshot(raw)
    expect(result.routes[0]).toMatchObject({ id: 'ewl', probability: .91, p50: '2026-09-21T08:20:00+08:00', selected: true })
    expect(result.routes[0].segments[0]).toMatchObject({ mode: 'walk', durationMinutes: 6, instruction: 'Walk to station.' })
  })

  it('keeps event deadline distinct from buffered target arrival', () => {
    const result = normalizeSnapshot(raw)
    expect(result.eventDeadline).toContain('08:45')
    expect(result.targetArrival).toContain('08:35')
    expect(result.bufferMinutes).toBe(10)
  })

  it('maps recommendation, developer telemetry and delivered inbox fields', () => {
    const result = normalizeSnapshot(raw)
    expect(result.recommendation).toMatchObject({ kind: 'stay', action: 'Stay on the EWL.', routeVersion: 'rachel-v1' })
    expect(result).toMatchObject({ seed: 7, sampleCount: 5000, modelVersion: 'mc-v1', inputSnapshotId: 'input-4' })
    expect(result.notifications[0]).toMatchObject({ message: 'Stay', status: 'delivered' })
  })

  it('finds a journey id in scenario envelopes', () => expect(scenarioJourneyId(raw)).toBe('rachel-1'))
})
