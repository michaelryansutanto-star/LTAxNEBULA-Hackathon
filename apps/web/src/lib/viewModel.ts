import type { NotificationView, RecommendationView, RouteView, Segment, SnapshotView } from '../types'

type Json = Record<string, unknown>

const obj = (value: unknown): Json => value && typeof value === 'object' ? value as Json : {}
const value = (source: Json, ...keys: string[]) => keys.map((key) => source[key]).find((item) => item !== undefined)
const str = (source: Json, fallback: string, ...keys: string[]) => String(value(source, ...keys) ?? fallback)
const num = (source: Json, fallback: number, ...keys: string[]) => {
  const parsed = Number(value(source, ...keys))
  return Number.isFinite(parsed) ? parsed : fallback
}
const bool = (source: Json, fallback: boolean, ...keys: string[]) => {
  const found = value(source, ...keys)
  return found === undefined ? fallback : Boolean(found)
}
const array = (source: Json, ...keys: string[]): unknown[] => {
  const found = value(source, ...keys)
  return Array.isArray(found) ? found : []
}
const timestamp = (source: Json, fallback: string, ...keys: string[]) => str(source, fallback, ...keys)

function unwrap(raw: unknown): Json {
  const root = obj(raw)
  return obj(root.data ?? root)
}

function segment(raw: unknown, index: number): Segment {
  const item = obj(raw)
  const start = str(item, '', 'from', 'from_name', 'origin', 'start')
  const end = str(item, '', 'to', 'to_name', 'destination', 'end')
  return {
    id: str(item, `segment-${index}`, 'id'),
    mode: str(item, 'travel', 'mode', 'kind', 'type').toLowerCase(),
    from: start,
    to: end,
    instruction: str(item, `${start} to ${end}`, 'instruction', 'instructions', 'label', 'name'),
    durationMinutes: num(item, 0, 'durationMinutes', 'duration_minutes', 'expected_minutes', 'base_minutes'),
    completed: bool(item, false, 'completed'),
  }
}

function route(raw: unknown, index: number): RouteView {
  const item = obj(raw)
  const metrics = obj(item.metrics ?? item.evaluation)
  const probabilityValue = value(item, 'probability', 'onTimeProbability', 'on_time_probability')
    ?? value(metrics, 'probability', 'onTimeProbability', 'on_time_probability')
  const probability = Number(probabilityValue)
  const routeId = str(item, `route-${index}`, 'id', 'routeId', 'route_id')
  return {
    id: routeId,
    name: str(item, `Route ${index + 1}`, 'name', 'label'),
    description: str(item, '', 'description', 'summary'),
    probability: Number.isFinite(probability) ? probability : null,
    p50: value(item, 'p50', 'p50Arrival', 'p50_arrival') as string | undefined
      ?? value(metrics, 'p50', 'p50Arrival', 'p50_arrival') as string | undefined ?? null,
    p90: value(item, 'p90', 'p90Arrival', 'p90_arrival') as string | undefined
      ?? value(metrics, 'p90', 'p90Arrival', 'p90_arrival') as string | undefined ?? null,
    walkingMinutes: num(item, num(metrics, 0, 'walkingMinutes', 'walking_minutes'), 'walkingMinutes', 'walking_minutes'),
    transfers: num(item, num(metrics, 0, 'transfers'), 'transfers', 'transfer_count'),
    selected: bool(item, false, 'selected', 'isSelected', 'is_selected'),
    available: bool(item, true, 'available', 'feasible'),
    synthetic: bool(item, true, 'synthetic', 'is_synthetic'),
    segments: array(item, 'segments').map(segment),
    qualityReasons: array(item, 'qualityReasons', 'quality_reasons').map(String),
  }
}

function recommendation(raw: unknown, contingencyRaw: unknown, clock: string): RecommendationView | null {
  if (!raw) return null
  const item = obj(raw)
  const contingency = obj(item.contingency ?? contingencyRaw)
  const actionCode = str(item, '', 'action', 'kind', 'actionCode', 'action_code')
  if (!actionCode) return null
  const action = str(contingency, str(item, actionCode, 'primaryAction', 'primary_action', 'explanation'), 'primaryAction', 'primary_action', 'action')
  const rawKind = actionCode.toLowerCase()
  const kind = rawKind.includes('route') || rawKind.includes('switch') ? 'reroute'
    : rawKind.includes('stay') ? 'stay' : rawKind.includes('uncertain') ? 'uncertain' : 'monitor'
  const improvementRaw = Number(value(item, 'improvement', 'probabilityImprovement', 'probability_improvement'))
  return {
    action,
    kind,
    reason: str(item, 'Keep monitoring this journey as conditions change.', 'reason', 'explanation'),
    improvement: Number.isFinite(improvementRaw) ? improvementRaw : null,
    routeId: value(item, 'routeId', 'route_id', 'recommendedRouteId', 'recommended_route_id') as string ?? null,
    generatedAt: timestamp(item, clock, 'generatedAt', 'generated_at'),
    expiresAt: timestamp(item, clock, 'expiresAt', 'expires_at'),
    decisionDeadline: value(item, 'decisionDeadline', 'decision_deadline', 'latestSwitchTime', 'latest_switch_time') as string ?? null,
    contingencyCondition: str(contingency, str(item, 'If conditions worsen before the decision deadline.', 'triggerCondition', 'trigger_condition'), 'condition', 'triggerCondition', 'trigger_condition'),
    contingencyAction: str(contingency, str(item, action, 'explanation'), 'action', 'primaryAction', 'primary_action'),
    routeVersion: str(contingency, str(item, 'demo-v1', 'routeVersion', 'route_version', 'version'), 'routeVersion', 'route_version'),
  }
}

function notification(raw: unknown, index: number): NotificationView {
  const item = obj(raw)
  return {
    id: str(item, `notification-${index}`, 'id'),
    title: str(item, 'Journey update', 'title'),
    message: str(item, '', 'message', 'body'),
    status: str(item, 'delivered in app', 'status', 'delivery_status'),
    createdAt: timestamp(item, '', 'createdAt', 'created_at'),
  }
}

export function normalizeSnapshot(raw: unknown): SnapshotView {
  const source = unwrap(raw)
  const journey = obj(source.journey)
  const plan = obj(source.plan)
  const demo = obj(source.demo ?? source.metadata)
  const clock = timestamp(source, new Date().toISOString(), 'clock', 'currentTime', 'current_time', 'evaluatedAt', 'evaluated_at')
  const evaluation = obj(source.evaluation)
  const evaluationRoutes = array(evaluation, 'routes')
  const metricsByRoute = new Map(evaluationRoutes.map((rawMetric) => {
    const metric = obj(rawMetric)
    return [str(metric, '', 'routeId', 'route_id'), metric]
  }))
  const routes = array(source, 'routes', 'routeComparisons', 'route_comparisons').map((rawRoute, index) => {
    const routeObject = obj(rawRoute)
    const routeId = str(routeObject, `route-${index}`, 'id', 'routeId', 'route_id')
    return route({ ...routeObject, metrics: metricsByRoute.get(routeId) }, index)
  })
  const firstMetrics = obj(evaluationRoutes[0])
  const selected = str(journey, str(source, '', 'selectedRouteId', 'selected_route_id'), 'selectedRouteId', 'selected_route_id')
  const normalizedRoutes = routes.map((item) => ({ ...item, selected: item.selected || item.id === selected }))
  const freshnessRaw = value(source, 'freshness')
  const freshness = typeof freshnessRaw === 'string' ? freshnessRaw : str(obj(freshnessRaw), 'fresh', 'status', 'label')
  return {
    journeyId: str(journey, str(source, '', 'journeyId', 'journey_id', 'id'), 'id', 'journeyId', 'journey_id'),
    status: str(journey, str(source, 'ready', 'status'), 'status'),
    origin: str(plan, str(journey, str(source, 'Tampines', 'origin'), 'origin'), 'origin'),
    destination: str(plan, str(journey, str(source, 'Raffles Place', 'destination'), 'destination'), 'destination'),
    clock,
    eventDeadline: timestamp(plan, timestamp(journey, timestamp(source, '', 'eventDeadline', 'event_deadline', 'deadline'), 'eventDeadline', 'event_deadline', 'deadline'), 'deadline'),
    targetArrival: timestamp(evaluation, timestamp(journey, timestamp(source, '', 'targetArrival', 'target_arrival'), 'targetArrival', 'target_arrival'), 'targetArrival', 'target_arrival'),
    bufferMinutes: num(plan, num(journey, num(source, 10, 'bufferMinutes', 'buffer_minutes'), 'bufferMinutes', 'buffer_minutes'), 'bufferMinutes', 'buffer_minutes'),
    sequence: num(evaluation, num(source, 0, 'sequence', 'sequenceNumber', 'sequence_number'), 'sequence'),
    scenario: str(demo, 'Rachel’s weekday commute', 'label', 'scenario', 'name'),
    seed: Number.isFinite(Number(value(demo, 'seed') ?? value(firstMetrics, 'seed') ?? value(source, 'seed'))) ? Number(value(demo, 'seed') ?? value(firstMetrics, 'seed') ?? value(source, 'seed')) : null,
    modelVersion: str(demo, str(firstMetrics, str(source, 'unknown', 'modelVersion', 'model_version'), 'modelVersion', 'model_version'), 'modelVersion', 'model_version'),
    sampleCount: Number.isFinite(Number(value(demo, 'sampleCount', 'sample_count') ?? value(firstMetrics, 'sampleCount', 'sample_count') ?? value(source, 'sampleCount', 'sample_count'))) ? Number(value(demo, 'sampleCount', 'sample_count') ?? value(firstMetrics, 'sampleCount', 'sample_count') ?? value(source, 'sampleCount', 'sample_count')) : null,
    inputSnapshotId: str(firstMetrics, str(source, '', 'inputSnapshotId', 'input_snapshot_id'), 'inputSnapshotId', 'input_snapshot_id'),
    freshness,
    freshnessReason: str(obj(freshnessRaw), str(source, '', 'freshnessReason', 'freshness_reason'), 'reason', 'note'),
    selectedRouteId: selected || normalizedRoutes.find((item) => item.selected)?.id || null,
    routes: normalizedRoutes,
    recommendation: recommendation(source.recommendation, source.contingency, clock),
    notifications: array(source, 'notifications').map(notification),
  }
}

export function scenarioJourneyId(raw: unknown): string | null {
  const source = unwrap(raw)
  const journey = obj(source.journey)
  const id = value(source, 'journeyId', 'journey_id', 'id') ?? value(journey, 'journeyId', 'journey_id', 'id')
  return id ? String(id) : null
}
