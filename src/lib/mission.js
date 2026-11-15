// One place that turns a route + physics mode into a flight. The Flight Plan
// preview and the actual launch read this same function, so the numbers the
// user is shown are the numbers the ship flies.

import { simulateMission } from './physics'
import {
  DEFAULT_ADVANCED_CONFIG,
  advancedJourney,
  feasibilityFor,
  journeyEnergy,
  resolveDepartureType,
} from './advancedSR'
import { usePhysicsStore } from '../store/physicsStore'

/** Current mode and parameters, outside React (launch, challenge). */
export function readPhysicsConfig() {
  const state = usePhysicsStore.getState()
  return {
    advanced: Boolean(state.advanced),
    config: { ...DEFAULT_ADVANCED_CONFIG, ...state.config },
  }
}

/**
 * Predictions for one route in the selected mode. Always computes the simple
 * result too, so the planner can show both side by side.
 */
export function planMission({ origin, destination, distanceLy, beta, advanced, config }) {
  const settings = { ...DEFAULT_ADVANCED_CONFIG, ...config }
  const simple = simulateMission(distanceLy, beta)
  if (!advanced) {
    return {
      mode: 'simple',
      simple,
      model: null,
      feasibility: null,
      departureType: null,
      config: settings,
    }
  }
  const departureType = resolveDepartureType(origin, settings.departureType)
  const feasibility = feasibilityFor({ ...settings, departureType }, origin)
  const model = advancedJourney({ distanceLy, beta, accelMs: settings.accelMs })
  return { mode: 'advanced', simple, model, feasibility, departureType, config: settings }
}

/**
 * The clock fields every screen reads. Simple mode keeps the classic constant
 * cruise; advanced mode reports the actual peak speed and both clocks of the
 * full accelerate–cruise–brake leg.
 */
export function missionPhysics(plan) {
  const { mode, simple, model, feasibility, departureType, config } = plan
  if (mode !== 'advanced' || !model) {
    return {
      mode: 'simple',
      beta: simple.beta,
      requestedBeta: simple.beta,
      gamma: simple.gamma,
      earthYears: simple.earthYears,
      shipYears: simple.shipYears,
      driftYears: simple.driftYears,
      earthDays: simple.earthDays,
      shipDays: simple.shipDays,
      simple,
      advanced: null,
      feasibility: null,
      departureType: null,
      config,
      energy: {
        acceleration: simple.gamma - 1,
        braking: simple.gamma - 1,
        total: (simple.gamma - 1) * 2,
      },
    }
  }
  return {
    mode: 'advanced',
    beta: model.betaPeak,
    requestedBeta: model.requestedBeta,
    gamma: model.gammaPeak,
    earthYears: model.earthYears,
    shipYears: model.shipYears,
    driftYears: model.driftYears,
    earthDays: model.earthYears * 365.25,
    shipDays: model.shipYears * 365.25,
    simple,
    advanced: model,
    feasibility,
    departureType,
    config,
    energy: journeyEnergy(model),
  }
}
