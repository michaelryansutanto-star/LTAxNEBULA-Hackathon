export function formatProbability(value: number | null): string { return value === null ? '—' : `${Math.round(value * 100)}%` }
export function formatTime(value: string | null): string {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', hour: 'numeric', minute: '2-digit' }).format(date)
}
export function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value || 'Unknown' : new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date)
}
