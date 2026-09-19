import { describe, expect, it } from 'vitest'
import { formatCostPerMinute, formatDate, formatFare, formatLateness, formatMinutesSaved, formatTime } from './format'

describe('formatTime', () => {
  it('formats a bare wall-clock deadline like other times', () => {
    expect(formatTime('08:45:00')).toBe(formatTime('2026-09-21T08:45:00+08:00'))
    expect(formatTime('08:45')).toMatch(/^8:45\s?am$/i)
  })

  it('reports missing and unparseable values honestly', () => {
    expect(formatTime(null)).toBe('Not set')
    expect(formatTime('soon')).toBe('soon')
  })
})

describe('fare formatting', () => {
  it('shows dollars and cents, and names a free ride', () => {
    expect(formatFare(2.11)).toBe('$2.11')
    expect(formatFare(3.5)).toBe('$3.50')
    expect(formatFare(0)).toBe('Free')
  })

  it('formats a calendar date without shifting it across time zones', () => {
    expect(formatDate('2025-12-27')).toBe('27 Dec 2025')
    expect(formatDate('')).toBe('')
  })

  it('expresses the price of saved time in whole cents', () => {
    expect(formatCostPerMinute(.257)).toBe('26¢ per minute saved')
    expect(formatCostPerMinute(.004)).toBe('under 1¢ per minute saved')
    expect(formatCostPerMinute(null)).toBeNull()
  })
})

describe('formatMinutesSaved', () => {
  it('hides savings that round to zero minutes', () => {
    expect(formatMinutesSaved(0.4)).toBeNull()
    expect(formatMinutesSaved(null)).toBeNull()
    expect(formatMinutesSaved(-12)).toBeNull()
  })

  it('shows meaningful savings', () => expect(formatMinutesSaved(27.9)).toBe('28 min sooner'))
})

describe('formatLateness', () => {
  it('describes the ETA against the target in whole minutes', () => {
    expect(formatLateness(-14.6)).toBe('15 min early')
    expect(formatLateness(26.9)).toBe('27 min late')
    expect(formatLateness(0.3)).toBe('On target')
    expect(formatLateness(-0.4)).toBe('On target')
    expect(formatLateness(null)).toBe('Not available')
  })
})
