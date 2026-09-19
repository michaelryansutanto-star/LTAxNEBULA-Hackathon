import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RoutesCard } from './RoutesCard'
import { snapshot } from '../test/fixtures'
import type { FareContextView, FareView, RouteView } from '../types'

const fare = (overrides: Partial<FareView>): FareView => ({ amount: 2.11, baseAmount: 2.11, discount: 0, scheme: null, distanceKm: 15.7, etaMinutes: 44, extraCostPerMinuteSaved: null, cheapest: false, fastest: false, bestValue: false, ...overrides })
const base = snapshot().routes[0]
const routes: RouteView[] = [
  { ...base, fare: fare({ amount: 1.61, discount: .5, scheme: 'pre_peak', cheapest: true, bestValue: true }) },
  { ...base, id: 'bus', name: 'Express bus', selected: false, fare: fare({ amount: 3.15, baseAmount: 3.15, etaMinutes: 38, fastest: true, extraCostPerMinuteSaved: .257 }) },
]
const context: FareContextView = { tip: { leaveBy: '2026-09-21T07:38:00+08:00', tapInBefore: '2026-09-21T07:45:00+08:00', saving: .5, minutesEarlier: 2 }, railTapIn: '2026-09-21T07:46:00+08:00', valueOfTimePerHour: 12, tableEffective: '2025-12-27', sources: [{ label: 'PTC morning pre-peak fares', url: 'https://www.ptc.gov.sg/fares/morning-pre-peak-fares/' }] }

describe('routes card fares', () => {
  it('shows fare, discount and value badges for each route', () => {
    render(<RoutesCard routes={routes} fares={context} recommendedRouteId="ewl" disabled={false} onAccept={vi.fn()} />)
    const [rail, bus] = screen.getAllByTestId('route-card')
    expect(within(rail).getByTestId('route-fare')).toHaveTextContent('$1.61')
    expect(within(rail).getByText('Best value')).toBeVisible()
    expect(within(rail).getByText(/after \$0\.50 pre-peak discount/)).toBeVisible()
    expect(within(bus).getByText('Fastest')).toBeVisible()
    expect(within(bus).getByText(/26¢ per minute saved against the cheapest option/)).toBeVisible()
    expect(within(bus).queryByText('Best value')).toBeNull()
  })

  it('explains how to catch the pre-peak discount and links its source', () => {
    render(<RoutesCard routes={routes} fares={context} recommendedRouteId="ewl" disabled={false} onAccept={vi.fn()} />)
    expect(screen.getByTestId('fare-tip')).toHaveTextContent(/Leave by 7:38\s?am, 2 min earlier, to tap in before 7:45\s?am and save \$0\.50/i)
    expect(screen.getByRole('link', { name: 'PTC morning pre-peak fares' })).toHaveAttribute('href', 'https://www.ptc.gov.sg/fares/morning-pre-peak-fares/')
  })

  it('stays quiet about fares when the API sends none', () => {
    render(<RoutesCard routes={[base]} fares={null} recommendedRouteId={null} disabled={false} onAccept={vi.fn()} />)
    expect(screen.queryByTestId('route-fare')).toBeNull()
    expect(screen.queryByTestId('fare-tip')).toBeNull()
  })
})
