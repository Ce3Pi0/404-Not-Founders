// Live Flight timeline and clock helpers.
//
// The mission's durations come from `simulateMission` (constant cruise speed).
// The animation only ever produces one number — progress from 0 to 1 — and
// every clock below is derived from it, so the reference frame and the ship's
// proper time can never drift apart. The visual timeline is deliberately
// separate: whatever playback speed is chosen, the physical durations stored
// in the mission stay exactly what the Travel Planner calculated.

import { C_KM_S } from './physics'

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
