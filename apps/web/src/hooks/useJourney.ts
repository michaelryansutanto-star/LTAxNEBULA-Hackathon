import { useCallback, useEffect, useRef, useState } from 'react'
import { acceptRoute, advanceDemo, demoAction, getSnapshot, journeyAction, loadScenario } from '../lib/api'
import { clearPlan, loadPlan, savePlan } from '../lib/db'
import { chooseNewer } from '../lib/planState'
import type { CachedPlan, SnapshotView } from '../types'

type DemoAction = 'reset' | 'start' | 'pause' | 'fault' | 'resolve' | 'stale'

export function useJourney() {
  const [snapshot, setSnapshot] = useState<SnapshotView | null>(null)
  const [cachedPlan, setCachedPlan] = useState<CachedPlan | null>(null)
  const [journeyId, setJourneyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const requestSequence = useRef(0)

  const commitSnapshot = useCallback(async (incoming: SnapshotView) => {
    setSnapshot((current) => chooseNewer(current, incoming))
    const plan = await savePlan(incoming)
    setCachedPlan(plan)
  }, [])

  const refresh = useCallback(async (knownId?: string) => {
    const sequence = ++requestSequence.current
    const id = knownId ?? journeyId ?? await loadScenario()
    setJourneyId(id)
    const incoming = await getSnapshot(id)
    if (sequence !== requestSequence.current) return
    await commitSnapshot(incoming)
    setError(null)
  }, [commitSnapshot, journeyId])

  useEffect(() => {
    let active = true
    async function initialise() {
      try {
        const cached = await loadPlan()
        if (active && cached) {
          setCachedPlan(cached)
          setSnapshot(cached.snapshot)
          setJourneyId(cached.snapshot.journeyId)
        }
        if (navigator.onLine) await refresh(cached?.snapshot.journeyId)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load the journey.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void initialise()
    return () => { active = false }
  }, [refresh])

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      setLoading(true)
      void refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Reconnection failed.'))
        .finally(() => setLoading(false))
    }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [refresh])

  const run = useCallback(async (label: string, operation: () => Promise<unknown>, options?: { clear?: boolean }) => {
    if (!online) {
      setError('You are offline. Saved plans remain available, but controls need a connection.')
      return
    }
    setBusy(label)
    setError(null)
    try {
      await operation()
      if (options?.clear) {
        await clearPlan()
        setCachedPlan(null)
        setSnapshot(null)
        setJourneyId(null)
      }
      await refresh(options?.clear ? undefined : journeyId ?? undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to ${label}.`)
    } finally {
      setBusy(null)
    }
  }, [journeyId, online, refresh])

  const journey = useCallback((action: 'start' | 'evaluate' | 'finish') => {
    if (!journeyId) return Promise.resolve()
    return run(action, () => journeyAction(journeyId, action))
  }, [journeyId, run])
  const demo = useCallback((action: DemoAction) => run(action, () => demoAction(action), { clear: action === 'reset' }), [run])
  const advance = useCallback((minutes: number) => run(`advance ${minutes} minutes`, () => advanceDemo(minutes)), [run])
  const accept = useCallback((routeId: string) => {
    if (!journeyId) return Promise.resolve()
    return run('accept route', () => acceptRoute(journeyId, routeId))
  }, [journeyId, run])

  return { snapshot, cachedPlan, journeyId, loading, busy, error, online, setError, refresh, journey, demo, advance, accept }
}
