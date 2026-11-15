// Normalisation of the Solar System OpenData extract (`src/data/solarSystem.json`)
// into the same record shape the NASA exoplanet CSV is parsed into in catalog.js.
//
// Two datasets, one catalogue: the CSV stays the single source of truth for
// exoplanets, and this module only reshapes the eight Solar System planets so
// PLANETS / BY_ID / SYSTEMS can hold both without special cases.
//
// Conversion constants are the ones the rest of the app already uses:
//   · 1 AU            = 149,597,870.7 km
//   · Earth mass      = 5.9722 × 10²⁴ kg
//   · Earth mean radius = 6,371 km
//
// Nothing here invents a measurement: a property that the extract marks 0 (its
// "unknown" placeholder) or omits becomes `null`, and any field the shared
// catalogue has no equivalent for is kept under its own explicit name.

/** 1 astronomical unit in kilometres. */
export const AU_KM = 149597870.7
/** Earth mass reference, in kilograms. */
export const EARTH_MASS_KG = 5.9722e24
/** Earth mean radius reference, in kilometres. */
export const EARTH_RADIUS_KM = 6371

/** The host star's name, used as every Solar System planet's `star`. */
export const SOLAR_SYSTEM_NAME = 'Solar System'

/**
 * The Sun, as the app's host-star representation expects it. Every Solar System
 * planet carries these same values, which is how `describeStar()` and the
 * system view already read a host star.
 */
export const SOLAR_HOST_STAR = {
  // Deliberately not `name`: that key belongs to the planet itself.
  hostStarName: 'Sun',
  spectralType: 'G2 V',
  starMassSun: 1,
  starRadiusSun: 1,
  starLuminositySun: 1,
  starTeffK: 5772,
}

/** OpenData ids → the app's stable planet ids. */
const ID_BY_SOURCE = {
  mercure: 'mercury',
  venus: 'venus',
  terre: 'earth',
  mars: 'mars',
  jupiter: 'jupiter',
  saturne: 'saturn',
  uranus: 'uranus',
  neptune: 'neptune',
}

/**
 * Observed surface character. The shared classifier infers a look from bulk
 * estimates for exoplanets; for the Solar System we know the answer, so it is
 * stated rather than inferred.
 */
const SURFACE_BY_ID = {
  mercury: 'rocky',
  venus: 'desert',
  earth: 'ocean',
  mars: 'desert',
  jupiter: 'gas',
  saturn: 'gas',
  uranus: 'neptune',
  neptune: 'neptune',
}

/** Canonical order, innermost first. */
export const SOLAR_PLANET_ORDER = [
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
]

/** A finite number, or null — the extract uses 0 for "unknown" in places. */
const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
/** A finite, strictly positive number, or null. */
const positive = (value) => {
  const parsed = finite(value)
  return parsed != null && parsed > 0 ? parsed : null
}

const kmToAu = (km) => {
  const value = positive(km)
  return value == null ? null : value / AU_KM
}

/**
 * One OpenData body → one catalogue planet record.
 *
 * `id` stays the app's own stable id (`earth`, not `terre`) so existing deep
 * links and lookups keep working, and `kind` is `earth` for the home world and
 * `solar` for its siblings — `isSolarWorld()` in catalog.js treats both alike.
 */
export function normalizeSolarBody(body) {
  if (!body || body.isPlanet !== true) return null
  const id = ID_BY_SOURCE[body.id]
  if (!id) return null

  const massKg =
    body.mass && finite(body.mass.massValue) != null && finite(body.mass.massExponent) != null
      ? body.mass.massValue * 10 ** body.mass.massExponent
      : null
  const massEarthMeasured = massKg != null && massKg > 0 ? massKg / EARTH_MASS_KG : null
  const radiusEarthMeasured = positive(body.meanRadius) == null
    ? null
    : positive(body.meanRadius) / EARTH_RADIUS_KM

  const semiMajorAxisAu = kmToAu(body.semimajorAxis)
  const orbitalPeriodDays = positive(body.sideralOrbit)
  // The extract reports `avgTemp` in kelvin (288 for Earth, 737 for Venus), so
  // no Celsius step is applied; its 0 placeholder means "not reported".
  const meanTempK = positive(body.avgTemp)

  return {
    ...SOLAR_HOST_STAR,
    id,
    name: body.englishName ?? body.name ?? id,
    star: SOLAR_SYSTEM_NAME,
    kind: id === 'earth' ? 'earth' : 'solar',
    // Origin distance: the Solar System *is* the origin, so the host star is
    // 0 ly away. The planet's own orbital radius lives in semiMajorAxisAu.
    distancePc: 0,
    distanceLy: 0,
    distanceKnown: true,
    ra: 0,
    dec: 0,
    semiMajorAxisAu,
    orbitalPeriodDays,
    // Measured values, used directly by the renderer and the inspector: unlike
    // the exoplanet rows these are not random estimates, so no bulkEstimated.
    massEarthMeasured,
    radiusEarthMeasured,
    massEarth: massEarthMeasured,
    radiusEarth: radiusEarthMeasured,
    massSource: massEarthMeasured == null ? null : 'Solar System OpenData measurement',
    massIsMinimum: false,
    densityGcc: positive(body.density),
    // Mean surface temperature, not equilibrium temperature: kept under its own
    // name so the two are never confused.
    meanTempK,
    eqTempK: null,
    surfaceType: SURFACE_BY_ID[id] ?? null,
    // Extra orbital and physical fields kept for inspection features.
    meanRadiusKm: positive(body.meanRadius),
    equaRadiusKm: positive(body.equaRadius),
    polarRadiusKm: positive(body.polarRadius),
    flattening: finite(body.flattening),
    massKg,
    volumeKm3: body.vol ? finite(body.vol.volValue) != null && finite(body.vol.volExponent) != null
      ? body.vol.volValue * 10 ** body.vol.volExponent
      : null : null,
    surfaceGravityMs2: positive(body.gravity),
    escapeVelocityMs: positive(body.escape),
    eccentricity: finite(body.eccentricity),
    inclinationDeg: finite(body.inclination),
    axialTiltDeg: finite(body.axialTilt),
    rotationHours: finite(body.sideralRotation),
    perihelionAu: kmToAu(body.perihelion),
    aphelionAu: kmToAu(body.aphelion),
    bodyType: body.bodyType ?? null,
    dataSource: 'Solar System OpenData',
    // Position in the interstellar map frame: the Solar origin.
    position: [0, 0, 0],
  }
}

/**
 * Every planetary body in the extract, innermost first, deduplicated by id —
 * so a repeated row can never add a second Earth.
 */
export function buildSolarPlanets(bodies = []) {
  const byId = new Map()
  for (const body of bodies) {
    const planet = normalizeSolarBody(body)
    if (planet && !byId.has(planet.id)) byId.set(planet.id, planet)
  }
  return [...byId.values()].sort((a, b) => {
    const order = SOLAR_PLANET_ORDER.indexOf(a.id) - SOLAR_PLANET_ORDER.indexOf(b.id)
    if (order !== 0) return order
    return (a.semiMajorAxisAu ?? 0) - (b.semiMajorAxisAu ?? 0)
  })
}

/** Orbit radius in AU for a body, whether the record is normalized or raw. */
export function orbitalRadiusAu(planet) {
  const value = positive(planet?.semiMajorAxisAu)
  return value
}
