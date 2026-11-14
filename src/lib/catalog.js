import raw from '../data/exoplanets.json'
import { HIGHLIGHTS } from './planet'

export const PLANETS = raw.map((planet) => ({
  ...planet,
  id: planet.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
}))

export const BY_NAME = new Map(PLANETS.map((planet) => [planet.name, planet]))

const NOTE_BY_NAME = new Map(HIGHLIGHTS.map((entry) => [entry.name, entry.note]))
export const noteFor = (name) => NOTE_BY_NAME.get(name) ?? null

export const RECOMMENDED = HIGHLIGHTS.map((entry) => BY_NAME.get(entry.name))
  .filter(Boolean)
  .slice(0, 8)

export const NEAREST = [...PLANETS].sort((a, b) => a.distanceLy - b.distanceLy).slice(0, 6)

export const DEFAULT_PLANET = BY_NAME.get('Proxima Cen b') ?? PLANETS[0]

export function searchPlanets(query, limit = 16) {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const starts = []
  const contains = []
  for (const planet of PLANETS) {
    const name = planet.name.toLowerCase()
    const star = (planet.star ?? '').toLowerCase()
    if (name.startsWith(needle) || star.startsWith(needle)) starts.push(planet)
    else if (name.includes(needle) || star.includes(needle)) contains.push(planet)
  }
  return [...starts, ...contains].slice(0, limit)
}
