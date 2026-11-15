// Special-relativity physics for both flight modes.
//
// Units: SI internally (metres, seconds). `c` is exact and a light-year is
// c × 365.25 days, so c = 1 ly/yr and the two unit systems always agree.
//
// Mode 1 (`simulateMission` in ./physics.js) is a constant cruise speed.
// Mode 2 lives here: a symmetric leg flown at one constant proper acceleration
// — accelerate from rest, cruise if distance allows, then brake to rest with
// the same magnitude. Rapidity, not v = a·t, is what is integrated:
//
//   v(τ) = c·tanh(aτ/c)   t(τ) = (c/a)·sinh(aτ/c)   x(τ) = (c²/a)·(cosh(aτ/c) − 1)
//
// so the velocity can never reach c and the proper-time integral is analytic.

export const C_M_S = 299792458
export const SEC_PER_YEAR = 365.25 * 86400
export const LY_M = C_M_S * SEC_PER_YEAR
export const G0 = 9.80665
export const GRAV = 6.6743e-11
export const EARTH_MASS_KG = 5.9722e24
export const EARTH_RADIUS_M = 6371000

export const BETA_MIN = 0.1
export const BETA_MAX = 0.99

/** Editable ranges for the advanced parameters. */
export const LIMITS = {
  accelMs: { min: 1, max: 30, step: 0.1 },
  dryMassT: { min: 10, max: 20000, step: 10 },
  propellantT: { min: 0, max: 20000, step: 10 },
  thrustMN: { min: 0.2, max: 300, step: 0.2 },
}

/** The reference craft from the brief: 500 t dry + 1,500 t propellant, 8 MN. */
export const DEFAULT_ADVANCED_CONFIG = {
  accelMs: 9.81,
  dryMassT: 500,
  propellantT: 1500,
  thrustMN: 8,
  departureType: 'auto',
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function gammaFor(beta) {
  const b = clamp(Number(beta) || 0, 0, 0.999999999)
  return 1 / Math.sqrt(1 - b * b)
}

export function betaForGamma(gamma) {
  if (!(gamma > 1)) return 0
  return Math.sqrt(1 - 1 / (gamma * gamma))
}

/**
 * The whole interstellar leg, in both frames.
 *
 * Case A — the target speed is reachable: accelerate, cruise, brake.
 * Case B — it is not: one symmetric accelerate/brake arc, with the physically
 * reachable peak speed γ_peak = 1 + D·a/(2c²). Cruise distance is exactly zero,
 * never negative.
 */
export function advancedJourney({ distanceLy, beta, accelMs }) {
  const distanceM = Math.max(0, Number(distanceLy) || 0) * LY_M
  const a = Math.max(0.01, Number(accelMs) || 0)
  const requestedBeta = clamp(Number(beta) || 0, BETA_MIN, BETA_MAX)
  if (!(distanceM > 0)) return null

  const requestedGamma = gammaFor(requestedBeta)
  const singleSideM = (C_M_S * C_M_S / a) * (requestedGamma - 1)
  const reachedTarget = 2 * singleSideM <= distanceM

  const gammaPeak = reachedTarget
    ? requestedGamma
    : 1 + (distanceM * a) / (2 * C_M_S * C_M_S)
  const betaPeak = reachedTarget ? requestedBeta : betaForGamma(gammaPeak)

  const accelDistanceM = (C_M_S * C_M_S / a) * (gammaPeak - 1)
  const brakeDistanceM = accelDistanceM
  const cruiseDistanceM = Math.max(0, distanceM - accelDistanceM - brakeDistanceM)

  const accelerateSeconds = (C_M_S / a) * betaPeak * gammaPeak
  const properAccelerateSeconds = (C_M_S / a) * Math.atanh(betaPeak)
  const cruiseSeconds = reachedTarget
    ? cruiseDistanceM / (betaPeak * C_M_S)
    : 0
  const properCruiseSeconds = reachedTarget ? cruiseSeconds / gammaPeak : 0

  const earthSeconds =
    accelerateSeconds + cruiseSeconds + accelerateSeconds
  const shipSeconds =
    properAccelerateSeconds + properCruiseSeconds + properAccelerateSeconds
  const earthYears = earthSeconds / SEC_PER_YEAR
  const shipYears = shipSeconds / SEC_PER_YEAR

  return {
    accelMs: a,
    distanceLy: distanceM / LY_M,
    distanceM,
    requestedBeta,
    reachedTarget,
    betaPeak,
    gammaPeak,
    accelDistanceM,
    brakeDistanceM,
    cruiseDistanceM,
    accelDistanceLy: accelDistanceM / LY_M,
    brakeDistanceLy: brakeDistanceM / LY_M,
    cruiseDistanceLy: cruiseDistanceM / LY_M,
    accelerateSeconds,
    cruiseSeconds,
    brakeSeconds: accelerateSeconds,
    properAccelerateSeconds,
    properCruiseSeconds,
    properBrakeSeconds: properAccelerateSeconds,
    earthSeconds,
    shipSeconds,
    earthYears,
    shipYears,
    driftYears: earthYears - shipYears,
    accelYears: accelerateSeconds / SEC_PER_YEAR,
    cruiseYears: cruiseSeconds / SEC_PER_YEAR,
    brakeYears: accelerateSeconds / SEC_PER_YEAR,
    shipAccelYears: properAccelerateSeconds / SEC_PER_YEAR,
    shipCruiseYears: properCruiseSeconds / SEC_PER_YEAR,
    shipBrakeYears: properAccelerateSeconds / SEC_PER_YEAR,
    // Route fractions, for the map markers and the progress bar.
    accelFraction: accelDistanceM / distanceM,
    brakeStartFraction: 1 - brakeDistanceM / distanceM,
    peakFraction: reachedTarget
      ? (accelDistanceM + cruiseDistanceM) / distanceM
      : 0.5,
  }
}

function accelStateAt(model, seconds) {
  const a = model.accelMs
  const t = clamp(seconds, 0, model.accelerateSeconds)
  const tau = (C_M_S / a) * Math.asinh((a * t) / C_M_S)
  const beta = Math.tanh((a * tau) / C_M_S)
  const distanceM = (C_M_S * C_M_S / a) * (Math.cosh((a * tau) / C_M_S) - 1)
  return { tau, beta, distanceM }
}

/**
 * One trajectory state per progress fraction: the same numbers drive the
 * animation and every clock, so no view can disagree with another.
 *
 * Progress runs through the Earth-reference clock, so the acceleration and
 * braking phases take their real share of the voyage.
 */
export function trajectoryAt(model, progress) {
  if (!model) return null
  const p = clamp(Number(progress) || 0, 0, 1)
  const earthSeconds = p * model.earthSeconds
  const base = {
    progress: p,
    earthSeconds,
    earthYears: earthSeconds / SEC_PER_YEAR,
    accelMs: model.accelMs,
    peakBeta: model.betaPeak,
    accelFraction: model.accelFraction,
    brakeStartFraction: model.brakeStartFraction,
    distanceLy: model.distanceLy,
  }

  if (p >= 1) {
    return {
      ...base,
      phase: 'arrived',
      beta: 0,
      gamma: 1,
      shipSeconds: model.shipSeconds,
      shipYears: model.shipYears,
      travelledLy: model.distanceLy,
      remainingLy: 0,
      inAcceleration: false,
      inBraking: false,
    }
  }

  const withDerived = (phase, beta, shipSeconds, travelledM) => ({
    ...base,
    phase,
    beta,
    gamma: gammaFor(Math.min(beta, 0.999999999)),
    shipSeconds,
    shipYears: shipSeconds / SEC_PER_YEAR,
    travelledLy: travelledM / LY_M,
    remainingLy: Math.max(0, model.distanceLy - travelledM / LY_M),
    inAcceleration: phase === 'acceleration',
    inBraking: phase === 'braking',
  })

  if (earthSeconds <= model.accelerateSeconds) {
    const state = accelStateAt(model, earthSeconds)
    return withDerived('acceleration', state.beta, state.tau, state.distanceM)
  }

  const cruiseEnd = model.accelerateSeconds + model.cruiseSeconds
  if (earthSeconds <= cruiseEnd) {
    const elapsed = earthSeconds - model.accelerateSeconds
    return withDerived(
      'cruise',
      model.betaPeak,
      model.properAccelerateSeconds + elapsed / model.gammaPeak,
      model.accelDistanceM + model.betaPeak * C_M_S * elapsed,
    )
  }

  // Braking mirrors acceleration: the remaining time from rest at the far end
  // gives the same speed and distance curve run backwards.
  const brakingSeconds = earthSeconds - cruiseEnd
  const fromRest = model.brakeSeconds - brakingSeconds
  const state = accelStateAt(model, fromRest)
  return withDerived(
    'braking',
    state.beta,
    model.properAccelerateSeconds +
      model.properCruiseSeconds +
      (model.properBrakeSeconds - state.tau),
    model.distanceM - state.distanceM,
  )
}

/** Normalised kinetic energy per burn, in units of the ship's rest energy. */
export function journeyEnergy(model) {
  if (!model) return { acceleration: 0, braking: 0, total: 0 }
  const perBurn = model.gammaPeak - 1
  return { acceleration: perBurn, braking: perBurn, total: perBurn * 2 }
}

/**
 * Local surface gravity in m/s², only where the archive measured both the mass
 * and the radius. Earth uses the reference constants; nothing is invented.
 */
export function surfaceGravityMs2(planet) {
  if (!planet) return null
  if (planet.kind === 'earth') {
    return (GRAV * EARTH_MASS_KG) / (EARTH_RADIUS_M * EARTH_RADIUS_M)
  }
  const massEarth = planet.massEarthMeasured
  const radiusEarth = planet.radiusEarthMeasured
  if (!(massEarth > 0) || !(radiusEarth > 0)) return null
  const massKg = massEarth * EARTH_MASS_KG
  const radiusM = radiusEarth * EARTH_RADIUS_M
  return (GRAV * massKg) / (radiusM * radiusM)
}

/** Surface departure by default on Earth and on measured, rocky worlds. */
export function defaultDepartureType(planet) {
  if (!planet) return 'orbital'
  if (planet.kind === 'earth') return 'surface'
  const massEarth = planet.massEarthMeasured
  const radiusEarth = planet.radiusEarthMeasured
  if (!(massEarth > 0) || !(radiusEarth > 0)) return 'orbital'
  return radiusEarth <= 2.5 ? 'surface' : 'orbital'
}

export function resolveDepartureType(planet, configured) {
  if (configured === 'surface' || configured === 'orbital') return configured
  return defaultDepartureType(planet)
}

const tonnes = (value) =>
  `${Math.round(value).toLocaleString('en-US')} tonnes`
const fixed = (value, digits = 2) => value.toFixed(digits)

/**
 * Thrust and liftoff feasibility. This is an engineering check on the
 * configured craft — not an expedition-budget failure and not a claim about
 * gravity during the interstellar leg.
 */
export function feasibilityFor(config, planet) {
  const dryMassT = Math.max(0, Number(config.dryMassT) || 0)
  const propellantT = Math.max(0, Number(config.propellantT) || 0)
  const totalMassT = dryMassT + propellantT
  const totalMassKg = totalMassT * 1000
  const thrustN = Math.max(0, Number(config.thrustMN) || 0) * 1e6
  const requested = Math.max(0, Number(config.accelMs) || 0)
  const departureType = resolveDepartureType(planet, config.departureType)
  const surface = departureType === 'surface'
  const gravity = surface ? surfaceGravityMs2(planet) : null
  const maxAccel = totalMassKg > 0 ? thrustN / totalMassKg : 0

  const thrustOk = requested <= maxAccel
  const liftOk = !surface || (gravity != null && requested > gravity)
  const issues = []

  if (!thrustOk) {
    issues.push({
      id: 'thrust',
      title: 'INSUFFICIENT ENGINE THRUST',
      lines: [
        `Your spacecraft's initial mass is ${tonnes(totalMassT)} and its engines produce ${fixed(
          Number(config.thrustMN) || 0,
          1,
        )} MN of thrust. Maximum initial thrust acceleration is only ${fixed(maxAccel)} m/s².`,
        surface && gravity != null
          ? `${planet?.name ?? 'The departure world'} surface gravity is approximately ${fixed(
              gravity,
            )} m/s². This spacecraft cannot lift off with the current settings.`
          : `${planet?.name ?? 'This world'} departs from orbit, but the selected acceleration still exceeds what the engines can deliver.`,
        'Increase engine thrust, reduce launch mass, or choose orbital departure.',
      ],
    })
    issues.push({
      id: 'acceleration',
      title: 'ACCELERATION SETTING NOT ACHIEVABLE',
      lines: [
        `Requested acceleration: ${fixed(requested, 1)} m/s².`,
        `Maximum engine-supported acceleration: ${fixed(maxAccel, 1)} m/s².`,
        'Reduce the acceleration set-point or increase the available thrust.',
      ],
    })
  } else if (surface && gravity != null && requested <= gravity) {
    issues.push({
      id: 'liftoff',
      title: 'SPACECRAFT CANNOT LIFT OFF',
      lines: [
        'The selected upward thrust acceleration does not exceed the planet’s local surface gravity.',
        `Local surface gravity is ${fixed(gravity)} m/s²; the selected acceleration is ${fixed(
          requested,
        )} m/s².`,
        'Choose a higher acceleration and ensure the engine can deliver it.',
      ],
    })
  }

  return {
    departureType,
    surface,
    dryMassT,
    propellantT,
    totalMassT,
    totalMassKg,
    thrustN,
    thrustMN: Number(config.thrustMN) || 0,
    requested,
    maxAccelMs2: maxAccel,
    gravityMs2: gravity,
    thrustOk,
    liftOk,
    ok: thrustOk && liftOk,
    issues,
  }
}
