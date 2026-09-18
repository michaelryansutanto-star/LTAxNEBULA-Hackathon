import { Bell, CheckCheck } from 'lucide-react'
import { formatDateTime } from '../lib/format'
import type { NotificationView } from '../types'

export function Inbox({ notifications }: { notifications: NotificationView[] }) {
  return <details className="panel disclosure" data-testid="inbox"><summary><span><Bell size={18} aria-hidden="true" /> Notification inbox</span><b aria-label={`${notifications.length} notifications`}>{notifications.length}</b></summary>
    <div className="disclosure-content">{notifications.length === 0 ? <p className="empty-message">No alerts—silence means there is no new action to take.</p> : <ol className="inbox-list">{notifications.map((item) => <li key={item.id}><span className="notification-icon"><CheckCheck size={16} /></span><div><strong>{item.title}</strong><p>{item.message}</p><small>{item.status} · {formatDateTime(item.createdAt)}</small></div></li>)}</ol>}</div>
  </details>
}
