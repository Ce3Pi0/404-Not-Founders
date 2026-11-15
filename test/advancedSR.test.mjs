// Acceptance tests for the two Special-Relativity modes.
//
// Run with `npm test`. These cover the advanced-SR mathematics (including the
// short-journey case and the proper-time integral), the launch feasibility
// regression from the brief, and the Expedition Challenge's per-leg reuse of
// the same engine.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_ADVANCED_CONFIG,
  LIMITS,
  advancedJourney,
  feasibilityFor,
  gammaFor,
  journeyEnergy,
  resolveDepartureType,
  trajectoryAt,
} from '../src/lib/advancedSR.js'
import { simulateMission } from '../src/lib/physics.js'
import { assembleExpedition, groupStops } from '../src/lib/challenge/assemble.js'

const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${actual} != ${expected}`,
  )
}

const earth = { id: 'earth', name: 'Earth', kind: 'earth' }

/** Trapezoidal ∫ dt/γ over the whole trajectory. */
function integrateProperTime(model, steps = 20000) {
  let total = 0
  let previous = trajectoryAt(model, 0)
  let previousRate = Math.sqrt(1 - previous.beta * previous.beta)
  for (let i = 1; i <= steps; i += 1) {
    const state = trajectoryAt(model, i / steps)
    const rate = Math.sqrt(1 - state.beta * state.beta)
    const dt = state.earthSeconds - previous.earthSeconds
    total += (dt * (rate + previousRate)) / 2
    previous = state
    previousRate = rate
  }
  return total
}

/* ------------------------------------------------------- simple-mode regression -- */

test('simple SR keeps the constant-velocity result', () => {
  const result = simulateMission(4, 0.8)
  close(result.gamma, 1 / Math.sqrt(1 - 0.64), 1e-12)
  close(result.earthYears, 4 / 0.8, 1e-12)
  close(result.shipYears, 4 / 0.8 / result.gamma, 1e-12)
  close(result.driftYears, result.earthYears - result.shipYears, 1e-12)
})

/* ------------------------------------------------------------ advanced SR -- */

test('advanced SR: reachable target gives accelerate–cruise–brake', () => {
  const model = advancedJourney({ distanceLy: 10, beta: 0.8, accelMs: 9.81 })
  assert.equal(model.reachedTarget, true)
  close(model.betaPeak, 0.8, 1e-12)
  // Distances add up to the total: no negative or invented cruise distance.
  close(
    model.accelDistanceM + model.cruiseDistanceM + model.brakeDistanceM,
    model.distanceM,
    1e-12,
  )
  assert.ok(model.cruiseDistanceM > 0)
  close(model.accelFraction, model.accelDistanceM / model.distanceM, 1e-12)
  close(model.brakeStartFraction, 1 - model.brakeDistanceM / model.distanceM, 1e-12)
  // Braking mirrors acceleration.
  close(model.brakeSeconds, model.accelerateSeconds, 1e-12)
  close(model.properBrakeSeconds, model.properAccelerateSeconds, 1e-12)
  // Both clocks are positive and the crew ages less.
  assert.ok(model.earthYears > 0)
  assert.ok(model.shipYears > 0)
  assert.ok(model.shipYears < model.earthYears)
})

test('advanced SR: the analytic controls agree with the trajectory', () => {
  const model = advancedJourney({ distanceLy: 10, beta: 0.8, accelMs: 9.81 })
  // Mid-cruise, in Earth time: the ship holds exactly the peak speed there.
  const midCruise = trajectoryAt(
    model,
    (model.accelerateSeconds + model.cruiseSeconds / 2) / model.earthSeconds,
  )
  close(midCruise.beta, model.betaPeak, 1e-9)
  close(midCruise.gamma, model.gammaPeak, 1e-9)
  const end = trajectoryAt(model, 1)
  close(end.travelledLy, model.distanceLy, 1e-9)
  close(end.shipYears, model.shipYears, 1e-9)
  assert.equal(end.beta, 0)
})

test('advanced SR: a short journey cannot reach the target speed', () => {
  const model = advancedJourney({ distanceLy: 0.5, beta: 0.99, accelMs: 9.81 })
  assert.equal(model.reachedTarget, false)
  assert.ok(model.betaPeak < 0.99)
  assert.ok(model.betaPeak > 0)
  assert.equal(model.cruiseDistanceM, 0)
  assert.equal(model.cruiseSeconds, 0)
  close(model.accelDistanceM, model.distanceM / 2, 1e-12)
  close(model.brakeDistanceM, model.distanceM / 2, 1e-12)
  // The peak speed is the physically reachable one for this distance.
  close(model.gammaPeak, 1 + (model.distanceM * model.accelMs) / (2 * 299792458 ** 2), 1e-12)
  close(model.gammaPeak, gammaFor(model.betaPeak), 1e-9)
})

test('advanced SR: proper time is the integral of dt/γ, not one cruise γ', () => {
  for (const scenario of [
    { distanceLy: 10, beta: 0.8, accelMs: 9.81 },
    { distanceLy: 0.5, beta: 0.99, accelMs: 9.81 },
    { distanceLy: 40, beta: 0.99, accelMs: 2 },
  ]) {
    const model = advancedJourney(scenario)
    close(integrateProperTime(model), model.shipSeconds, 1e-5)
    // Applying the peak γ to the whole trip is wrong whenever the ship brakes.
    const naive = model.earthYears / model.gammaPeak
    assert.ok(Math.abs(naive - model.shipYears) > 1e-9)
  }
})

test('advanced SR: the ship never reaches the speed of light', () => {
  const model = advancedJourney({ distanceLy: 5, beta: 0.99, accelMs: 30 })
  for (let i = 0; i <= 200; i += 1) {
    const state = trajectoryAt(model, i / 200)
    assert.ok(state.beta < 1)
    assert.ok(Number.isFinite(state.shipYears))
    assert.ok(state.travelledLy >= 0)
    assert.ok(state.travelledLy <= model.distanceLy + 1e-9)
  }
})

test('advanced SR: normalised burn energy uses the attained peak', () => {
  const model = advancedJourney({ distanceLy: 0.5, beta: 0.99, accelMs: 9.81 })
  const energy = journeyEnergy(model)
  close(energy.acceleration, model.gammaPeak - 1, 1e-12)
  close(energy.braking, model.gammaPeak - 1, 1e-12)
  close(energy.total, 2 * (model.gammaPeak - 1), 1e-12)
  assert.ok(energy.total < 2 * (gammaFor(0.99) - 1))
})

/* ------------------------------------------------------------ feasibility -- */

test('feasibility: the reference craft cannot lift off Earth', () => {
  const config = { ...DEFAULT_ADVANCED_CONFIG, accelMs: 14 }
  const report = feasibilityFor(config, earth)
  assert.equal(report.totalMassT, 2000)
  close(report.maxAccelMs2, 4, 1e-12)
  assert.equal(report.thrustOk, false)
  assert.equal(report.ok, false)
  const titles = report.issues.map((issue) => issue.title)
  assert.ok(titles.includes('INSUFFICIENT ENGINE THRUST'))
  assert.ok(titles.includes('ACCELERATION SETTING NOT ACHIEVABLE'))
  const thrustIssue = report.issues.find((issue) => issue.id === 'thrust')
  assert.ok(thrustIssue.lines.some((line) => /cannot lift off/i.test(line)))
  assert.ok(thrustIssue.lines.some((line) => /2,000 tonnes/.test(line)))
  assert.ok(thrustIssue.lines.some((line) => /4\.00 m\/s²/.test(line)))
  assert.ok(titles.every((title) => !/general relativ|gravitational time/i.test(title)))
})

test('feasibility: 14 m/s² over 2,000 t needs at least 28 MN', () => {
  const tooWeak = feasibilityFor(
    { dryMassT: 500, propellantT: 1500, thrustMN: 27.9, accelMs: 14, departureType: 'surface' },
    earth,
  )
  assert.equal(tooWeak.thrustOk, false)
  const enough = feasibilityFor(
    { dryMassT: 500, propellantT: 1500, thrustMN: 28, accelMs: 14, departureType: 'surface' },
    earth,
  )
  assert.equal(enough.thrustOk, true)
  assert.equal(enough.liftOk, true)
  assert.equal(enough.ok, true)
})

test('feasibility: the default 1 g set-point cannot lift off Earth', () => {
  // With enough thrust the engine check passes and only gravity is in the way.
  const report = feasibilityFor({ ...DEFAULT_ADVANCED_CONFIG, thrustMN: 30 }, earth)
  assert.equal(report.thrustOk, true)
  assert.equal(report.liftOk, false)
  assert.ok(report.issues.some((issue) => issue.title === 'SPACECRAFT CANNOT LIFT OFF'))
  // An orbital departure has no liftoff constraint, only the engine's.
  const orbital = feasibilityFor(
    { ...DEFAULT_ADVANCED_CONFIG, thrustMN: 30, departureType: 'orbital' },
    earth,
  )
  assert.equal(orbital.ok, true)
})

test('feasibility: unmeasured worlds depart from orbit by default', () => {
  const world = {
    id: 'x',
    name: 'Unmeasured b',
    kind: 'exoplanet',
    massEarthMeasured: null,
    radiusEarthMeasured: null,
  }
  assert.equal(resolveDepartureType(world, 'auto'), 'orbital')
  assert.equal(resolveDepartureType(earth, 'auto'), 'surface')
  assert.equal(LIMITS.accelMs.min > 0, true)
})

/* ------------------------------------------------- challenge compatibility -- */

const stop = (systemName, position, planet) => ({
  systemName,
  position,
  planetIds: [planet.id],
  planetNames: [planet.name],
  landingPlanet: planet,
})

test('challenge route: each leg is computed once with the advanced engine', () => {
  const rocky = (id, name) => ({
    id,
    name,
    kind: 'exoplanet',
    massEarthMeasured: 1.2,
    radiusEarthMeasured: 1.1,
    massSource: 'Measured mass',
    massIsMinimum: false,
  })
  const stops = groupStops([
    { ...rocky('a', 'Planet X'), systemName: 'A', position: [0, 0, 5] },
    { ...rocky('b', 'Planet Y'), systemName: 'B', position: [0, 0, 12] },
  ])
  const config = { accelMs: 9.81 }
  const route = assembleExpedition(stops, {}, { advanced: true, config })
  assert.equal(route.physicsMode, 'advanced')
  assert.equal(route.legs.length, 3) // Earth → X → Y → Earth, no extra return
  assert.equal(route.legs[0].fromSystem, 'Solar System')
  assert.equal(route.legs[1].toSystem, 'B')
  assert.equal(route.legs[2].toSystem, 'Solar System')

  for (const leg of route.legs) {
    const model = advancedJourney({
      distanceLy: leg.distanceLy,
      beta: leg.beta,
      accelMs: config.accelMs,
    })
    close(leg.earthYears, model.earthYears, 1e-12)
    close(leg.shipYears, model.shipYears, 1e-12)
    close(leg.gamma, model.gammaPeak, 1e-12)
    close(leg.accelerationCost, model.gammaPeak - 1, 1e-12)
    close(leg.totalEnergyCost, leg.gravityCost + 2 * (model.gammaPeak - 1), 1e-12)
    close(leg.betaPeak, model.betaPeak, 1e-12)
  }

  const sumEarth = route.legs.reduce((sum, leg) => sum + leg.earthYears, 0)
  close(route.totalEarthYears, sumEarth + route.surveyYears, 1e-12)

  // The same route in simple mode keeps the classical numbers.
  const simple = assembleExpedition(stops, {}, {})
  assert.equal(simple.physicsMode, 'simple')
  for (const leg of simple.legs) {
    close(leg.earthYears, leg.distanceLy / leg.beta, 1e-12)
    close(leg.betaPeak, leg.beta, 1e-12)
  }
  // Every target speed is reachable on these legs, so the attained peak — and
  // therefore the burn energy — matches simple mode. Only the clocks differ.
  assert.ok(route.legs.every((leg) => leg.betaPeak === leg.beta))
  assert.ok(Math.abs(route.legs[0].earthYears - simple.legs[0].earthYears) > 1e-6)
  assert.ok(route.legs[0].shipYears > simple.legs[0].shipYears)
})
