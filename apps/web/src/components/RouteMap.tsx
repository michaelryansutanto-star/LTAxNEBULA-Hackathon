import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Map as MapIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildMapLines, mapBounds, type MapLine } from '../lib/mapModel'
import type { RouteView } from '../types'

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
const COLOURS = { recommended: '#176b54', selected: '#102d26', other: '#7d8a85', affected: '#b3261e' }

function lineStyle(line: MapLine): L.PolylineOptions {
  const prominent = line.role !== 'other'
  // Disruption is carried by the dash pattern as well as the colour, so it does not rely on colour vision.
  if (line.affected) return { color: COLOURS.affected, weight: 6, opacity: 1, dashArray: '2 10', lineCap: 'round' }
  return { color: COLOURS[line.role], weight: prominent ? 5 : 3, opacity: prominent ? .95 : .7, dashArray: line.walk ? '1 7' : undefined, lineCap: 'round' }
}

export function RouteMap({ routes, recommendedRouteId, origin, destination }: { routes: RouteView[]; recommendedRouteId: string | null; origin: string; destination: string }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const [tilesFailed, setTilesFailed] = useState(false)
  const lines = useMemo(() => buildMapLines(routes, recommendedRouteId), [routes, recommendedRouteId])
  const hasAffected = lines.some((line) => line.affected)

  useEffect(() => {
    if (!container.current) return
    const instance = L.map(container.current, { scrollWheelZoom: false, zoomSnap: .25 })
    instance.attributionControl.setPrefix(false)
    const tiles = L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(instance)
    tiles.on('tileerror', () => setTilesFailed(true))
    tiles.on('tileload', () => setTilesFailed(false))
    layer.current = L.layerGroup().addTo(instance)
    map.current = instance
    return () => { instance.remove(); map.current = null; layer.current = null }
  }, [])

  useEffect(() => {
    if (!map.current || !layer.current) return
    layer.current.clearLayers()
    for (const line of lines) L.polyline(line.points, lineStyle(line)).bindTooltip(`${line.routeName}: ${line.label}`, { sticky: true }).addTo(layer.current)
    const primary = lines.filter((line) => line.role !== 'other')
    const ends: [string, [number, number] | undefined][] = [[origin, (primary[0] ?? lines[0])?.points[0]], [destination, (primary.at(-1) ?? lines.at(-1))?.points.at(-1)]]
    for (const [name, point] of ends) if (point) L.circleMarker(point, { radius: 7, color: '#ffffff', weight: 3, fillColor: COLOURS.selected, fillOpacity: 1 }).bindTooltip(name, { permanent: true, direction: 'top', offset: [0, -8], className: 'map-place' }).addTo(layer.current)
    const bounds = mapBounds(lines)
    if (bounds) map.current.fitBounds(bounds, { padding: [28, 28] })
  }, [lines, origin, destination])

  return <section className="panel" aria-labelledby="map-heading"><div className="section-heading"><div><p className="eyebrow">Where each option goes</p><h2 id="map-heading">Route map</h2></div><MapIcon aria-hidden="true" /></div>
    <div className="route-map" ref={container} data-testid="route-map" role="application" aria-label={`Map of route options from ${origin} to ${destination}`} />
    <ul className="map-legend" aria-label="Map legend">
      <li><span className="legend-line recommended" />Recommended</li>
      <li><span className="legend-line selected" />Selected</li>
      <li><span className="legend-line other" />Other options</li>
      <li><span className="legend-line walk" />Walking</li>
      <li className={hasAffected ? 'legend-alert' : ''} data-testid="legend-affected"><span className="legend-line affected" />{hasAffected ? 'Affected by the disruption' : 'Affected by a disruption (none now)'}</li>
    </ul>
    {tilesFailed && <p className="quality-note map-note" role="status">Map tiles could not be loaded, which is expected offline or underground. The route lines are drawn from the saved plan and remain accurate.</p>}
    <p className="schematic-note">Base map &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. Route lines are schematic links between approximate station positions, not surveyed track or road geometry.</p>
  </section>
}
