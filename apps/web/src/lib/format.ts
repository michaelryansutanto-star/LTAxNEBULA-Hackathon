// Minutes against the target arrival: negative is early, positive is late.
export function formatLateness(value: number | null): string {
  if (value === null) return 'Not available'
  const minutes = Math.round(value)
  return minutes === 0 ? 'On target' : `${Math.abs(minutes)} min ${minutes < 0 ? 'early' : 'late'}`
}
const WALL_CLOCK = /^(\d{1,2}):(\d{2})(?::\d{2})?$/
export function formatTime(value: string | null): string {
  if (!value) return 'Not set'
  // Plan deadlines arrive as a bare Singapore wall-clock time ("08:45:00"), not an instant.
  const wallClock = WALL_CLOCK.exec(value)
  if (wallClock) return new Intl.DateTimeFormat('en-SG', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' }).format(new Date(Date.UTC(1970, 0, 1, Number(wallClock[1]), Number(wallClock[2]))))
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', hour: 'numeric', minute: '2-digit' }).format(date)
}
export function formatMinutesSaved(value: number | null): string | null {
  const minutes = value === null ? 0 : Math.round(value)
  return minutes >= 1 ? `${minutes} min sooner` : null
}
const SGD = new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', currencyDisplay: 'narrowSymbol' })
export function formatFare(value: number): string { return value <= 0 ? 'Free' : SGD.format(value) }
export function formatCostPerMinute(value: number | null): string | null {
  if (value === null) return null
  const cents = Math.round(value * 100)
  return cents >= 1 ? `${cents}¢ per minute saved` : 'under 1¢ per minute saved'
}
export function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-SG', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}
export function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value || 'Unknown' : new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date)
}
