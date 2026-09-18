import { describe, expect, it } from 'vitest'
import { chooseNewer, classifyPlan, currentOfflineAction, effectivePlanTime } from './planState'
import { snapshot } from '../test/fixtures'

describe('offline plan state', () => {
  it('classifies fresh, stale, expired and unavailable plans with an injected clock', () => {
    expect(classifyPlan(snapshot(), new Date('2026-09-20T23:46:00Z'))).toBe('fresh')
    expect(classifyPlan(snapshot(), new Date('2026-09-20T23:51:00Z'))).toBe('stale')
    expect(classifyPlan(snapshot(), new Date('2026-09-21T00:15:00Z'))).toBe('expired')
    expect(classifyPlan(null, new Date('2026-09-20T23:46:00Z'))).toBe('unavailable')
  })

  it('honours an explicit stale provider status', () => {
    expect(classifyPlan(snapshot({ freshness: 'stale provider data' }), new Date('2026-09-20T23:46:00Z'))).toBe('stale')
  })

  it('never exposes an expired action as current advice', () => {
    const plan = { snapshot: snapshot(), cachedAt: '2026-09-20T23:45:00Z' }
    expect(currentOfflineAction(plan, new Date('2026-09-21T00:15:00Z'))).toBeNull()
    expect(currentOfflineAction(plan, new Date('2026-09-20T23:46:00Z'))).toContain('Stay')
  })

  it('keeps a newer sequence when an older request finishes late', () => {
    const newer = snapshot({ sequence: 3 })
    expect(chooseNewer(newer, snapshot({ sequence: 2 }))).toBe(newer)
    expect(chooseNewer(snapshot({ sequence: 1 }), newer)).toBe(newer)
  })

  it('advances the scenario clock by elapsed wall-clock time while offline', () => {
    const plan = { snapshot: snapshot(), cachedAt: '2026-09-21T02:00:00Z' }
    expect(effectivePlanTime(plan, new Date('2026-09-21T02:30:00Z')).toISOString()).toBe('2026-09-21T00:15:00.000Z')
  })
})
