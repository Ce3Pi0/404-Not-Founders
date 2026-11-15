// Interactive launch simulation for the Relativity Lab.
//
// Units: metres and seconds. Coordinate time t runs in the shared rest frame
// of the two stations (their mutual motion is ignored). The ship carries its
// own proper clock τ.
//
// Model — every simplification below is labelled in the UI:
//  * Ascent is Newtonian: thrust acceleration minus the launch planet's
//    gravity, climbing at the launch angle through a 100 km atmosphere.
//  * After the atmosphere the ship accelerates along the route with a constant
//    proper acceleration until it reaches the target speed, coasts, and (with
//    auto-brake on) flips to decelerate on approach.
//  * Velocity is integrated in rapidity space, which is exact for a constant
//    proper acceleration over a step:
//        η₁ = asinh(sinh η₀ + a·dt/c),  β = tanh η,  τ = (c/a)(η₁ − η₀)
//  * Proper time picks up the weak field factor √(1 − rₛ/r) of the launch
//    planet while the ship is in its potential well; deep space uses 1. The
//    destination's well is not modelled.
//  * G-force is proper acceleration ÷ g₀ and never enters the time-dilation
//    integral on its own.
//  * Fuel burns at thrust/c (photon drive, Isp = c/g₀) and the ship's mass is
//    held fixed, so the step response of the engine is idealised.

import { C_M_S, clamp } from './physics'
import { G0, LY_M, YEAR_S, planetFrame } from './labPhysics'
import { LAB_DEFAULT_END, LAB_DEFAULT_START, labPlanetById, routeDistanceLy } from './labCatalog'

export const ATMOSPHERE_M = 100_000
export const ISP_S = C_M_S / G0
export const ASCENT_RATE = 45 // coordinate seconds per second of playback
const SPACE_PLAYBACK_S = 26 // playback seconds for the whole space leg at 1×
const IGNITION_S = 1.8
const EXIT_S = 2.2
const TRANSIT_S = 2
const ARRIVAL_S = 2.4

export const PLAYBACK_SPEEDS = [
  { value: 0.25, label: '0.25×', blurb: 'slow motion' },
  { value: 0.5, label: '0.5×', blurb: 'slow motion' },
  { value: 1, label: '1×', blurb: 'real time' },
  { value: 2, label: '2×', blurb: 'accelerated' },
  { value: 4, label: '4×', blurb: 'accelerated' },
]

export const LIMITS = {
  massKg: { min: 100_000, max: 2_000_000, step: 25_000 },
  thrustN: { min: 1_000_000, max: 24_000_000, step: 250_000 },
  fuelKg: { min: 50_000, max: 10_000_000, step: 50_000 },
  accelMs: { min: 1, max: 30, step: 0.1 },
  initialVelocityMs: { min: 0, max: 0.02 * C_M_S, step: 500 },
  maxVelocityC: { min: 0.05, max: 0.995, step: 0.005 },
  launchAngleDeg: { min: 45, max: 90, step: 1 },
  azimuthDeg: { min: 0, max: 360, step: 5 },
  missionYears: { min: 1, max: 40, step: 0.5 },
  countdownSeconds: { min: 0, max: 20, step: 1 },
  customDistanceLy: { min: 0.1, max: 100, step: 0.1 },
}

export const DEFAULT_LAUNCH_CONFIG = {
  startId: LAB_DEFAULT_START,
  endId: LAB_DEFAULT_END,
  customDestination: false,
  customDistanceLy: 2,
  massKg: 500_000,
  thrustN: 8_000_000,
  fuelKg: 1_500_000,
  accelMs: 14,
  initialVelocityMs: 0,
  maxVelocityC: 0.62,
  launchAngleDeg: 90,
  azimuthDeg: 30,
  missionYears: 12,
  countdownSeconds: 8,
  autoBrake: true,
}

/** A free-standing target used when the destination is a custom distance. */
export const CUSTOM_WORLD = {
  id: 'custom-waypoint',
  name: 'Custom waypoint',
  distanceLy: 0,
  radiusEarth: 1,
  massEarth: 1,
  starTeffK: 5600,
  isCustom: true,
}

export const LAUNCH_STAGES = [
  { id: 'prep', label: 'Pre-launch' },
  { id: 'countdown', label: 'Countdown' },
  { id: 'ignition', label: 'Ignition' },
  { id: 'liftoff', label: 'Liftoff' },
  { id: 'ascent', label: 'Ascent' },
  { id: 'exit', label: 'Atmosphere exit' },
  { id: 'space', label: 'Into space' },
  { id: 'accel', label: 'Acceleration' },
  { id: 'cruise', label: 'Cruise' },
  { id: 'arrival', label: 'Arrival' },
]

/** Everything the simulation needs about the chosen route. */
export function routeFor(config) {
  const startPlanet = labPlanetById(config.startId)
  const endPlanet = config.customDestination ? CUSTOM_WORLD : labPlanetById(config.endId)
  const distanceLy = config.customDestination
    ? clamp(config.customDistanceLy, LIMITS.customDistanceLy.min, LIMITS.customDistanceLy.max)
    : routeDistanceLy(startPlanet, endPlanet)
  return {
    startPlanet,
    endPlanet,
    distanceLy,
    startFrame: planetFrame(startPlanet),
    endFrame: planetFrame(endPlanet),
  }
}

/** Thrust acceleration the engine can actually deliver for this craft. */
export function engineAccel(config) {
  const mass = Math.max(1000, config.massKg)
  return Math.min(config.accelMs, config.thrustN / mass)
}

/** Local gravity in m/s² at a distance from the planet's centre. */
export function localGravity(frame, radiusM) {
  const r = Math.max(frame.radiusM * 0.2, radiusM)
  return G0 * frame.surfaceG * (frame.radiusM / r) ** 2
}

/** Seconds of full-thrust burn the loaded propellant allows. */
export function burnSeconds(config) {
  const flow = config.thrustN / C_M_S
  return flow > 0 ? config.fuelKg / flow : 0
}

export function planningSummary(config, route) {
  const accel = engineAccel(config)
  const surfaceGravity = localGravity(route.startFrame, route.startFrame.radiusM)
  return {
    accel,
    thrustAccelCap: config.thrustN / Math.max(1000, config.massKg),
    thrustLimited: config.thrustN / Math.max(1000, config.massKg) < config.accelMs,
    surfaceGravity,
    liftoffMargin: surfaceGravity > 0 ? accel / surfaceGravity : Infinity,
    burnYears: burnSeconds(config) / YEAR_S,
    routeLy: route.distanceLy,
    missionSeconds: config.missionYears * YEAR_S,
  }
}

export function createLaunchState(config, route) {
  return {
    phase: 'prelaunch',
    phaseClock: 0,
    countdown: config.countdownSeconds,
    countdownTotal: Math.max(1, config.countdownSeconds),
    t: 0,
    v: Math.max(0, config.initialVelocityMs),
    s: 0,
    altitude: 0,
    tau: 0,
    fuelKg: config.fuelKg,
    maxG: 0,
    gForce: 1,
    accel: 0,
    thrustN: 0,
    engines: true,
    accelerating: false,
    braking: false,
    status: 'ready',
    endReason: null,
    notice: null,
    routeM: route.distanceLy * LY_M,
  }
}

export function startLaunchState(config, route) {
  return {
    ...createLaunchState(config, route),
    phase: config.countdownSeconds > 0 ? 'countdown' : 'ignition',
    phaseClock: IGNITION_S,
    status: 'running',
  }
}

export function stageIndex(state) {
  switch (state.phase) {
    case 'countdown':
      return 1
    case 'ignition':
    case 'holding':
      return 2
    case 'ascent':
      return state.altitude < 800 ? 3 : 4
    case 'exit':
      return 5
    case 'transit':
      return 6
    case 'space':
      return state.accelerating ? 7 : 8
    case 'arrival':
      return 9
    case 'complete':
      return state.endReason === 'arrived' ? 9 : 8
    default:
      return 0
  }
}

export function phaseLabel(state) {
  switch (state.phase) {
    case 'countdown':
      return 'Countdown'
    case 'ignition':
      return 'Engine ignition'
    case 'holding':
      return 'Thrust below local gravity'
    case 'ascent':
      return state.altitude < 800 ? 'Liftoff' : 'Atmospheric ascent'
    case 'exit':
      return 'Atmospheric exit'
    case 'transit':
      return 'Transition to space'
    case 'space':
      if (state.braking) return 'Arrival burn'
      return state.accelerating ? 'Acceleration' : 'Cruise'
    case 'arrival':
      return 'Arrival'
    case 'complete':
      return state.endReason === 'arrived' ? 'Mission complete' : 'Mission window ended'
    default:
      return 'Pre-launch'
  }
}

export function missionProgress(state) {
  const fraction = state.routeM > 0 ? clamp(state.s / state.routeM, 0, 1) : 0
  switch (state.phase) {
    case 'prelaunch':
      return 0
    case 'countdown':
      return 0.02 * (1 - state.countdown / state.countdownTotal)
    case 'ignition':
    case 'holding':
      return 0.03
    case 'ascent':
      return 0.05 + 0.06 * clamp(state.altitude / ATMOSPHERE_M, 0, 1)
    case 'exit':
      return 0.12
    case 'transit':
      return 0.14
    case 'arrival':
      return 1
    case 'complete':
      // A run that stops at the mission window has not arrived.
      return state.endReason === 'arrived' ? 1 : 0.16 + 0.84 * fraction
    default:
      return 0.16 + 0.84 * fraction
  }
}

/** Gravitational clock factor at the ship's current radius (deep space ≈ 1). */
function gravitationalFactor(frame, altitudeM) {
  const r = frame.radiusM + Math.max(0, altitudeM)
  return Math.sqrt(Math.max(0, 1 - frame.rsM / r))
}

/**
 * Advance the ship through the space leg. Mutates `draft`.
 * `dtSim` is coordinate seconds; large frames are split into substeps.
 */
function advanceSpace(draft, config, route, dtSim) {
  const targetV = clamp(config.maxVelocityC, LIMITS.maxVelocityC.min, LIMITS.maxVelocityC.max) * C_M_S
  const accel = engineAccel(config)
  const missionSeconds = config.missionYears * YEAR_S
  // Small substeps keep the arrival-burn decision and the proper-time integral
  // accurate even when a long frame advances a big slice of the mission.
  const maxStep = Math.max(30, missionSeconds / 3000)
  const steps = clamp(Math.ceil(dtSim / maxStep), 1, 400)
  const dt = dtSim / steps

  for (let i = 0; i < steps; i += 1) {
    const thrustOn = draft.engines && draft.fuelKg > 0 && accel > 0
    const remainingLy = route.distanceLy - draft.s / LY_M
    const beta0 = clamp(draft.v / C_M_S, 0, 0.9999999)
    const eta0 = Math.atanh(beta0)

    if (!thrustOn) draft.braking = false

    // Plan the arrival burn once the stopping distance covers what is left.
    if (config.autoBrake && thrustOn && !draft.braking) {
      const stopLy = ((C_M_S * C_M_S) / accel) * (Math.cosh(eta0) - 1) / LY_M
      if (remainingLy <= stopLy) draft.braking = true
    }

    let alpha = 0
    if (thrustOn) {
      if (draft.braking && eta0 > 1e-6) alpha = -accel
      else {
        // Arrived at rest inside the arrival burn: release the brake.
        if (draft.braking) draft.braking = false
        if (draft.v < targetV * 0.9999) alpha = accel
      }
    }
    // The engine is throttled back to zero whenever no acceleration is needed,
    // so cruising at the target speed costs no fuel and feels weightless.
    const firing = thrustOn && alpha !== 0

    let eta1 = eta0
    let ds = draft.v * dt
    let dTau = dt / Math.cosh(eta0)

    if (alpha !== 0) {
      const rapidity = Math.sinh(eta0) + (alpha * dt) / C_M_S
      eta1 = Math.asinh(alpha > 0 ? rapidity : Math.max(0, rapidity))
      ds = ((C_M_S * C_M_S) / alpha) * (Math.cosh(eta1) - Math.cosh(eta0))
      dTau = (C_M_S / alpha) * (eta1 - eta0)
    }

    draft.v = clamp(Math.tanh(eta1) * C_M_S, 0, 0.9999999 * C_M_S)
    draft.s += ds
    draft.t += dt
    draft.altitude += ds * Math.sin((config.launchAngleDeg * Math.PI) / 180)
    draft.tau += dTau

    if (firing) {
      draft.thrustN = config.thrustN
      draft.fuelKg = Math.max(0, draft.fuelKg - (config.thrustN / C_M_S) * dt)
      draft.accel = alpha
      draft.gForce = accel / G0
      draft.accelerating = alpha > 0
      draft.maxG = Math.max(draft.maxG, draft.gForce)
      if (draft.fuelKg <= 0 && draft.engines) {
        draft.engines = false
        draft.notice =
          'Propellant exhausted — the engines shut down and the ship now coasts. Raise the fuel load or lower the thrust for a longer burn.'
      }
    } else {
      draft.thrustN = 0
      draft.accel = 0
      draft.gForce = 0
      draft.accelerating = false
      if (!thrustOn) draft.braking = false
    }

    const remaining = route.distanceLy - draft.s / LY_M
    if (remaining <= Math.max(1e-6, route.distanceLy * 1e-4)) {
      draft.s = route.distanceLy * LY_M
      draft.phase = 'arrival'
      draft.phaseClock = ARRIVAL_S
      draft.braking = false
      draft.accelerating = false
      draft.thrustN = 0
      draft.accel = 0
      draft.gForce = 0
      break
    }
    if (draft.t >= config.missionYears * YEAR_S) {
      draft.phase = 'complete'
      draft.endReason = 'window'
      draft.thrustN = 0
      draft.accel = 0
      draft.gForce = 0
      draft.accelerating = false
      break
    }
  }
}

/**
 * Advance the launch by `dtWall` seconds of wall time at `speed`× playback.
 * Pure: returns a new state object.
 */
export function advanceLaunch(state, config, route, dtWall, speed) {
  if (state.phase === 'prelaunch' || state.phase === 'complete') return state
  const dtPlayback = Math.min(0.25, Math.max(0, dtWall)) * Math.max(0.05, speed)
  if (dtPlayback <= 0) return state

  const draft = { ...state }
  const frame = route.startFrame
  const angle = (config.launchAngleDeg * Math.PI) / 180
  const climbRate = Math.sin(angle)
  const accel = engineAccel(config)
  const surfaceGravity = localGravity(frame, frame.radiusM)

  if (draft.phase === 'countdown') {
    draft.countdown = Math.max(0, draft.countdown - dtPlayback)
    draft.gForce = surfaceGravity / G0
    draft.thrustN = 0
    draft.accel = 0
    if (draft.countdown <= 0) {
      draft.phase = 'ignition'
      draft.phaseClock = IGNITION_S
    }
    return draft
  }

  if (draft.phase === 'ignition') {
    draft.phaseClock -= dtPlayback
    const ramp = clamp(1 - draft.phaseClock / IGNITION_S, 0, 1)
    draft.thrustN = accel * config.massKg * ramp
    draft.accel = 0
    draft.gForce = (surfaceGravity + accel * ramp) / G0
    draft.maxG = Math.max(draft.maxG, draft.gForce)
    if (draft.phaseClock <= 0) {
      if (accel <= surfaceGravity) {
        draft.phase = 'holding'
        draft.notice = `Thrust acceleration ${accel.toFixed(1)} m/s² is below ${route.startPlanet.name}'s surface gravity (${surfaceGravity.toFixed(1)} m/s²), so the craft cannot lift off. Raise thrust, cut the mass, or launch from a lighter world.`
      } else {
        draft.phase = 'ascent'
        draft.phaseClock = 0
      }
    }
    return draft
  }

  if (draft.phase === 'holding') {
    draft.thrustN = accel * config.massKg
    draft.gForce = (surfaceGravity + accel) / G0
    draft.accel = 0
    if (accel > surfaceGravity && draft.engines && draft.fuelKg > 0) {
      draft.phase = 'ascent'
      draft.notice = null
    }
    return draft
  }

  if (draft.phase === 'ascent') {
    const dtSim = dtPlayback * ASCENT_RATE
    const steps = clamp(Math.ceil(dtSim / 2), 1, 24)
    const dt = dtSim / steps
    for (let i = 0; i < steps; i += 1) {
      const gravity = localGravity(frame, frame.radiusM + draft.altitude)
      const thrustOn = draft.engines && draft.fuelKg > 0 && accel > 0
      const aNet = (thrustOn ? accel : 0) - gravity * climbRate
      const v0 = draft.v
      draft.v = Math.max(0, v0 + aNet * dt)
      const ds = ((v0 + draft.v) / 2) * dt
      draft.s += ds
      draft.altitude += ds * climbRate
      const beta = clamp(draft.v / C_M_S, 0, 0.999999)
      draft.tau += (dt / Math.sqrt(1 - beta * beta)) * gravitationalFactor(frame, draft.altitude)
      draft.t += dt
      draft.gForce = ((thrustOn ? accel : 0) + gravity) / G0
      draft.accel = aNet
      draft.thrustN = thrustOn ? config.thrustN : 0
      draft.accelerating = aNet > 0
      draft.maxG = Math.max(draft.maxG, draft.gForce)
      if (thrustOn) draft.fuelKg = Math.max(0, draft.fuelKg - (config.thrustN / C_M_S) * dt)
      if (draft.altitude >= ATMOSPHERE_M) {
        draft.altitude = ATMOSPHERE_M
        draft.phase = 'exit'
        draft.phaseClock = EXIT_S
        break
      }
    }
    if (draft.fuelKg <= 0 && draft.engines) {
      draft.engines = false
      draft.notice =
        'Propellant exhausted during ascent — the engines shut down. Raise the fuel load or lower the thrust for a longer burn.'
    }
    return draft
  }

  if (draft.phase === 'exit' || draft.phase === 'transit') {
    const dtSim = dtPlayback * ((config.missionYears * YEAR_S) / SPACE_PLAYBACK_S)
    if (draft.phase === 'exit') draft.altitude = Math.max(draft.altitude, ATMOSPHERE_M)
    advanceSpace(draft, config, route, dtSim)
    if (draft.phase === 'exit' || draft.phase === 'transit') {
      draft.phaseClock -= dtPlayback
      if (draft.phaseClock <= 0) draft.phase = draft.phase === 'exit' ? 'transit' : 'space'
    }
    return draft
  }

  if (draft.phase === 'space') {
    const dtSim = dtPlayback * ((config.missionYears * YEAR_S) / SPACE_PLAYBACK_S)
    advanceSpace(draft, config, route, dtSim)
    return draft
  }

  if (draft.phase === 'arrival') {
    draft.phaseClock -= dtPlayback
    draft.thrustN = 0
    draft.accel = 0
    draft.gForce = 0
    if (draft.phaseClock <= 0) {
      draft.phase = 'complete'
      draft.endReason = 'arrived'
    }
    return draft
  }

  return draft
}

/** Everything the HUD, the dashboard and the scenes read each frame. */
export function launchTelemetry(state, route, config) {
  const tYears = state.t / YEAR_S
  const beta = clamp(state.v / C_M_S, 0, 0.9999999)
  const gamma = 1 / Math.sqrt(1 - beta * beta)
  const travelledLy = state.s / LY_M
  const remainingLy = Math.max(0, route.distanceLy - travelledLy)
  const aClockYears = tYears * route.startFrame.clockRate
  const bClockYears = tYears * route.endFrame.clockRate
  const shipClockYears = state.tau / YEAR_S
  const gravFactor = state.altitude < ATMOSPHERE_M * 4
    ? gravitationalFactor(route.startFrame, state.altitude)
    : 1
  const instantRate = gravFactor / gamma

  return {
    phase: state.phase,
    stage: stageIndex(state),
    stageLabel: phaseLabel(state),
    progress: missionProgress(state),
    tYears,
    beta,
    gamma,
    velocityMs: state.v,
    percentC: beta * 100,
    accelerationMs: state.accel,
    gForce: state.gForce,
    maxG: state.maxG,
    travelledLy,
    remainingLy,
    fraction: route.distanceLy > 0 ? clamp(travelledLy / route.distanceLy, 0, 1) : 0,
    altitudeM: state.altitude,
    fuelKg: state.fuelKg,
    fuelFraction: config.fuelKg > 0 ? clamp(state.fuelKg / config.fuelKg, 0, 1) : 0,
    thrustN: state.thrustN,
    engines: state.engines,
    braking: state.braking,
    accelerating: state.accelerating,
    aClockYears,
    bClockYears,
    shipClockYears,
    divergenceYears: aClockYears - shipClockYears,
    stationGapYears: aClockYears - bClockYears,
    dilationFactor: shipClockYears > 0 ? aClockYears / shipClockYears : 1,
    clockRate: instantRate,
    countdown: state.countdown,
    endReason: state.endReason,
    notice: state.notice,
  }
}
