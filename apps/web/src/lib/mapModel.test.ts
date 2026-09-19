import { describe, expect, it } from 'vitest'
import { buildMapLines, mapBounds } from './mapModel'
import { snapshot } from '../test/fixtures'
import type { RouteView, Segment } from '../types'

const segment = (id: string, overrides: Partial<Segment>): Segment => ({ id, mode: 'rail', from: 'A', to: 'B', instruction: `Step ${id}`, path: [[1.35, 103.94], [1.28, 103.85]], affected: false, ...overrides })
const base = snapshot().routes[0]
const routes: RouteView[] = [
  { ...base, id: 'ewl', selected: true, segments: [segment('walk', { mode: 'walk' }), segment('wait', { path: [[1.35, 103.94], [1.35, 103.94]] }), segment('ride', { affected: true })] },
  { ...base, id: 'dtl', selected: false, segments: [segment('ride-dtl', { path: [[1.3, 103.86], [1.27, 103.8]] })] },
  { ...base, id: 'gone', selected: false, available: false, segments: [segment('ride-gone', {})] },
]

describe('map model', () => {
  it('draws the recommended route above other routes, and disrupted stretches above everything', () => {
    expect(buildMapLines(routes, 'dtl').map((line) => [line.key, line.role])).toEqual([['ewl:walk', 'selected'], ['dtl:ride-dtl', 'recommended'], ['ewl:ride', 'selected']])
  })

  it('keeps affected and walking flags and skips waits and unreachable routes', () => {
    const lines = buildMapLines(routes, null)
    expect(lines.find((line) => line.key === 'ewl:ride')).toMatchObject({ affected: true, walk: false })
    expect(lines.find((line) => line.key === 'ewl:walk')).toMatchObject({ affected: false, walk: true })
    expect(lines.map((line) => line.key)).not.toContain('ewl:wait')
    expect(lines.map((line) => line.key)).not.toContain('gone:ride-gone')
    expect(lines[0].role).toBe('other')
  })

  it('bounds every drawn point and reports nothing to fit when empty', () => {
    expect(mapBounds(buildMapLines(routes, 'dtl'))).toEqual([[1.27, 103.8], [1.35, 103.94]])
    expect(mapBounds([])).toBeNull()
  })
})
