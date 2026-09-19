import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RecommendationCard } from './RecommendationCard'
import { snapshot } from '../test/fixtures'

describe('recommendation card', () => {
  it('visibly distinguishes deadline and buffered target', () => {
    render(<RecommendationCard snapshot={snapshot()} state="fresh" cached={false} disabled={false} onEvaluate={vi.fn()} />)
    expect(screen.getByText('Event deadline')).toBeVisible()
    expect(screen.getByText('Target with 10 min buffer')).toBeVisible()
    expect(screen.getByRole('button', { name: /re-evaluate/i })).toBeEnabled()
    expect(screen.getByTestId('recommended-eta')).toHaveTextContent(/8:20.*15 min early against target/i)
  })

  it('suppresses the current ETA and advice when expired', () => {
    render(<RecommendationCard snapshot={snapshot()} state="expired" cached disabled onEvaluate={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /reconnect for current advice/i })).toBeVisible()
    expect(screen.queryByTestId('recommended-eta')).not.toBeInTheDocument()
  })
})
