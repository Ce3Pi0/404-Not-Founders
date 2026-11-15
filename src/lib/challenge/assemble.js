// Pure route assembly for the Expedition Challenge.
//
// No catalogue import lives here: callers pass stops with their exact host-star
// positions and landing bodies. That keeps the whole energy/time projection
// testable in plain Node, and keeps one implementation of every formula.
//
// Itinerary → stops → legs. There is always exactly one leg per interstellar
// hop, plus the final return leg to Earth. Consecutive planets in the same host
// system are one stop, never a fictitious second journey.

import {
  SURVEY_YEARS,
  accelerationEnergy,
  brakingEnergy,
  clampBeta,
  departureProfile,
  legTravelTimes,
  propulsionEnergy,
} from './physics.js'

export const EARTH_SYSTEM = 'Solar System'
export const DEFAULT_OUTBOUND_BETA = 0.6
export const DEFAULT_RETURN_BETA = 0.7

export const EARTH_DEPARTURE_BODY = {
  id: 'earth',
  name: 'Earth',
  kind: 'earth',
}

/** Stable key for one leg's user-chosen speed. */
export function legKey(index, fromSystem, toSystem) {
  return `${index}|${fromSystem}→${toSystem}`
}

/** Exact 3D separation in light-years between two host stars. */
export function systemDistanceLy(a, b) {
  if (!a || !b) return null
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function completeLeg(leg, beta) {
  const speed = clampBeta(beta)
  const times = legTravelTimes(leg.distanceLy, speed)
  const accel = accelerationEnergy(speed)
  const brake = brakingEnergy(speed)
  return {
    ...leg,
    beta: speed,
    gamma: times.gamma,
    accelerationCost: accel,
    brakingCost: brake,
    propulsionCost: propulsionEnergy(speed),
    totalEnergyCost: leg.gravityCost + accel + brake,
    earthYears: times.earthYears,
    shipYears: times.shipYears,
    driftYears: times.driftYears,
  }
}

function makeLeg({ index, fromSystem, toSystem, fromPosition, toPosition, departureBody, stop }) {
  const profile = departureProfile(departureBody)
  return {
    index,
    key: legKey(index, fromSystem, toSystem),
    fromSystem,
    toSystem,
    fromPosition,
    toPosition,
    distanceLy: systemDistanceLy(fromPosition, toPosition) ?? 0,
    departurePlanetId: departureBody?.id ?? null,
    departurePlanetName: departureBody?.name ?? fromSystem,
    departureMode: profile.surface ? 'surface' : 'orbital',
    departureReason: profile.reason,
    gravityCost: profile.cost ?? 0,
    gravityAvailable: profile.cost != null,
    arrivalPlanetId: stop ? stop.planetIds[0] : 'earth',
    arrivalPlanetName: stop ? stop.planetNames[0] : 'Earth',
    surveyPlanetIds: stop ? [...stop.planetIds] : [],
  }
}

/**
 * Stops in visit order. Each stop is
 * `{ systemName, position:[x,y,z], planetIds, planetNames, landingPlanet }`.
 */
export function assembleExpedition(stops = [], legSpeeds = {}) {
  const legCount = stops.length + 1
  const legs = []

  for (let index = 0; index < legCount; index += 1) {
    const fromSystem = index === 0 ? EARTH_SYSTEM : stops[index - 1].systemName
    const toSystem = index === legCount - 1 ? EARTH_SYSTEM : stops[index].systemName
    const fromPosition = index === 0 ? [0, 0, 0] : stops[index - 1].position
    const toPosition = index === legCount - 1 ? [0, 0, 0] : stops[index].position
    const departureBody =
      index === 0 ? EARTH_DEPARTURE_BODY : stops[index - 1].landingPlanet
    const stop = index === legCount - 1 ? null : stops[index]

    const leg = makeLeg({
      index,
      fromSystem,
      toSystem,
      fromPosition,
      toPosition,
      departureBody,
      stop,
    })
    const defaultBeta = index === legCount - 1 ? DEFAULT_RETURN_BETA : DEFAULT_OUTBOUND_BETA
    legs.push(completeLeg(leg, legSpeeds[leg.key] ?? defaultBeta))
  }

  const plannedSurveys = stops.reduce((sum, stop) => sum + stop.planetIds.length, 0)
  const surveyYears = plannedSurveys * SURVEY_YEARS
  const sum = (pick) => legs.reduce((total, leg) => total + pick(leg), 0)

  return {
    stops,
    legs,
    skipped: [],
    plannedSurveys,
    planetIds: stops.flatMap((stop) => stop.planetIds),
    surveyYears,
    gravityTotal: sum((leg) => leg.gravityCost),
    accelerationTotal: sum((leg) => leg.accelerationCost),
    brakingTotal: sum((leg) => leg.brakingCost),
    totalEnergy: sum((leg) => leg.totalEnergyCost),
    totalEarthYears: sum((leg) => leg.earthYears) + surveyYears,
    totalShipYears: sum((leg) => leg.shipYears) + surveyYears,
    totalDistanceLy: sum((leg) => leg.distanceLy),
    valid: stops.length > 0 && legs.length === stops.length + 1,
    betaRange: [0.1, 0.99],
  }
}

/** One direct leg home, used when the player ends the route early. */
export function assembleDirectReturnLeg({
  fromSystem,
  fromPosition,
  departurePlanet,
  index,
  beta,
  key,
}) {
  const leg = makeLeg({
    index,
    fromSystem,
    toSystem: EARTH_SYSTEM,
    fromPosition,
    toPosition: [0, 0, 0],
    departureBody: departurePlanet,
    stop: null,
  })
  return completeLeg(leg, beta)
}

/** Group an ordered planet list into consecutive same-system stops. */
export function groupStops(planets = []) {
  const stops = []
  for (const planet of planets) {
    if (!planet?.systemName || !planet.position) continue
    const last = stops[stops.length - 1]
    if (last && last.systemName === planet.systemName) {
      last.planetIds.push(planet.id)
      last.planetNames.push(planet.name)
      continue
    }
    stops.push({
      systemName: planet.systemName,
      position: planet.position,
      planetIds: [planet.id],
      planetNames: [planet.name],
      landingPlanet: planet,
    })
  }
  return stops
}
