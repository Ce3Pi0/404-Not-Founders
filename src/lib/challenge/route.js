// Route model for the Expedition Challenge.
//
// One continuous expedition: Earth → host systems → Earth. The itinerary is an
// ordered list of planet ids. Consecutive planets that share a host star collapse
// into a single stop, so adding a second world inside a system you already visit
// never invents an extra interstellar leg.
//
// Interstellar distances use each host star's exact catalogue Cartesian
// position (`SYSTEMS[].mapPosition`), derived from `sy_dist` (parsecs) and
// `ra`/`dec`. Planet orbital separations are a separate local mechanic and are
// never treated as interstellar distances.

import { PLANETS, SYSTEMS, planetById } from '../catalog'
import {
  EARTH_SYSTEM,
  assembleDirectReturnLeg,
  assembleExpedition,
  groupStops,
  legKey,
  systemDistanceLy,
} from './assemble.js'
import { BETA_MAX, BETA_MIN } from './physics.js'

export {
  EARTH_SYSTEM,
  DEFAULT_OUTBOUND_BETA,
  DEFAULT_RETURN_BETA,
  legKey,
  systemDistanceLy,
} from './assemble.js'

/** Exact host-star Cartesian position in light-years, or null when unmeasured. */
export function hostPosition(systemName) {
  if (!systemName) return null
  return SYSTEMS.get(systemName)?.mapPosition ?? null
}

/** Planets the archive places in one host system, innermost first. */
export function systemPlanets(systemName) {
  return (SYSTEMS.get(systemName)?.planets ?? [])
    .filter((planet) => planet.kind !== 'earth')
    .slice()
    .sort(
      (a, b) =>
        (a.orbitalPeriodDays ?? Number.MAX_SAFE_INTEGER) -
        (b.orbitalPeriodDays ?? Number.MAX_SAFE_INTEGER),
    )
}

/** True when the archive measured this system's distance, so it can be plotted. */
export function systemIsMappable(systemName) {
  return Boolean(hostPosition(systemName))
}

/** A planet plus the exact position of its host system, for grouping. */
export function routeTarget(planet) {
  if (!planet || planet.kind === 'earth') return null
  const position = hostPosition(planet.star)
  if (!position) return null
  return { ...planet, systemName: planet.star, position }
}

/**
 * Build the whole expedition from the itinerary, in visit order.
 *
 * A structurally valid route is one with at least one exoplanet; budgets never
 * affect validity — the planner may only warn.
 */
export function buildExpeditionRoute(planetIds = [], legSpeeds = {}, options = {}) {
  const seen = new Set()
  const targets = []
  const skipped = []

  for (const id of planetIds) {
    const planet = planetById(id)
    const target = routeTarget(planet)
    if (!target) {
      skipped.push(id)
      continue
    }
    if (seen.has(target.id)) continue
    seen.add(target.id)
    targets.push(target)
  }

  const stops = groupStops(targets)
  const route = assembleExpedition(stops, legSpeeds, options)
  return {
    ...route,
    skipped,
    effectiveStops: stops.length,
    betaRange: [BETA_MIN, BETA_MAX],
  }
}

/** One direct leg home from the current system, for ending the route early. */
export function buildDirectReturnLeg({ fromSystem, departurePlanetId, index, beta, key, options }) {
  const position = hostPosition(fromSystem)
  const planet = planetById(departurePlanetId)
  if (!position || !planet || planet.kind === 'earth') return null
  return assembleDirectReturnLeg({
    fromSystem,
    fromPosition: position,
    departurePlanet: planet,
    index,
    beta,
    key: key ?? legKey(index, fromSystem, EARTH_SYSTEM),
    options,
  })
}

/** Planets the archive lists in a system that the player has not surveyed yet. */
export function surveyablePlanets(systemName, surveyedIds = []) {
  const surveyed = new Set(surveyedIds)
  return systemPlanets(systemName).filter((planet) => !surveyed.has(planet.id))
}

/** Every host system with a measured distance. */
export function mappedSystems() {
  return [...SYSTEMS.values()].filter((system) => system.mapPosition)
}

/** Catalogued exoplanets that sit in a measured system. */
export const MAPPABLE_PLANET_COUNT = PLANETS.filter(
  (planet) => planet.kind !== 'earth' && systemIsMappable(planet.star),
).length
