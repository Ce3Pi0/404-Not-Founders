// Relativistic propulsion-energy and time-dilation model for the
// Expedition Challenge.
//
// Units and conventions
//  · c = 1 light-year per year, so a leg of D light-years at beta·c lasts
//    D / beta years on Earth's clock.
//  · Energy is normalised to the spacecraft's rest energy m·c². The ship's
//    mass is constant; this is an idealised propulsion-energy budget, not a
//    claim about fuel mass.
//  · Every formula below is the single implementation used by both the
//    planner and the live simulation.

export const G = 6.6743e-11
export const C_M_S = 299792458
export const C_KM_S = 299792.458
export const EARTH_MASS_KG = 5.9722e24
export const EARTH_RADIUS_M = 6371000
export const DAYS_PER_YEAR = 365.25

/** Cruise speeds the challenge allows, as a fraction of light speed. */
export const BETA_MIN = 0.1
export const BETA_MAX = 0.99

/** A local survey of one planet: Earth and ship clocks both advance 0.25 yr. */
export const SURVEY_YEARS = 0.25

/** Floating-point tolerance for "energy is exactly exhausted". */
export const ENERGY_EPS = 1e-12
/** Floating-point tolerance for clock comparisons, in years. */
export const TIME_EPS = 1e-9

const DEG = Math.PI / 180

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/** Clamp a user slider value into the challenge's cruise-speed window. */
export function clampBeta(beta) {
  return clamp(Number(beta), BETA_MIN, BETA_MAX)
}

/** Lorentz factor γ = 1 / √(1 − β²). Throws outside 0 < β < 1. */
export function lorentzFactor(beta) {
  if (!(beta > 0) || !(beta < 1)) {
    throw new Error('Velocity must satisfy 0 < beta < 1')
  }
  return 1 / Math.sqrt(1 - beta * beta)
}

/** Ideal normalised kinetic energy to reach β from rest: γ − 1. */
export function accelerationEnergy(beta) {
  return lorentzFactor(beta) - 1
}

/**
 * Gameplay convention: braking costs the same normalised energy as
 * acceleration, with no regenerative recovery. This is a deliberate rule of
 * the fictional propulsion system, not a claim about real spacecraft.
 */
export function brakingEnergy(beta) {
  return lorentzFactor(beta) - 1
}

/** Acceleration + braking on one journey. Not a round trip. */
export function propulsionEnergy(beta) {
  return accelerationEnergy(beta) + brakingEnergy(beta)
}

/**
 * Ideal Newtonian escape energy normalised by the ship's rest energy:
 * G·M / (R·c²). Ignores atmospheres, orbital insertion, ascent profiles and
 * relativistic gravity.
 */
export function gravityEscapeEnergy(massEarth, radiusEarth) {
  if (!(massEarth > 0) || !(radiusEarth > 0)) {
    throw new Error('Invalid planet mass or radius')
  }
  return (G * (massEarth * EARTH_MASS_KG)) / ((radiusEarth * EARTH_RADIUS_M) * C_M_S * C_M_S)
}

/** Constant-speed leg durations, in years, in both frames. */
export function legTravelTimes(distanceLY, beta) {
  const gamma = lorentzFactor(beta)
  return {
    gamma,
    earthYears: distanceLY / beta,
    shipYears: distanceLY / (beta * gamma),
    driftYears: distanceLY / beta - distanceLY / (beta * gamma),
  }
}

/** Equatorial unit vector for a catalogue RA/Dec pair, in degrees. */
export function equatorialDirection(raDeg, decDeg) {
  const ra = raDeg * DEG
  const dec = decDeg * DEG
  return [Math.cos(dec) * Math.cos(ra), Math.sin(dec), Math.cos(dec) * Math.sin(ra)]
}

/* ------------------------------------------------------------- formatting -- */

/** Budget-scale energy, fixed precision as shown in the HUD. */
export function formatEnergyUnits(value, digits = 3) {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/**
 * Small gravitational costs stay in scientific notation — never rounded to
 * zero and never silently scaled up.
 */
export function formatSmallEnergy(value, digits = 2) {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  if (Math.abs(value) < 1e-4) return value.toExponential(digits)
  if (Math.abs(value) < 0.01) return value.toFixed(6)
  return value.toFixed(3)
}

/** mc² suffix for the energy pool. */
export function formatEnergy(value, { digits = 3, small = false } = {}) {
  if (!Number.isFinite(value)) return '—'
  const body = small ? formatSmallEnergy(value) : formatEnergyUnits(value, digits)
  return `${body} mc²`
}

/** Years with useful precision for both tiny and enormous clocks. */
export function formatChallengeYears(years) {
  if (!Number.isFinite(years)) return '—'
  if (years === 0) return '0 yr'
  if (Math.abs(years) < 0.01) return `${(years * DAYS_PER_YEAR).toFixed(2)} days`
  if (Math.abs(years) < 1) return `${years.toFixed(3)} yr`
  if (Math.abs(years) < 1000) return `${years.toFixed(2)} yr`
  return `${Math.round(years).toLocaleString('en-US')} yr`
}

/* --------------------------------------------------------- planet profile -- */

/**
 * What a departure from this body means physically.
 *
 * A surface departure needs a measured mass *and* radius from the archive and
 * a rocky body (≤ 2.5 R⊕). Earth uses the IAU/NASA reference constants.
 * Everything else — a gas giant, an unmeasured radius, a minimum-mass-only
 * world — departs from orbit, so no surface escape energy is charged and none
 * is invented.
 */
export function departureProfile(planet) {
  if (!planet) {
    return { surface: false, cost: null, reason: 'No departure body' }
  }
  if (planet.kind === 'earth') {
    return {
      surface: true,
      massEarth: 1,
      radiusEarth: 1,
      massSource: 'Earth reference constants',
      massIsMinimum: false,
      cost: gravityEscapeEnergy(1, 1),
      reason: 'Surface launch from Earth',
    }
  }

  const massEarth = planet.massEarthMeasured
  const radiusEarth = planet.radiusEarthMeasured
  const source = planet.massSource ?? null

  if (!(massEarth > 0) || !(radiusEarth > 0)) {
    return {
      surface: false,
      massEarth: massEarth ?? null,
      radiusEarth: radiusEarth ?? null,
      massSource: source,
      massIsMinimum: Boolean(planet.massIsMinimum),
      cost: null,
      reason: 'No measured mass and radius — orbital survey and orbital departure',
    }
  }
  if (radiusEarth > 2.5) {
    return {
      surface: false,
      massEarth,
      radiusEarth,
      massSource: source,
      massIsMinimum: Boolean(planet.massIsMinimum),
      cost: null,
      reason: 'Gas or ice giant — no modelled solid surface, orbital departure',
    }
  }

  return {
    surface: true,
    massEarth,
    radiusEarth,
    massSource: source,
    massIsMinimum: Boolean(planet.massIsMinimum),
    cost: gravityEscapeEnergy(massEarth, radiusEarth),
    reason: 'Surface launch from the archived mass and radius',
  }
}
