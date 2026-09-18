export type PlanState = 'fresh' | 'stale' | 'expired' | 'unavailable'

export interface Segment {
  id: string
  mode: string
  from: string
  to: string
  instruction: string
  durationMinutes?: number
  completed?: boolean
}

export interface RouteView {
  id: string
  name: string
  description?: string
  probability: number | null
  p50: string | null
  p90: string | null
  walkingMinutes: number
  transfers: number
  selected: boolean
  available: boolean
  synthetic: boolean
  segments: Segment[]
  qualityReasons: string[]
}

export interface RecommendationView {
  action: string
  kind: 'stay' | 'reroute' | 'monitor' | 'uncertain'
  reason: string
  improvement: number | null
  routeId: string | null
  generatedAt: string
  expiresAt: string
  decisionDeadline: string | null
  contingencyCondition: string
  contingencyAction: string
  routeVersion: string
}

export interface NotificationView {
  id: string
  title: string
  message: string
  status: string
  createdAt: string
}

export interface SnapshotView {
  journeyId: string
  status: string
  origin: string
  destination: string
  clock: string
  eventDeadline: string
  targetArrival: string
  bufferMinutes: number
  sequence: number
  scenario: string
  seed: number | null
  modelVersion: string
  sampleCount: number | null
  inputSnapshotId: string
  freshness: string
  freshnessReason: string
  selectedRouteId: string | null
  routes: RouteView[]
  recommendation: RecommendationView | null
  notifications: NotificationView[]
}

export interface CachedPlan {
  snapshot: SnapshotView
  cachedAt: string
}

export interface CommuteForm {
  origin: string
  destination: string
  weekdays: string[]
  deadline: string
  bufferMinutes: number
}
