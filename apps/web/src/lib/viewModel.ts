import type { FareContextView, FareView, NotificationView, RecommendationView, RouteView, Segment, SnapshotView } from '../types'

type Json = Record<string, unknown>

const obj = (value: unknown): Json => value && typeof value === 'object' ? value as Json : {}
const value = (source: Json, ...keys: string[]) => keys.map((key) => source[key]).find((item) => item !== undefined && item !== null)
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
    path: array(item, 'path').map((point) => (Array.isArray(point) ? point.slice(0, 2).map(Number) : []) as [number, number]).filter((point) => point.length === 2 && point.every(Number.isFinite)),
    affected: bool(item, false, 'affected'),
    durationMinutes: num(item, 0, 'durationMinutes', 'duration_minutes', 'expected_minutes', 'base_minutes'),
    completed: bool(item, false, 'completed'),
  }
}

function fare(raw: unknown): FareView | null {
  const item = obj(raw)
  const amount = Number(value(item, 'amount'))
  if (!Number.isFinite(amount)) return null
  const scheme = value(item, 'scheme')
  const perMinute = Number(value(item, 'extraCostPerMinuteSaved', 'extra_cost_per_minute_saved'))
  return {
    amount,
    baseAmount: num(item, amount, 'baseAmount', 'base_amount'),
    discount: num(item, 0, 'discount'),
    scheme: scheme === 'pre_peak' || scheme === 'free_off_peak' ? scheme : null,
    distanceKm: num(item, 0, 'distanceKm', 'distance_km'),
    etaMinutes: num(item, 0, 'etaMinutes', 'eta_minutes'),
    extraCostPerMinuteSaved: Number.isFinite(perMinute) && perMinute > 0 ? perMinute : null,
    cheapest: bool(item, false, 'cheapest'),
    fastest: bool(item, false, 'fastest'),
    bestValue: bool(item, false, 'bestValue', 'best_value'),
  }
}

const SOURCE_LABELS: Record<string, string> = {
  fare_table: 'LTA fare table',
  distance_fares: 'PTC distance fares',
  pre_peak: 'PTC morning pre-peak fares',
  free_off_peak: 'LTA free morning off-peak rides',
  public_holidays: 'MOM public holidays',
}

function fareContext(raw: unknown): FareContextView | null {
  if (!raw || typeof raw !== 'object') return null
  const item = obj(raw)
  const tipRaw = value(item, 'tip')
  const tip = obj(tipRaw)
  return {
    tip: tipRaw ? {
      leaveBy: str(tip, '', 'leaveBy', 'leave_by'),
      tapInBefore: str(tip, '', 'tapInBefore', 'tap_in_before'),
      saving: num(tip, 0, 'saving'),
      minutesEarlier: num(tip, 0, 'minutesEarlier', 'minutes_earlier'),
    } : null,
    railTapIn: value(item, 'railTapIn', 'rail_tap_in') as string | undefined ?? null,
    valueOfTimePerHour: num(item, 0, 'valueOfTimePerHour', 'value_of_time_per_hour'),
    tableEffective: str(item, '', 'tableEffective', 'table_effective'),
    sources: Object.entries(obj(item.sources)).filter(([, url]) => typeof url === 'string' && url.startsWith('https://')).map(([key, url]) => ({ label: SOURCE_LABELS[key] ?? key, url: String(url) })),
  }
}

function route(raw: unknown, index: number): RouteView {
  const item = obj(raw)
  const metrics = obj(item.metrics ?? item.evaluation)
  const lateRaw = value(item, 'lateMinutes', 'late_minutes') ?? value(metrics, 'lateMinutes', 'late_minutes')
  const lateMinutes = lateRaw === undefined ? NaN : Number(lateRaw)
  const routeId = str(item, `route-${index}`, 'id', 'routeId', 'route_id')
  return {
    id: routeId,
    fare: fare(item.fare),
    name: str(item, `Route ${index + 1}`, 'name', 'label'),
    description: str(item, '', 'description', 'summary'),
    eta: value(item, 'eta') as string | undefined ?? value(metrics, 'eta') as string | undefined ?? null,
    conservativeEta: value(item, 'conservativeEta', 'conservative_eta') as string | undefined
      ?? value(metrics, 'conservativeEta', 'conservative_eta') as string | undefined ?? null,
    lateMinutes: Number.isFinite(lateMinutes) ? lateMinutes : null,
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
  const action = str(item, str(contingency, str(item, actionCode, 'primaryAction', 'primary_action', 'explanation'), 'primaryAction', 'primary_action', 'action'), 'headline')
  const rawKind = actionCode.toLowerCase()
  const kind = rawKind.includes('route') || rawKind.includes('switch') ? 'reroute'
    : rawKind.includes('stay') ? 'stay' : rawKind.includes('uncertain') ? 'uncertain' : 'monitor'
  const savedRaw = value(item, 'minutesSaved', 'minutes_saved')
  const minutesSaved = savedRaw === undefined ? NaN : Number(savedRaw)
  return {
    action,
    kind,
    reason: str(item, 'Keep monitoring this journey as conditions change.', 'reason', 'explanation'),
    minutesSaved: Number.isFinite(minutesSaved) ? minutesSaved : null,
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
    status: str(item, 'delivered in app', 'status', 'state', 'delivery_status'),
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
    scenario: str(demo, "Rachel's weekday commute", 'label', 'scenario', 'name'),
    seed: Number.isFinite(Number(value(demo, 'seed') ?? value(firstMetrics, 'seed') ?? value(source, 'seed'))) ? Number(value(demo, 'seed') ?? value(firstMetrics, 'seed') ?? value(source, 'seed')) : null,
    modelVersion: str(demo, str(firstMetrics, str(source, 'unknown', 'modelVersion', 'model_version'), 'modelVersion', 'model_version'), 'modelVersion', 'model_version'),
    sampleCount: Number.isFinite(Number(value(demo, 'sampleCount', 'sample_count') ?? value(firstMetrics, 'sampleCount', 'sample_count') ?? value(source, 'sampleCount', 'sample_count'))) ? Number(value(demo, 'sampleCount', 'sample_count') ?? value(firstMetrics, 'sampleCount', 'sample_count') ?? value(source, 'sampleCount', 'sample_count')) : null,
    inputSnapshotId: str(firstMetrics, str(source, '', 'inputSnapshotId', 'input_snapshot_id'), 'inputSnapshotId', 'input_snapshot_id'),
    freshness,
    freshnessReason: str(obj(freshnessRaw), str(source, '', 'freshnessReason', 'freshness_reason'), 'reason', 'note'),
    selectedRouteId: selected || normalizedRoutes.find((item) => item.selected)?.id || null,
    routes: normalizedRoutes,
    fares: fareContext(evaluation.fares),
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
