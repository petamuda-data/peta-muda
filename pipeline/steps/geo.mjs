// Johor DUN boundary polygons from DOSM's official GeoJSON, thinned for the
// web (radial-distance simplification + 4dp rounding).
import { fetchText } from '../lib/fetch.mjs'
import { SOURCES, STATE } from '../config.mjs'

const simplifyRing = (ring, tol = 0.0015) => {
  if (ring.length <= 8) return ring.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])
  const out = [ring[0]]
  let [lx, ly] = ring[0]
  for (let i = 1; i < ring.length - 1; i++) {
    const [x, y] = ring[i]
    if (Math.abs(x - lx) + Math.abs(y - ly) >= tol) { out.push(ring[i]); lx = x; ly = y }
  }
  out.push(ring[ring.length - 1])
  return out.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])
}

const simplifyGeometry = (geom) => {
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: geom.coordinates.map(r => simplifyRing(r)) }
  if (geom.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: geom.coordinates.map(p => p.map(r => simplifyRing(r))) }
  return geom
}

const bboxOf = (geom) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const eat = (coords) => {
    if (typeof coords[0] === 'number') {
      minX = Math.min(minX, coords[0]); maxX = Math.max(maxX, coords[0])
      minY = Math.min(minY, coords[1]); maxY = Math.max(maxY, coords[1])
    } else coords.forEach(eat)
  }
  eat(geom.coordinates)
  return [minX, minY, maxX, maxY].map(v => +v.toFixed(4))
}

export async function loadGeo(seats) {
  const gj = JSON.parse(await fetchText(SOURCES.dunGeojson))
  const bySeat = new Map(seats.map(s => [s.seat, s]))
  const features = []
  const bboxes = new Map()
  for (const f of gj.features) {
    if (f.properties.state !== STATE) continue
    const seat = bySeat.get(f.properties.dun)
    if (!seat) continue
    const geometry = simplifyGeometry(f.geometry)
    bboxes.set(seat.code, bboxOf(geometry))
    features.push({
      type: 'Feature',
      properties: { code: seat.code, dun: f.properties.dun, parlimen: f.properties.parlimen, slug: seat.slug },
      geometry,
    })
  }
  return { geojson: { type: 'FeatureCollection', features }, bboxes }
}
