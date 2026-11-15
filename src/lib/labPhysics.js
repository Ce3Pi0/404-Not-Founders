// Relativistic flight solver for the Relativity Lab.
//
// Model
// -----
// A one-way trip between two stations A and B that share an inertial frame
// (both planets are treated as at rest relative to each other). The ship
// leaves A at rest, holds a constant proper acceleration until it reaches the
// requested cruise speed (or half the route, whichever comes first), coasts,
// then decelerates symmetrically into B.
//
// Special relativity:
//   rapidity           η = atanh β
//   coordinate time    t = sinh η / a          (a in ly/yr², c = 1 ly/yr)
//   distance           x = (cosh η − 1) / a
//   ship proper time   τ = η / a               (constant proper acceleration)
//
// General relativity (weak field, to first order):
//   a clock sitting at radius r from a mass has rate √(1 − rₛ/r) relative to
//   the far field. The ship's proper time during the departure and arrival
//   burns is integrated numerically as ∫ (1/γ) √(1 − rₛ/r(t)) dt. While in
//   deep space the potential term is taken as 1.
//
// Acceleration on its own never causes time dilation: it contributes only
// through the velocity it produces (and through the changing gravitational
// potential near a planet). G-force is reported separately.

import { C_M_S, EARTH_RADIUS_M, clamp, surfaceClockRate } from './physics'

export const G0 = 9.80665
export const YEAR_S = 31557600
export const LY_M = 9.4607304725808e15

/** 1 g expressed in ly/yr², the unit system used by the solver. */
export const ACCEL_LY_PER_G = (G0 * YEAR_S * YEAR_S) / LY_M
export const MAX_BETA = 0.9999
export const MIN_BETA = 0.05
const GRAV_SAMPLES = 128

export const accelMsFromG = (g) => g * G0
export const accelLyFromG = (g) => g * ACCEL_LY_PER_G

/** Surface clock rate and geometry for a planet (nulls default to Earth). */
export function planetFrame(planet) {
  const radiusEarth = planet?.radiusEarth ?? 1
  const massEarth = planet?.massEarth ?? 1
  const radiusM = radiusEarth * EARTH_RADIUS_M
  const clockRate = surfaceClockRate(massEarth, radiusEarth) ?? 1
  return {
    radiusM,
    clockRate,
    rsM: Math.max(0, 1 - clockRate * clockRate) * radiusM,
    surfaceG: massEarth / (radiusEarth * radiusEarth),
  }
}

function phaseProfile(distanceLy, a, betaTarget) {
  const beta = clamp(betaTarget, 1e-3, MAX_BETA)
  const etaTarget = Math.atanh(beta)
  const distanceToTarget = (Math.cosh(etaTarget) - 1) / a
  const capped = 2 * distanceToTarget > distanceLy
  const etaPeak = capped ? Math.acosh(1 + (a * distanceLy) / 2) : etaTarget
  const s1 = (Math.cosh(etaPeak) - 1) / a
  const t1 = Math.sinh(etaPeak) / a
  const betaPeak = Math.tanh(etaPeak)
  const cruiseDistance = Math.max(0, distanceLy - 2 * s1)
  return {
    capped,
    betaPeak,
    etaPeak,
    gammaPeak: Math.cosh(etaPeak),
    t1,
    s1,
    cruiseDistance,
    cruiseTime: cruiseDistance / betaPeak,
  }
}

/** Total coordinate-frame duration for a requested cruise speed. */
export function durationForBeta(distanceLy, accelG, betaTarget) {
  const D = clamp(distanceLy, 0.05, 1e6)
  const a = accelLyFromG(clamp(accelG, 0.05, 20))
  const phase = phaseProfile(D, a, betaTarget)
  return 2 * phase.t1 + phase.cruiseTime
}

/** Achievable coordinate-time range for a route at a given acceleration. */
export function durationBounds(distanceLy, accelG) {
  const D = clamp(distanceLy, 0.05, 1e6)
  const a = accelLyFromG(clamp(accelG, 0.05, 20))
  let min = Infinity
  let optimumBeta = 0.9
  const steps = 400
  for (let i = 0; i <= steps; i += 1) {
    const beta = MIN_BETA + ((MAX_BETA - MIN_BETA) * i) / steps
    const T = durationForBeta(D, accelG, beta)
    if (T < min) {
      min = T
      optimumBeta = beta
    }
  }
  const max = durationForBeta(D, accelG, MIN_BETA)
  return { min, max, optimumBeta: optimumBeta, accelLy: a }
}

/** Cruise speed that completes the route in a requested coordinate duration. */
export function betaForDuration(distanceLy, accelG, durationYears) {
  const bounds = durationBounds(distanceLy, accelG)
  if (!(durationYears > bounds.min)) return clamp(bounds.optimumBeta, MIN_BETA, MAX_BETA)
  if (durationYears >= bounds.max) return MIN_BETA
  let lo = MIN_BETA
  let hi = bounds.optimumBeta
  for (let i = 0; i < 70; i += 1) {
    const mid = (lo + hi) / 2
    if (durationForBeta(distanceLy, accelG, mid) > durationYears) lo = mid
    else hi = mid
  }
  return clamp((lo + hi) / 2, MIN_BETA, MAX_BETA)
}

function gravitationalTauTable(phaseT, a, s1, distanceLy, frame, mode) {
  const table = new Float64Array(GRAV_SAMPLES + 1)
  if (phaseT <= 0) return table
  const dt = phaseT / GRAV_SAMPLES
  let tau = 0
  for (let i = 1; i <= GRAV_SAMPLES; i += 1) {
    const tMid = (i - 0.5) * dt
    let gamma
    let radiusM
    if (mode === 'depart') {
      const A = a * tMid
      gamma = Math.sqrt(1 + A * A)
      const travelled = (gamma - 1) / a
      radiusM = frame.radiusM + travelled * LY_M
    } else {
      // Mirror the burn: w is the coordinate time left before docking.
      const w = phaseT - tMid
      const A = a * w
      gamma = Math.sqrt(1 + A * A)
      const remaining = (gamma - 1) / a
      radiusM = frame.radiusM + remaining * LY_M
    }
    const potential = Math.sqrt(Math.max(0, 1 - frame.rsM / radiusM))
    tau += (dt / gamma) * potential
    table[i] = tau
  }
  return table
}

function sampleTable(table, phaseT, t) {
  if (phaseT <= 0) return 0
  const pos = clamp(t / phaseT, 0, 1) * (table.length - 1)
  const index = Math.min(table.length - 2, Math.floor(pos))
  const frac = pos - index
  return table[index] * (1 - frac) + table[index + 1] * frac
}

/**
 * Full flight profile. All the expensive work happens here; telemetry lookups
 * are cheap enough to run every animation frame.
 */
export function solveVoyage({ distanceLy, beta, accelG, startPlanet, endPlanet }) {
  const D = clamp(distanceLy, 0.05, 1e6)
  const gammaAccel = clamp(accelG, 0.05, 20)
  const a = accelLyFromG(gammaAccel)
  const phase = phaseProfile(D, a, beta)
  const duration = 2 * phase.t1 + phase.cruiseTime
  const startFrame = planetFrame(startPlanet)
  const endFrame = planetFrame(endPlanet)

  const accelTable = gravitationalTauTable(phase.t1, a, phase.s1, D, startFrame, 'depart')
  const decelTable = gravitationalTauTable(phase.t1, a, phase.s1, D, endFrame, 'arrive')
  const tauAccel = accelTable[accelTable.length - 1]
  const tauDecel = decelTable[decelTable.length - 1]
  const cruiseProper = phase.cruiseTime / phase.gammaPeak
  const shipProper = tauAccel + cruiseProper + tauDecel
  const avgG = duration > 0 ? (2 * phase.t1 * gammaAccel) / duration : 0

  return {
    distanceLy: D,
    accelG: gammaAccel,
    accelMs: accelMsFromG(gammaAccel),
    accelLy: a,
    targetBeta: beta,
    betaPeak: phase.betaPeak,
    gammaPeak: phase.gammaPeak,
    capped: phase.capped,
    duration,
    tAccel: phase.t1,
    tCruise: phase.cruiseTime,
    tDecel: phase.t1,
    sAccel: phase.s1,
    sCruise: phase.cruiseDistance,
    tauAccel,
    tauDecel,
    cruiseProper,
    shipProper,
    avgG,
    startFrame,
    endFrame,
    accelTable,
    decelTable,
  }
}

export function telemetryAt(voyage, missionTime) {
  const duration = voyage.duration
  const t = clamp(missionTime, 0, duration)
  const a = voyage.accelLy
  let phase
  let beta
  let gamma
  let distanceLy
  let accelerationG
  let shipClockYears

  if (t <= voyage.tAccel) {
    phase = 'departure burn'
    const A = a * t
    gamma = Math.sqrt(1 + A * A)
    beta = A / gamma
    distanceLy = (gamma - 1) / a
    accelerationG = voyage.accelG
    shipClockYears = sampleTable(voyage.accelTable, voyage.tAccel, t)
  } else if (t <= voyage.tAccel + voyage.tCruise) {
    phase = 'cruise'
    const dt = t - voyage.tAccel
    gamma = voyage.gammaPeak
    beta = voyage.betaPeak
    distanceLy = voyage.sAccel + beta * dt
    accelerationG = 0
    shipClockYears = voyage.tauAccel + dt / voyage.gammaPeak
  } else {
    phase = 'arrival burn'
    const u = Math.min(voyage.tDecel, t - voyage.tAccel - voyage.tCruise)
    const w = Math.max(0, voyage.tDecel - u)
    const A = a * w
    gamma = Math.sqrt(1 + A * A)
    beta = A / gamma
    distanceLy = voyage.distanceLy - (gamma - 1) / a
    accelerationG = -voyage.accelG
    shipClockYears = voyage.tauAccel + voyage.cruiseProper + sampleTable(voyage.decelTable, voyage.tDecel, u)
  }

  const remainingLy = Math.max(0, voyage.distanceLy - distanceLy)
  const aClockYears = t * voyage.startFrame.clockRate
  const bClockYears = t * voyage.endFrame.clockRate
  const divergenceYears = aClockYears - shipClockYears
  const abGapYears = aClockYears - bClockYears
  const dopplerA = beta > 0 ? Math.sqrt((1 - beta) / (1 + beta)) : 1
  const dopplerB = beta > 0 ? Math.sqrt((1 + beta) / (1 - beta)) : 1

  return {
    t,
    duration,
    progress: duration > 0 ? t / duration : 0,
    phase,
    beta,
    gamma,
    velocityMs: beta * C_M_S,
    percentC: beta * 100,
    accelerationMs: accelerationG * G0,
    gForce: Math.abs(accelerationG),
    signedG: accelerationG,
    distanceLy,
    remainingLy,
    fraction: voyage.distanceLy > 0 ? distanceLy / voyage.distanceLy : 0,
    shipClockYears,
    aClockYears,
    bClockYears,
    divergenceYears,
    abGapYears,
    dopplerA,
    dopplerB,
    lightLagA: distanceLy,
    lightLagB: remainingLy,
    cumulativeFactor: shipClockYears > 0 ? aClockYears / shipClockYears : 1,
  }
}

/* ---------------------------------------------------------------- format -- */

const pad = (value) => String(value).padStart(2, '0')

/** Digital mission clock: years, days and a HH:MM:SS sub-day counter. */
export function clockParts(years) {
  const totalDays = Math.max(0, years) * 365.25
  const wholeDays = Math.floor(totalDays)
  let yearsPart = Math.floor(wholeDays / 365.25)
  let dayPart = Math.floor(wholeDays - yearsPart * 365.25)
  if (dayPart < 0) dayPart = 0
  let seconds = Math.floor((totalDays - wholeDays) * 86400)
  if (seconds >= 86400) seconds = 86399
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (dayPart >= 365) {
    yearsPart += 1
    dayPart = 0
  }
  return { years: yearsPart, days: dayPart, hms: `${pad(h)}:${pad(m)}:${pad(s)}` }
}

/** Interval display that stays readable from microseconds to years. */
export function formatGap(years) {
  const seconds = Math.abs(years) * YEAR_S
  if (!Number.isFinite(seconds)) return '—'
  if (seconds === 0) return '0 s'
  if (seconds < 1e-3) return `${(seconds * 1e6).toPrecision(4)} µs`
  if (seconds < 60) return `${seconds.toPrecision(4)} s`
  if (seconds < 86400) return `${(seconds / 3600).toPrecision(4)} h`
  if (seconds < 365.25 * 86400) return `${(seconds / 86400).toPrecision(4)} d`
  return `${(seconds / YEAR_S).toPrecision(4)} yr`
}

export function formatDistanceKm(ly) {
  const km = ly * (LY_M / 1000)
  if (!Number.isFinite(km)) return '—'
  if (km < 1e6) return `${Math.round(km).toLocaleString('en-US')} km`
  return `${km.toExponential(3)} km`
}

export function formatPercentC(percent) {
  if (!Number.isFinite(percent)) return '—'
  return `${percent.toFixed(percent > 99 ? 4 : 2)} %`
}

export function formatRate(rate) {
  // Gravitational clock rate, shown as 1 − (1 − rate) to keep the tiny deficit visible.
  const deficit = 1 - rate
  if (deficit === 0) return '1'
  if (deficit < 1e-9) return `1 − ${(deficit * 1e9).toFixed(2)} ppb`
  return `1 − ${(deficit * 1e6).toFixed(3)} ppm`
}
