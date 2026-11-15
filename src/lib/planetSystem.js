// Local planetary-system scene model for the Star System Explorer.
//
// Scale discipline: the universe map (starMap.js) measures world units in
// light-years. This module never reuses that scale — one scene unit is one AU,
// and the archive's `pl_orbsmax` is drawn literally as the orbital radius. The
// camera is framed to the system instead of the system being squeezed to fit a
// shared galactic scale.
//
// Honesty rules baked in here:
//  · The extract has no `pl_rade`, so relative sizes come from the derived
//    `radiusEarth` estimate and are drawn exaggerated for visibility; every
//    label that shows them says so.
//  · Orbits are circular, with a deterministic *illustrative* starting phase —
//    not a present-day ephemeris (the extract has no epoch or mean anomaly).
//  · Rows without `pl_orbsmax` are never given an invented radius: they are
//    returned in `uncharted` and the UI shows "Orbit not fully characterized".

import { classifyPlanet, hashString, mulberry32, starColor } from './planet'
import { formatNumber } from './physics'

const TAU = Math.PI * 2

/** 1 local scene unit = 1 AU — separate from the light-year universe map. */
export const AU_PER_UNIT = 1

export const SPEED_MIN_DAYS_PER_SECOND = 0.05
export const SPEED_MAX_DAYS_PER_SECOND = 20

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/** Log slider position (0..1) → simulated days per real second. */
export function daysPerSecond(position) {
  const t = clamp(position, 0, 1)
  return SPEED_MIN_DAYS_PER_SECOND * (SPEED_MAX_DAYS_PER_SECOND / SPEED_MIN_DAYS_PER_SECOND) ** t
}

export function formatSimSpeed(days) {
  return days < 10 ? `${formatNumber(days, 2)} d` : `${formatNumber(days, 1)} d`
}

/** AU values span four orders of magnitude across the archive. */
export function formatAu(value) {
  if (value == null) return '—'
  if (value >= 10) return `${formatNumber(value, 1)} AU`
  if (value >= 1) return `${formatNumber(value, 2)} AU`
  if (value >= 0.01) return `${formatNumber(value, 3)} AU`
  return `${formatNumber(value, 4)} AU`
}

/** Round AU reading for the live scale bar. */
export function niceAu(value) {
  if (!Number.isFinite(value) || value <= 0) return 0
  const exponent = Math.floor(Math.log10(value))
  const base = 10 ** exponent
  const step = [1, 2, 5, 10].find((candidate) => candidate * base >= value) ?? 10
  return step * base
}

/**
 * Build the drawable system: the host star, one body per planet that has an
 * orbital semi-major axis, and the rows that cannot be placed.
 */
export function buildPlanetSystem(entry) {
  if (!entry?.planets?.length) return null

  const placed = []
  const uncharted = []
  for (const planet of entry.planets) {
    if (planet.semiMajorAxisAu != null && planet.semiMajorAxisAu > 0) placed.push(planet)
    else uncharted.push(planet)
  }
  placed.sort((a, b) => a.semiMajorAxisAu - b.semiMajorAxisAu)

  // Extent drives the camera framing and the exaggerated body sizes.
  const extentAu = placed.length
    ? placed[placed.length - 1].semiMajorAxisAu
    : 0.5
  // The host star is one object: use the same row the inspector reads, so the
  // drawn colour and the reported spectral class never disagree.
  const reference = entry.planets[0] ?? placed[0]
  const starRadiusSun = reference?.starRadiusSun ?? 1

  // Separation between neighbouring orbits. The Solar System spans 0.39 to 30 AU,
  // so a size based on the outermost orbit alone would draw a Sun wider than
  // Mercury's orbit — every drawn size below is capped by the room a body
  // actually has, never by the system's overall extent.
  const gapBefore = (index) =>
    index === 0
      ? (placed[0]?.semiMajorAxisAu ?? 0)
      : placed[index].semiMajorAxisAu - placed[index - 1].semiMajorAxisAu
  const gapAfter = (index) =>
    index === placed.length - 1
      ? (placed[index]?.semiMajorAxisAu ?? 0)
      : placed[index + 1].semiMajorAxisAu - placed[index].semiMajorAxisAu
  const spacingFor = (index) => Math.max(0, Math.min(gapBefore(index), gapAfter(index)))
  const innermostAu = placed[0]?.semiMajorAxisAu ?? extentAu

  const star = {
    name: entry.name,
    color: starColor(reference?.starTeffK),
    teff: reference?.starTeffK ?? null,
    radiusSun: starRadiusSun,
    massSun: reference?.starMassSun ?? null,
    luminositySun: reference?.starLuminositySun ?? null,
    // Drawn radius: exaggerated (a real star is ~0.005 AU), but still scaled by
    // the derived stellar radius so a giant reads larger than a red dwarf, and
    // capped so it can never swallow the innermost orbit.
    units: Math.min(
      clamp(extentAu * 0.06 * Math.sqrt(starRadiusSun), extentAu * 0.03, extentAu * 0.1),
      Math.max(extentAu * 0.002, innermostAu * 0.35),
    ),
  }

  const bodies = placed.map((planet, index) => {
    const rand = mulberry32(hashString(`${planet.name}-orbit-phase`))
    const periodDays =
      planet.orbitalPeriodDays != null && planet.orbitalPeriodDays > 0
        ? planet.orbitalPeriodDays
        : null
    const radiusEarth = planet.radiusEarth ?? 1
    return {
      planet,
      look: classifyPlanet(planet),
      orbitAu: planet.semiMajorAxisAu,
      orbitUnits: planet.semiMajorAxisAu * AU_PER_UNIT,
      radiusEarth,
      // Exaggerated draw radius (relative size follows √radius estimate), capped
      // by the gap to its neighbours so two orbits never touch on screen. Both
      // numbers are illustrative: the orbital radius stays the archive's value.
      radiusUnits: Math.min(
        clamp(
          extentAu * 0.04 * Math.sqrt(Math.max(0.35, radiusEarth)),
          extentAu * 0.016,
          extentAu * 0.08,
        ),
        Math.max(extentAu * 0.0012, spacingFor(index) * 0.28),
      ),
      periodDays,
      angularSpeed: periodDays ? TAU / periodDays : 0,
      // Illustrative, deterministic starting phase — not an ephemeris.
      phase: rand() * TAU,
    }
  })

  return {
    name: entry.name,
    entry,
    star,
    bodies,
    uncharted,
    placedCount: placed.length,
    extentAu,
  }
}

/** Camera framing for one system, memoize per system in the view. */
export function systemFraming(system) {
  const extent = system?.extentAu ?? 1
  const smallest = system?.bodies?.length
    ? Math.min(...system.bodies.map((body) => body.radiusUnits))
    : extent * 0.02
  return {
    home: [extent * 1.55, extent * 1.05, extent * 1.95],
    target: [0, 0, 0],
    minDistance: Math.max(extent * 0.004, smallest * 2.2),
    maxDistance: extent * 14,
    near: extent * 0.004,
    far: extent * 80,
  }
}
