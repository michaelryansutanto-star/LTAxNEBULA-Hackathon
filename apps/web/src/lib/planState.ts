import type { CachedPlan, PlanState, SnapshotView } from '../types'

const STALE_AFTER_MS = 5 * 60 * 1000

export function classifyPlan(snapshot: SnapshotView | null, now: Date = new Date()): PlanState {
  const recommendation = snapshot?.recommendation
  if (!snapshot || !recommendation) return 'unavailable'
  const expiresAt = Date.parse(recommendation.expiresAt)
  if (!Number.isFinite(expiresAt) || now.getTime() >= expiresAt) return 'expired'
  if (snapshot.freshness.toLowerCase().includes('stale')) return 'stale'
  const generatedAt = Date.parse(recommendation.generatedAt)
  if (Number.isFinite(generatedAt) && now.getTime() - generatedAt > STALE_AFTER_MS) return 'stale'
  return 'fresh'
}

export function chooseNewer(current: SnapshotView | null, incoming: SnapshotView): SnapshotView {
  if (!current) return incoming
  if (incoming.sequence !== current.sequence) return incoming.sequence > current.sequence ? incoming : current
  const currentTime = Date.parse(current.recommendation?.generatedAt ?? current.clock)
  const incomingTime = Date.parse(incoming.recommendation?.generatedAt ?? incoming.clock)
  return incomingTime >= currentTime ? incoming : current
}

export function currentOfflineAction(plan: CachedPlan | null, now: Date = new Date()): string | null {
  if (!plan || classifyPlan(plan.snapshot, now) === 'expired') return null
  return plan.snapshot.recommendation?.action ?? null
}

/** Advance the deterministic scenario clock by real time elapsed since the cache write. */
export function effectivePlanTime(plan: CachedPlan | null, wallClock: Date = new Date()): Date {
  if (!plan) return wallClock
  const scenarioClock = Date.parse(plan.snapshot.clock)
  const cachedAt = Date.parse(plan.cachedAt)
  if (!Number.isFinite(scenarioClock) || !Number.isFinite(cachedAt)) return wallClock
  return new Date(scenarioClock + Math.max(0, wallClock.getTime() - cachedAt))
}
