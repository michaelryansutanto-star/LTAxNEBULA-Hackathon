import type { CommuteForm, SnapshotView } from '../types'
import { normalizeSnapshot, scenarioJourneyId } from './viewModel'

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) { super(message) }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  let body: unknown = null
  try { body = await response.json() } catch { /* A valid empty 204 has no body. */ }
  if (!response.ok) {
    const error = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const detail = error.detail ?? error.message ?? `Request failed (${response.status})`
    throw new ApiError(typeof detail === 'string' ? detail : JSON.stringify(detail), response.status)
  }
  return body
}

export async function loadScenario(): Promise<string> {
  const raw = await request('/v1/demo/scenarios/rachel')
  const id = scenarioJourneyId(raw)
  if (!id) throw new ApiError('Rachel’s demo journey is unavailable.')
  return id
}

export async function getSnapshot(journeyId: string): Promise<SnapshotView> {
  return normalizeSnapshot(await request(`/v1/journeys/${encodeURIComponent(journeyId)}/snapshot`))
}

export async function journeyAction(journeyId: string, action: 'start' | 'evaluate' | 'finish'): Promise<unknown> {
  return request(`/v1/journeys/${encodeURIComponent(journeyId)}/${action}`, { method: 'POST' })
}

export async function acceptRoute(journeyId: string, routeId: string): Promise<unknown> {
  return request(`/v1/journeys/${encodeURIComponent(journeyId)}/routes/${encodeURIComponent(routeId)}/accept`, { method: 'POST' })
}

export async function demoAction(action: 'reset' | 'start' | 'pause' | 'fault' | 'resolve' | 'stale', minutes?: number): Promise<unknown> {
  const path = action === 'start' || action === 'pause' || action === 'reset' || action === 'fault' || action === 'resolve' || action === 'stale'
    ? `/v1/demo/scenarios/rachel/${action}` : '/v1/demo/scenarios/rachel/advance'
  return request(path, { method: 'POST', body: minutes === undefined ? undefined : JSON.stringify({ minutes }) })
}

export async function advanceDemo(minutes: number): Promise<unknown> {
  return request('/v1/demo/scenarios/rachel/advance', { method: 'POST', body: JSON.stringify({ minutes }) })
}

export async function saveCommute(form: CommuteForm): Promise<unknown> {
  return request('/v1/commute-plans', {
    method: 'POST',
    body: JSON.stringify({
      origin: form.origin,
      destination: form.destination,
      weekdays: form.weekdays.map((day) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(day)).filter((day) => day >= 0),
      deadline: form.deadline,
      buffer_minutes: form.bufferMinutes,
    }),
  })
}
