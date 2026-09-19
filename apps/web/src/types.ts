export type PlanState = 'fresh' | 'stale' | 'expired' | 'unavailable'

export interface Segment {
  id: string
  mode: string
  from: string
  to: string
  instruction: string
  path: [number, number][]
  affected: boolean
  durationMinutes?: number
  completed?: boolean
}

export interface FareView {
  amount: number
  baseAmount: number
  discount: number
  scheme: 'pre_peak' | 'free_off_peak' | null
  distanceKm: number
  etaMinutes: number
  extraCostPerMinuteSaved: number | null
  cheapest: boolean
  fastest: boolean
  bestValue: boolean
}

export interface FareTipView {
  leaveBy: string
  tapInBefore: string
  saving: number
  minutesEarlier: number
}

export interface FareContextView {
  tip: FareTipView | null
  railTapIn: string | null
  valueOfTimePerHour: number
  tableEffective: string
  sources: { label: string; url: string }[]
}

export interface RouteView {
  fare: FareView | null
  id: string
  name: string
  description?: string
  eta: string | null
  conservativeEta: string | null
  lateMinutes: number | null
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
  minutesSaved: number | null
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
  fares: FareContextView | null
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
