// Authoritative Expedition Challenge simulation.
//
// One deterministic, state-driven reducer holds every resource and clock:
// the flight renderer, the survey screen and the HUD all read this state, and
// only `advanceExpedition` advances it. Costs are the pre-computed physics from
// `physics.js`/`route.js`; this module never re-derives or hardcodes them.
//
// Failure is detected *here*, during execution — never in preflight. Energy is
// deducted only as a burn runs out, and the Earth clock is checked on every
// tick, in every phase: with advanced SR the ship really does spend time
// accelerating and braking, so those phases carry their share of both clocks.
// Remaining resources are clamped at zero and the state freezes on the exact
// leg and phase where the expedition stopped.

import { ENERGY_EPS, TIME_EPS, SURVEY_YEARS } from './physics.js'

export const STATUS = {
  PLANNING: 'planning',
  ACTIVE: 'active',
  PAUSED: 'paused',
  SURVEYING: 'surveying',
  SUCCESS: 'success',
  FAILED: 'failed',
}

export const PHASE = {
  IDLE: 'idle',
  ESCAPE: 'escape',
  ACCELERATION: 'acceleration',
  CRUISE: 'cruise',
  DECELERATION: 'deceleration',
  ARRIVAL: 'arrival',
}

export const PHASE_LABEL = {
  idle: 'Pre-launch',
  escape: 'Planetary escape',
  acceleration: 'Acceleration burn',
  cruise: 'Interstellar cruise',
  deceleration: 'Deceleration burn',
  arrival: 'Arrival',
}

/** Earth's own system is home, never one of the surveyed host systems. */
export const HOME_SYSTEM = 'Solar System'

export const FAILURE_LABEL = {
  energy: 'Energy exhausted',
  time: 'Earth deadline reached',
  'no-survey': 'No survey completed',
}

/** Burn sequences are short, visible manoeuvres; cruise carries the clocks. */
export const ESCAPE_SECONDS = 1.1
export const ACCELERATION_SECONDS = 1.5
export const DECELERATION_SECONDS = 1.7

/** Cruise length scales gently with the real voyage: long hauls read longer. */
export function cruiseSecondsFor(earthYears) {
  if (!Number.isFinite(earthYears) || earthYears <= 0) return 2.2
  return Math.min(7.5, Math.max(2.2, 2.2 + earthYears * 0.06))
}

export function phaseSeconds(state, phase) {
  if (phase === PHASE.ESCAPE) return ESCAPE_SECONDS
  if (phase === PHASE.ACCELERATION) return ACCELERATION_SECONDS
  if (phase === PHASE.CRUISE) return state.cruiseSeconds ?? 2.2
  if (phase === PHASE.DECELERATION) return DECELERATION_SECONDS
  return 0
}

/** Accumulate a burn, stopping exactly at the remaining budget. */
function spendEnergy(state, amount, bucket, phase) {
  if (!(amount > 0)) return state
  const remaining = Math.max(0, state.energyBudget - state.energySpent)
  if (remaining + ENERGY_EPS >= amount) {
    return {
      ...state,
      energySpent: Math.min(state.energyBudget, state.energySpent + amount),
      energyByPhase: {
        ...state.energyByPhase,
        [bucket]: state.energyByPhase[bucket] + amount,
      },
    }
  }
  // The burn cannot be funded: run it until the pool hits zero, then freeze.
  const available = remaining
  const shortfall = amount - available
  const next = {
    ...state,
    energySpent: state.energyBudget,
    energyByPhase: {
      ...state.energyByPhase,
      [bucket]: state.energyByPhase[bucket] + available,
    },
    status: STATUS.FAILED,
    finishedAt: state.finishedAt ?? Date.now(),
  }
  next.failure = {
    reason: 'energy',
    phase,
    legIndex: state.currentLegIndex,
    shortfallEnergy: shortfall,
    shortfallYears: remainingRouteEstimate({ ...state, energySpent: state.energyBudget }).earthYears,
  }
  return next
}

/**
 * A leg's Earth and ship time split across the three interstellar phases.
 *
 * Simple SR has instantaneous acceleration and braking, so the speed and the
 * Lorentz factor are constant and every year of the leg belongs to cruise.
 * Advanced SR flies the accelerate–cruise–brake solution, so each phase owns
 * its own share of both clocks. Either way the shares sum to the leg's totals,
 * so the expedition forecast never changes.
 */
export function legPhaseClocks(leg) {
  const model = leg?.physicsMode === 'advanced' ? leg.advanced : null
  if (model) {
    return {
      [PHASE.ACCELERATION]: { earthYears: model.accelYears, shipYears: model.shipAccelYears },
      [PHASE.CRUISE]: { earthYears: model.cruiseYears, shipYears: model.shipCruiseYears },
      [PHASE.DECELERATION]: { earthYears: model.brakeYears, shipYears: model.shipBrakeYears },
    }
  }
  return {
    [PHASE.ACCELERATION]: { earthYears: 0, shipYears: 0 },
    [PHASE.CRUISE]: { earthYears: leg?.earthYears ?? 0, shipYears: leg?.shipYears ?? 0 },
    [PHASE.DECELERATION]: { earthYears: 0, shipYears: 0 },
  }
}

/** Where the ship sits along the leg during each phase (visual only). */
function legProgressFor(phase, phaseProgress) {
  if (phase === PHASE.CRUISE) return phaseProgress * 0.9
  if (phase === PHASE.DECELERATION) return 0.9 + phaseProgress * 0.1
  return 0
}

/**
 * Advance both clocks through one phase tick, with the Earth deadline checked
 * mid-tick. The ship's proper time accumulates from that phase's own share of
 * the leg, so acceleration and braking never borrow the cruise Lorentz factor.
 */
function advanceClocks(state, phase, delta) {
  const leg = state.route.legs[state.currentLegIndex]
  if (!leg) return state

  const share = legPhaseClocks(leg)[phase] ?? { earthYears: 0, shipYears: 0 }
  const phaseProgress = Math.min(1, state.phaseProgress + delta)
  const fraction = phaseProgress - state.phaseProgress
  const earthDelta = share.earthYears * fraction
  const shipDelta = share.shipYears * fraction
  const earthRemaining = Math.max(0, state.earthTimeBudget - state.earthTimeElapsed)

  if (earthDelta + TIME_EPS < earthRemaining) {
    return {
      ...state,
      phaseProgress,
      legProgress: legProgressFor(phase, phaseProgress),
      earthTimeElapsed: state.earthTimeElapsed + earthDelta,
      shipTimeElapsed: state.shipTimeElapsed + shipDelta,
    }
  }

  // The deadline lands inside this tick: advance exactly to the limit, then
  // freeze the spacecraft where it was at that instant.
  const allowed = earthDelta > 0 ? Math.max(0, Math.min(1, earthRemaining / earthDelta)) : 0
  const stoppedAt = state.phaseProgress + fraction * allowed
  const next = {
    ...state,
    phaseProgress: stoppedAt,
    legProgress: legProgressFor(phase, stoppedAt),
    earthTimeElapsed: state.earthTimeBudget,
    shipTimeElapsed: state.shipTimeElapsed + shipDelta * allowed,
    status: STATUS.FAILED,
    finishedAt: Date.now(),
  }
  next.failure = {
    reason: 'time',
    phase,
    legIndex: state.currentLegIndex,
    shortfallYears: remainingRouteEstimate(next).earthYears,
    shortfallEnergy: 0,
  }
  return next
}

function applyPhase(state, phase, delta) {
  const leg = state.route.legs[state.currentLegIndex]
  if (!leg) return state

  if (phase === PHASE.ESCAPE) {
    const next = spendEnergy(state, leg.gravityCost * delta, 'gravity', phase)
    if (next.status !== STATUS.ACTIVE) return next
    return { ...next, phaseProgress: Math.min(1, state.phaseProgress + delta) }
  }

  if (phase === PHASE.ACCELERATION) {
    const next = spendEnergy(state, leg.accelerationCost * delta, 'acceleration', phase)
    if (next.status !== STATUS.ACTIVE) return next
    return advanceClocks(next, PHASE.ACCELERATION, delta)
  }

  if (phase === PHASE.CRUISE) return advanceClocks(state, PHASE.CRUISE, delta)

  if (phase === PHASE.DECELERATION) {
    const next = spendEnergy(state, leg.brakingCost * delta, 'braking', phase)
    if (next.status !== STATUS.ACTIVE) return next
    return advanceClocks(next, PHASE.DECELERATION, delta)
  }

  return state
}

function evaluateArrival(state) {
  const leg = state.route.legs[state.currentLegIndex]
  if (!leg) return state
  const visited =
    leg.toSystem === HOME_SYSTEM || state.visitedSystemNames.includes(leg.toSystem)
      ? state.visitedSystemNames
      : [...state.visitedSystemNames, leg.toSystem]
  const arrived = {
    ...state,
    phaseProgress: 1,
    legProgress: 1,
    completedDistanceLy: state.completedDistanceLy + leg.distanceLy,
    currentLocation: {
      systemName: leg.toSystem,
      planetId: leg.arrivalPlanetId,
      planetName: leg.arrivalPlanetName,
    },
    visitedSystemNames: visited,
    visitedSystemCount: visited.length,
    arrivalCount: state.arrivalCount + 1,
  }

  const isFinalLeg = state.currentLegIndex === state.route.legs.length - 1
  if (!isFinalLeg) {
    return { ...arrived, status: STATUS.SURVEYING, currentPhase: PHASE.ARRIVAL }
  }

  // Home. The win needs resources strictly to spare and at least one survey.
  const energyRemaining = Math.max(0, arrived.energyBudget - arrived.energySpent)
  const earthRemaining = Math.max(0, arrived.earthTimeBudget - arrived.earthTimeElapsed)
  const finished = { ...arrived, finishedAt: Date.now(), currentPhase: PHASE.ARRIVAL }

  if (energyRemaining <= ENERGY_EPS) {
    return {
      ...finished,
      status: STATUS.FAILED,
      failure: {
        reason: 'energy',
        phase: PHASE.ARRIVAL,
        legIndex: state.currentLegIndex,
        shortfallEnergy: 0,
        shortfallYears: 0,
      },
    }
  }
  if (earthRemaining <= TIME_EPS) {
    return {
      ...finished,
      status: STATUS.FAILED,
      failure: {
        reason: 'time',
        phase: PHASE.ARRIVAL,
        legIndex: state.currentLegIndex,
        shortfallEnergy: 0,
        shortfallYears: 0,
      },
    }
  }
  if (arrived.surveyedPlanetIds.length === 0) {
    return {
      ...finished,
      status: STATUS.FAILED,
      failure: {
        reason: 'no-survey',
        phase: PHASE.ARRIVAL,
        legIndex: state.currentLegIndex,
        shortfallEnergy: 0,
        shortfallYears: 0,
      },
    }
  }
  return { ...finished, status: STATUS.SUCCESS }
}

function advancePhase(state) {
  const phase = state.currentPhase
  if (phase === PHASE.ESCAPE) {
    return { ...state, currentPhase: PHASE.ACCELERATION, phaseProgress: 0 }
  }
  if (phase === PHASE.ACCELERATION) {
    const leg = state.route.legs[state.currentLegIndex]
    return {
      ...state,
      currentPhase: PHASE.CRUISE,
      phaseProgress: 0,
      cruiseSeconds: cruiseSecondsFor(leg?.earthYears ?? 0),
    }
  }
  if (phase === PHASE.CRUISE) {
    return { ...state, currentPhase: PHASE.DECELERATION, phaseProgress: 0 }
  }
  if (phase === PHASE.DECELERATION) return evaluateArrival(state)
  return state
}

/**
 * Create a fresh expedition from a projected route. Starting and remaining
 * budgets are stored separately: `energyBudget`/`earthTimeBudget` never move.
 */
export function createExpedition({ route, energyBudget, earthTimeBudget, shipName = 'Odyssey' }) {
  const first = route?.legs?.[0]
  return {
    status: STATUS.ACTIVE,
    route,
    shipName,
    energyBudget,
    energySpent: 0,
    energyByPhase: { gravity: 0, acceleration: 0, braking: 0 },
    earthTimeBudget,
    earthTimeElapsed: 0,
    shipTimeElapsed: 0,
    surveyYearsTotal: 0,
    currentLegIndex: 0,
    currentPhase: first ? PHASE.ESCAPE : PHASE.IDLE,
    phaseProgress: 0,
    legProgress: 0,
    cruiseSeconds: first ? cruiseSecondsFor(first.earthYears) : 0,
    currentLocation: {
      systemName: 'Solar System',
      planetId: 'earth',
      planetName: 'Earth',
    },
    visitedSystemNames: [],
    visitedSystemCount: 0,
    surveyedPlanetIds: [],
    completedDistanceLy: 0,
    arrivalCount: 0,
    failure: null,
    startedAt: Date.now(),
    finishedAt: null,
  }
}

/**
 * Advance by `dtSeconds` of real playback time. Deterministic: the same state
 * and the same delta always produce the same next state.
 */
export function advanceExpedition(state, dtSeconds) {
  if (!state || state.status !== STATUS.ACTIVE || !(dtSeconds > 0)) return state
  let next = state
  let remaining = dtSeconds
  let guard = 0

  while (remaining > 1e-12 && next.status === STATUS.ACTIVE && guard < 128) {
    guard += 1
    const seconds = phaseSeconds(next, next.currentPhase)
    const left = Math.max(0, seconds * (1 - next.phaseProgress))
    if (left <= 1e-9) {
      next = advancePhase(next)
      continue
    }
    const step = Math.min(remaining, left)
    const fraction = step / seconds
    next = applyPhase(next, next.currentPhase, fraction)
    remaining -= step
    if (next.status !== STATUS.ACTIVE) break
    if (step >= left - 1e-9) next = advancePhase(next)
  }

  return next
}

export function pauseExpedition(state) {
  if (state.status !== STATUS.ACTIVE) return state
  return { ...state, status: STATUS.PAUSED }
}

export function resumeExpedition(state) {
  if (state.status !== STATUS.PAUSED) return state
  return { ...state, status: STATUS.ACTIVE }
}

/** A local survey: 0.25 yr on both clocks, no propulsion energy. */
export function surveyPlanet(state, planetId) {
  if (!state || state.status !== STATUS.SURVEYING) return state
  if (state.surveyedPlanetIds.includes(planetId)) return state

  const earthRemaining = Math.max(0, state.earthTimeBudget - state.earthTimeElapsed)
  if (earthRemaining <= SURVEY_YEARS + TIME_EPS) {
    const next = {
      ...state,
      earthTimeElapsed: state.earthTimeBudget,
      status: STATUS.FAILED,
      finishedAt: Date.now(),
    }
    next.failure = {
      reason: 'time',
      phase: PHASE.ARRIVAL,
      legIndex: state.currentLegIndex,
      shortfallYears: Math.max(0, SURVEY_YEARS - earthRemaining) + remainingRouteEstimate(next).earthYears,
      shortfallEnergy: 0,
    }
    return next
  }

  return {
    ...state,
    earthTimeElapsed: state.earthTimeElapsed + SURVEY_YEARS,
    shipTimeElapsed: state.shipTimeElapsed + SURVEY_YEARS,
    surveyYearsTotal: state.surveyYearsTotal + SURVEY_YEARS,
    surveyedPlanetIds: [...state.surveyedPlanetIds, planetId],
  }
}

/** Leave the current stop and begin the next leg. */
export function continueExpedition(state) {
  if (!state || state.status !== STATUS.SURVEYING) return state
  const nextIndex = state.currentLegIndex + 1
  if (nextIndex >= state.route.legs.length) return state
  const leg = state.route.legs[nextIndex]
  return {
    ...state,
    status: STATUS.ACTIVE,
    currentLegIndex: nextIndex,
    currentPhase: PHASE.ESCAPE,
    phaseProgress: 0,
    legProgress: 0,
    cruiseSeconds: cruiseSecondsFor(leg.earthYears),
  }
}

/**
 * Replace the unflown remainder of the route with one direct leg home. This is
 * the only way the itinerary may change mid-expedition, and it is still flown.
 */
export function insertFinalLeg(state, leg) {
  if (!state) return state
  if (state.status !== STATUS.PAUSED && state.status !== STATUS.SURVEYING && state.status !== STATUS.ACTIVE) {
    return state
  }
  const completed = state.route.legs.slice(0, state.currentLegIndex + 1)
  if (completed.length >= state.route.legs.length) return state
  const legs = [...completed, leg].map((entry, index) => ({ ...entry, index }))
  const nextIndex = completed.length
  return {
    ...state,
    status: STATUS.ACTIVE,
    route: {
      ...state.route,
      legs,
      truncated: true,
    },
    currentLegIndex: nextIndex,
    currentPhase: PHASE.ESCAPE,
    phaseProgress: 0,
    legProgress: 0,
    cruiseSeconds: cruiseSecondsFor(leg.earthYears),
  }
}

export function currentLeg(state) {
  if (!state?.route) return null
  return state.route.legs[state.currentLegIndex] ?? null
}

/**
 * What is still left to fly and to burn from this exact point, ignoring the
 * budgets. Used for the failure panel's "additional resources required".
 */
export function remainingRouteEstimate(state) {
  if (!state?.route) return { energy: 0, earthYears: 0 }
  const legs = state.route.legs
  const leg = legs[state.currentLegIndex] ?? null
  let energy = 0
  let earthYears = 0

  if (leg) {
    const escapeLeft = state.currentPhase === PHASE.ESCAPE ? 1 - state.phaseProgress : 0
    const accelLeft = state.currentPhase === PHASE.ACCELERATION ? 1 - state.phaseProgress : 0
    const cruiseLeft = state.currentPhase === PHASE.CRUISE ? 1 - state.phaseProgress : 0
    const brakeLeft = state.currentPhase === PHASE.DECELERATION ? 1 - state.phaseProgress : 0
    const notYet = state.currentPhase === PHASE.IDLE
    const clocks = legPhaseClocks(leg)
    energy += leg.gravityCost * (notYet ? 1 : escapeLeft)
    energy += leg.accelerationCost * (notYet ? 1 : accelLeft)
    energy += leg.brakingCost * (notYet ? 1 : brakeLeft)
    // Every phase still ahead contributes its own share of the Earth clock.
    earthYears += clocks[PHASE.ACCELERATION].earthYears * (notYet ? 1 : accelLeft)
    earthYears += clocks[PHASE.CRUISE].earthYears * (notYet ? 1 : cruiseLeft)
    earthYears += clocks[PHASE.DECELERATION].earthYears * (notYet ? 1 : brakeLeft)
    for (let index = state.currentLegIndex + 1; index < legs.length; index += 1) {
      energy += legs[index].totalEnergyCost
      earthYears += legs[index].earthYears
    }
  }

  const planned = state.route.plannedSurveys ?? 0
  const remainingSurveys = Math.max(0, planned - state.surveyedPlanetIds.length)
  earthYears += remainingSurveys * SURVEY_YEARS
  return { energy, earthYears }
}

/** Everything a result or HUD screen displays, derived from the one state. */
export function expeditionSummary(state) {
  if (!state) return null
  const leg = currentLeg(state)
  const distanceLy =
    state.completedDistanceLy +
    (state.status === STATUS.SUCCESS ? 0 : leg ? leg.distanceLy * state.legProgress : 0)
  // Inside the tolerances the pool counts as exhausted, so a "successful"
  // return never reports a positive sliver of floating-point dust.
  const energyLeft = state.energyBudget - state.energySpent
  const earthLeft = state.earthTimeBudget - state.earthTimeElapsed
  const energyRemaining = energyLeft <= ENERGY_EPS ? 0 : Math.max(0, energyLeft)
  const earthTimeRemaining = earthLeft <= TIME_EPS ? 0 : Math.max(0, earthLeft)

  return {
    status: state.status,
    route: state.route,
    shipName: state.shipName,
    distanceLy,
    totalDistanceLy: state.route.legs.reduce((sum, entry) => sum + entry.distanceLy, 0),
    earthYears: state.earthTimeElapsed,
    shipYears: state.shipTimeElapsed,
    agingGapYears: Math.max(0, state.earthTimeElapsed - state.shipTimeElapsed),
    energyBudget: state.energyBudget,
    energySpent: Math.min(state.energySpent, state.energyBudget),
    energyRemaining,
    gravitySpent: state.energyByPhase.gravity,
    accelerationSpent: state.energyByPhase.acceleration,
    brakingSpent: state.energyByPhase.braking,
    earthTimeBudget: state.earthTimeBudget,
    earthTimeElapsed: state.earthTimeElapsed,
    earthTimeRemaining,
    surveyedPlanetIds: [...state.surveyedPlanetIds],
    surveyedCount: state.surveyedPlanetIds.length,
    systemsVisited: state.visitedSystemNames.filter((name) => name !== HOME_SYSTEM).length,
    visitedSystemNames: [...state.visitedSystemNames],
    currentLegIndex: state.currentLegIndex,
    legCount: state.route.legs.length,
    currentPhase: state.currentPhase,
    legProgress: state.legProgress,
    currentLocation: state.currentLocation,
    failure: state.failure,
    remaining: remainingRouteEstimate(state),
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
  }
}
