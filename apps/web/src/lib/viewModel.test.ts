import { describe, expect, it } from 'vitest'
import { normalizeSnapshot, scenarioJourneyId } from './viewModel'

const raw = { success: true, data: {
  clock: '2026-09-21T07:40:00+08:00', sequence: 4,
  journey: { id: 'rachel-1', status: 'monitoring', selected_route_id: 'ewl' },
  plan: { origin: 'Tampines', destination: 'Raffles Place', deadline: '2026-09-21T08:45:00+08:00', buffer_minutes: 10 },
  evaluation: { sequence: 4, target_arrival: '2026-09-21T08:35:00+08:00', routes: [{ route_id: 'ewl', eta: '2026-09-21T08:20:00+08:00', conservative_eta: '2026-09-21T08:30:00+08:00', late_minutes: -15, seed: 7, sample_count: 5000, model_version: 'mc-v1', input_snapshot_id: 'input-4' }] },
  routes: [{ id: 'ewl', name: 'EWL synthetic', available: true, segments: [{ id: 'walk', kind: 'walk', from: 'Home', to: 'Station', base_minutes: 6, instructions: 'Walk to station.' }] }],
  recommendation: { action: 'stay', route_id: 'ewl', explanation: 'Stay on the EWL.', minutes_saved: 0, generated_at: '2026-09-21T07:40:00+08:00', expires_at: '2026-09-21T08:10:00+08:00', decision_deadline: '2026-09-21T08:06:00+08:00', freshness: 'fresh' },
  contingency: { primary_action: 'Stay on the EWL.', trigger_condition: 'If movement stops', route_version: 'rachel-v1' },
  notifications: [{ id: 'n1', title: 'Update', body: 'Stay', state: 'delivered', created_at: '2026-09-21T07:40:00+08:00' }],
} }

describe('snapshot API view model', () => {
  it('unwraps the envelope and merges simulation metrics into route fixtures', () => {
    const result = normalizeSnapshot(raw)
    expect(result.routes[0]).toMatchObject({ id: 'ewl', eta: '2026-09-21T08:20:00+08:00', conservativeEta: '2026-09-21T08:30:00+08:00', lateMinutes: -15, selected: true })
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

  it('prefers the short headline and keeps the explanation as the reason', () => {
    const result = normalizeSnapshot({ ...raw, data: { ...raw.data, recommendation: { ...raw.data.recommendation, action: 'reroute', headline: 'Switch at Bugis', explanation: 'Change to: Switch at Bugis. You arrive about 28 min sooner.', minutes_saved: 27.9 } } })
    expect(result.recommendation).toMatchObject({ kind: 'reroute', action: 'Switch at Bugis', reason: 'Change to: Switch at Bugis. You arrive about 28 min sooner.', minutesSaved: 27.9 })
  })

  it('maps fares, the pre-peak tip and only https sources', () => {
    const withFares = { data: { ...raw.data,
      routes: [{ ...raw.data.routes[0], segments: [{ id: 'ride', kind: 'ride', mode: 'rail' }, { id: 'walk', kind: 'walk', mode: null }], fare: { route_id: 'ewl', amount: 1.61, base_amount: 2.11, discount: .5, scheme: 'pre_peak', distance_km: 15.7, eta_minutes: 44, extra_cost_per_minute_saved: null, cheapest: true, fastest: false, best_value: true } }],
      evaluation: { ...raw.data.evaluation, fares: { tip: { leave_by: '2026-09-21T07:38:00+08:00', tap_in_before: '2026-09-21T07:45:00+08:00', saving: .5, minutes_earlier: 2 }, rail_tap_in: '2026-09-21T07:46:00+08:00', value_of_time_per_hour: 12, table_effective: '2025-12-27', sources: { pre_peak: 'https://www.ptc.gov.sg/fares/morning-pre-peak-fares/', unsafe: 'javascript:alert(1)' } } },
    } }
    const result = normalizeSnapshot(withFares)
    expect(result.routes[0].fare).toMatchObject({ amount: 1.61, baseAmount: 2.11, scheme: 'pre_peak', bestValue: true, extraCostPerMinuteSaved: null })
    expect(result.routes[0].segments.map((item) => item.mode)).toEqual(['rail', 'walk'])
    expect(result.fares).toMatchObject({ tip: { leaveBy: '2026-09-21T07:38:00+08:00', minutesEarlier: 2 }, valueOfTimePerHour: 12 })
    expect(result.fares?.sources).toEqual([{ label: 'PTC morning pre-peak fares', url: 'https://www.ptc.gov.sg/fares/morning-pre-peak-fares/' }])
  })

  it('leaves fares empty for snapshots evaluated before fares existed', () => {
    const result = normalizeSnapshot(raw)
    expect(result.fares).toBeNull()
    expect(result.routes[0].fare).toBeNull()
  })

  it('finds a journey id in scenario envelopes', () => expect(scenarioJourneyId(raw)).toBe('rachel-1'))
})
