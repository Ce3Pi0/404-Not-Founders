// Helpers for the 3D universe map.
//
// Positions in this module are physical: `mapPosition` is the exact Cartesian
// coordinate from catalog.js in light-years, and `renderPosition` is what the
// scene draws. The scene scale is linear — one world unit is one light-year —
// so the two arrays are equal today and no visual compression exists. Keeping
// them separate means any future compression is explicit, and distances are
// always measured from `mapPosition`, never from drawn coordinates.

import { EARTH, MAPPED_SYSTEMS, SYSTEMS } from './catalog'

/** Nearest region drawn by this first version of the map. */
export const MAP_REGION_LY = 150
/** Linear scale: one Three.js unit is one light-year. */
export const LY_PER_UNIT = 1
/** Cap on projected HTML name labels. */
export const LABEL_LIMIT = 12

function toEntry(system) {
  return {
    ...system,
    renderPosition: system.mapPosition.map((value) => value * LY_PER_UNIT),
  }
}

export const SOLAR_SYSTEM = toEntry(SYSTEMS.get('Solar System'))

export const REGION_SYSTEMS = MAPPED_SYSTEMS.filter(
  (system) => system.distanceLy <= MAP_REGION_LY && system.distanceLy > 0,
)
  .sort((a, b) => a.distanceLy - b.distanceLy)
  .map(toEntry)

export const REGION_SYSTEM_COUNT = REGION_SYSTEMS.length
export const BEYOND_REGION_COUNT = MAPPED_SYSTEMS.filter(
  (system) => system.distanceLy > MAP_REGION_LY,
).length

/** Everything clickable on the map: the plotted stars plus the Solar origin. */
export const PICK_TARGETS = [...REGION_SYSTEMS, SOLAR_SYSTEM]

const BY_NAME = new Map(REGION_SYSTEMS.map((system) => [system.name, system]))

/** Region entry for a host star, or the Solar System entry for Earth. */
export function mapSystemFor(planet) {
  if (!planet) return null
  if (planet.kind === 'earth' || planet.star === 'Solar System') return SOLAR_SYSTEM
  return BY_NAME.get(planet.star) ?? null
}

/** Exact 3D separation in light-years between two map entries. */
export function mapDistanceLy(a, b) {
  if (!a || !b) return null
  const [ax, ay, az] = a.mapPosition
  const [bx, by, bz] = b.mapPosition
  return Math.hypot(ax - bx, ay - by, az - bz)
}

/** Nearest mapped systems to an entry, measured from exact coordinates. */
export function nearestSystems(entry, limit = LABEL_LIMIT) {
  const origin = entry ?? SOLAR_SYSTEM
  return REGION_SYSTEMS.filter((system) => system.name !== origin.name)
    .map((system) => ({ system, distance: mapDistanceLy(origin, system) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((item) => item.system)
}

/**
 * Names shown on the map: the Solar System origin, the selected and hovered
 * systems, the current route, then the closest mapped neighbours of the focus.
 * Capped so the HTML overlay never becomes a wall of text.
 */
export function labelSystems({ selected, hovered, origin, destination }) {
  const focus = selected ?? origin ?? SOLAR_SYSTEM
  const out = []
  const seen = new Set()
  const push = (entry) => {
    if (!entry || seen.has(entry.name) || out.length >= LABEL_LIMIT) return
    seen.add(entry.name)
    out.push(entry)
  }

  if (entryIsSolar(focus)) push(SOLAR_SYSTEM)
  push(selected)
  push(hovered)
  push(origin)
  push(destination)
  for (const system of nearestSystems(focus)) push(system)

  return out
}

export function entryIsSolar(entry) {
  return Boolean(entry) && entry.name === SOLAR_SYSTEM.name
}

/** Planet shown first when a system is opened in the map panel. */
export function defaultPlanetFor(entry, preferred) {
  if (!entry) return null
  if (preferred && preferred.star === entry.name) return preferred
  if (entryIsSolar(entry)) return EARTH
  return [...entry.planets]
    .sort(
      (a, b) =>
        (a.orbitalPeriodDays ?? Number.MAX_SAFE_INTEGER) -
        (b.orbitalPeriodDays ?? Number.MAX_SAFE_INTEGER),
    )[0] ?? null
}
