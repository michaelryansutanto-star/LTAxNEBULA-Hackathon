import { CloudOff, MapPinned, Wifi } from 'lucide-react'

export function Header({ online }: { online: boolean }) {
  return <header className="topbar"><a className="brand" href="#main" aria-label="CommuteSure SG home"><span className="brand-mark"><MapPinned aria-hidden="true" size={21} /></span><span>CommuteSure <b>SG</b></span></a><div className={`connection ${online ? 'online' : 'offline'}`} role="status">{online ? <Wifi size={15} aria-hidden="true" /> : <CloudOff size={15} aria-hidden="true" />}{online ? 'Connected' : 'Offline'}</div></header>
}
