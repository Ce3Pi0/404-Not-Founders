// Live Flight timeline and clock helpers.
//
// The mission's durations come from `simulateMission` (constant cruise speed).
// The animation only ever produces one number — progress from 0 to 1 — and
// every clock below is derived from it, so the reference frame and the ship's
// proper time can never drift apart. The visual timeline is deliberately
// separate: whatever playback speed is chosen, the physical durations stored
// in the mission stay exactly what the Travel Planner calculated.

import { C_KM_S } from './physics.js'
import { trajectoryAt } from './advancedSR.js'

/** Seconds of playback for a whole trip at 1× speed. */
export const FLIGHT_TIMELINE_SECONDS = 24

/** Playback multipliers for the accelerated visual timeline. */
export const PLAYBACK_RATES = [0.5, 1, 2, 4]

/**
 * Clocks and distances at a shared progress fraction.
 *
 * t_ref(p)  = p · t_ref,total      with t_ref,total = d / β
 * t_ship(p) = p · t_ship,total     with t_ship,total = t_ref,total / γ
 */
export function flightClock(mission, progress) {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
  const earthYears = p * mission.earthYears
  const shipYears = p * mission.shipYears
  const travelledLy = p * mission.distanceLy
  return {
    progress: p,
    earthYears,
    shipYears,
    driftYears: earthYears - shipYears,
    travelledLy,
    remainingLy: Math.max(0, mission.distanceLy - travelledLy),
    beta: mission.beta,
    gamma: mission.gamma,
    kmS: mission.beta * C_KM_S,
  }
}

/**
 * The clocks for the mission's own physics mode. Simple mode is the constant
 * cruise above; advanced mode asks the trajectory, so the ship's velocity,
 * Lorentz factor and proper time all change through acceleration and braking.
 */
export function missionClock(mission, progress) {
  if (mission?.mode === 'advanced' && mission.advanced) {
    const state = trajectoryAt(mission.advanced, progress)
    if (!state) return flightClock(mission, progress)
    return {
      ...state,
      driftYears: state.earthYears - state.shipYears,
      kmS: state.beta * C_KM_S,
    }
  }
  return flightClock(mission, progress)
}

/**
 * Where the ship is on the route, and which earlier position the departure
 * observer is seeing right now. Both come from the same trajectory.
 */
export function missionMotion(mission) {
  const identity = (p) => p
  if (mission?.mode !== 'advanced' || !mission.advanced) {
    return {
      positionAt: identity,
      retardedAt: (p) => retardedProgress(p, mission?.beta ?? 0),
    }
  }
  const model = mission.advanced
  const positionAt = (p) => {
    const state = trajectoryAt(model, p)
    if (!state || !(model.distanceLy > 0)) return 0
    return Math.min(1, Math.max(0, state.travelledLy / model.distanceLy))
  }
  const retardedAt = (p) => {
    const progress = Math.min(1, Math.max(0, Number(p) || 0))
    const now = trajectoryAt(model, progress)
    if (!now || !(now.earthYears > 0)) return 0
    // Light emitted at tₑ from x(tₑ) reaches the observer at tₑ + x(tₑ)/c.
    let low = 0
    let high = progress
    for (let i = 0; i < 36; i += 1) {
      const mid = (low + high) / 2
      const state = trajectoryAt(model, mid)
      if (state.earthYears + state.travelledLy < now.earthYears) low = mid
      else high = mid
    }
    return (low + high) / 2
  }
  return { positionAt, retardedAt }
}

/**
 * Fraction of the route whose light reaches the departure observer now.
 *
 * For a straight outbound leg at constant β, light emitted at reference time
 * t_e from distance β·t_e (units of c = 1 ly/yr) arrives at t_e + β·t_e. Setting
 * that equal to the observer's current time t gives
 *     t_e = t / (1 + β)      →      p_emitted = p / (1 + β).
 * This is the retarded position the observer actually sees, used only by the
 * optional delayed-signal marker.
 */
export function retardedProgress(progress, beta) {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
  return p / (1 + beta)
}

/** Years per second of playback at the chosen rate. */
export function yearsPerPlaybackSecond(mission, rate) {
  return (mission.earthYears * rate) / FLIGHT_TIMELINE_SECONDS
}
