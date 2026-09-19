import type { RouteView } from '../types'

export type LineRole = 'recommended' | 'selected' | 'other'

export interface MapLine {
  key: string
  routeName: string
  label: string
  points: [number, number][]
  role: LineRole
  affected: boolean
  walk: boolean
}

const ROLE_ORDER: LineRole[] = ['other', 'selected', 'recommended']

/** Lines to draw, least important first so what matters most ends up on top. */
export function buildMapLines(routes: RouteView[], recommendedRouteId: string | null): MapLine[] {
  const lines = routes.filter((route) => route.available).flatMap((route) => {
    const role: LineRole = route.id === recommendedRouteId ? 'recommended' : route.selected ? 'selected' : 'other'
    return route.segments
      .filter((segment) => segment.path.length >= 2 && segment.path.some(([lat, lon]) => lat !== segment.path[0][0] || lon !== segment.path[0][1]))
      .map((segment) => ({ key: `${route.id}:${segment.id}`, routeName: route.name, label: segment.instruction, points: segment.path, role, affected: segment.affected, walk: segment.mode === 'walk' }))
  })
  // A disrupted stretch is drawn above everything: routes often share track, and it must never be hidden.
  return lines.sort((a, b) => Number(a.affected) - Number(b.affected) || ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
}

export function mapBounds(lines: MapLine[]): [[number, number], [number, number]] | null {
  const points = lines.flatMap((line) => line.points)
  if (points.length === 0) return null
  const lats = points.map(([lat]) => lat)
  const lons = points.map(([, lon]) => lon)
  return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]]
}
