import { useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { saveCommute } from '../lib/api'
import type { CommuteForm, SnapshotView } from '../types'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
function timeValue(timestamp: string, fallback: string): string {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? timestamp.slice(0, 5) || fallback : new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

export function SetupCard({ snapshot, disabled, onSaved }: { snapshot: SnapshotView; disabled: boolean; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<CommuteForm>({ origin: snapshot.origin, destination: snapshot.destination, weekdays: WEEKDAYS, deadline: timeValue(snapshot.eventDeadline, '08:45'), bufferMinutes: snapshot.bufferMinutes })
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setNotice('')
    if (!form.origin.trim() || !form.destination.trim() || form.bufferMinutes < 0 || form.bufferMinutes > 120) { setNotice('Enter an origin, destination, and a buffer from 0 to 120 minutes.'); return }
    try { await saveCommute(form); await onSaved(); setNotice('Commute saved. The deadline and early-arrival target were recalculated.') }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Unable to save commute.') }
  }
  return <section className="panel setup-card" aria-labelledby="setup-heading">
    <button className="panel-toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span><CalendarDays size={18} aria-hidden="true" /><span><small>Saved commute</small><strong id="setup-heading">{snapshot.origin} → {snapshot.destination}</strong></span></span><ChevronDown size={19} className={open ? 'rotated' : ''} aria-hidden="true" /></button>
    {open && <form className="setup-form" onSubmit={submit}><div className="form-grid">
      <label>Origin<input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} required /></label>
      <label>Destination<input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required /></label>
      <label>Arrival deadline<input aria-describedby="deadline-help" type="time" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} required /></label>
      <label>Early-arrival buffer (minutes)<input type="number" min="0" max="120" value={form.bufferMinutes} onChange={(e) => setForm({ ...form, bufferMinutes: Number(e.target.value) })} required /></label>
    </div><fieldset><legend>Recurring weekdays</legend><div className="weekday-row">{WEEKDAYS.map((day) => <label className="day-check" key={day}><input type="checkbox" checked={form.weekdays.includes(day)} onChange={() => setForm({ ...form, weekdays: form.weekdays.includes(day) ? form.weekdays.filter((item) => item !== day) : [...form.weekdays, day] })} />{day}</label>)}</div></fieldset>
      <p className="field-help" id="deadline-help">Target arrival is the event deadline minus this buffer.</p><button className="button primary" type="submit" disabled={disabled}>Save commute</button>{notice && <p className="form-notice" role="status">{notice}</p>}</form>}
  </section>
}
