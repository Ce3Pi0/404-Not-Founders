// Acceptance tests for the Expedition Challenge's pure model.
//
// Run with `npm test` (Node's built-in runner). These cover the physics
// formulas, route assembly and the simulation's failure semantics without a
// browser, mirroring the acceptance tests in the feature brief.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BETA_MAX,
  BETA_MIN,
  SURVEY_YEARS,
  accelerationEnergy,
  brakingEnergy,
  departureProfile,
  gravityEscapeEnergy,
  legTravelTimes,
  lorentzFactor,
  propulsionEnergy,
} from '../src/lib/challenge/physics.js'
import { assembleExpedition, groupStops } from '../src/lib/challenge/assemble.js'
import {
  STATUS,
  advanceExpedition,
  continueExpedition,
  createExpedition,
  expeditionSummary,
  remainingRouteEstimate,
  surveyPlanet,
} from '../src/lib/challenge/engine.js'

const close = (actual, expected, tolerance = 1e-12) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${actual} != ${expected}`,
  )
}

const rocky = (id, name, mass, radius) => ({
  id,
  name,
  kind: 'exoplanet',
  massEarthMeasured: mass,
  radiusEarthMeasured: radius,
  massSource: 'Measured mass',
  massIsMinimum: false,
})

const stop = (systemName, position, planet) => ({
  systemName,
  position,
  planetIds: [planet.id],
  planetNames: [planet.name],
  landingPlanet: planet,
})

/* ---------------------------------------------------------------- physics -- */

test('lorentz factor and relativistic burn energy', () => {
  close(lorentzFactor(0.6), 1.25)
  close(lorentzFactor(0.8), 1 / 0.6)
  close(accelerationEnergy(0.6), 0.25)
  close(brakingEnergy(0.6), 0.25)
  close(propulsionEnergy(0.6), 0.5)
  assert.throws(() => lorentzFactor(0))
  assert.throws(() => lorentzFactor(1))
  assert.throws(() => lorentzFactor(-0.2))
})

test('Earth escape energy is the documented 6.96e-10 mc²', () => {
  const cost = gravityEscapeEnergy(1, 1)
  close(cost, 6.961e-10, 2e-3)
  assert.ok(cost < 1e-9, 'gravity stays tiny and is never rounded to zero')
  assert.throws(() => gravityEscapeEnergy(0, 1))
})

test('constant-speed leg durations in both frames', () => {
  const times = legTravelTimes(10, 0.8)
  close(times.earthYears, 12.5)
  close(times.shipYears, 7.5)
  close(times.gamma, 1 / 0.6)
})

test('departure profile refuses to invent surface launches', () => {
  const earth = departureProfile({ id: 'earth', kind: 'earth' })
  assert.equal(earth.surface, true)
  close(earth.cost, gravityEscapeEnergy(1, 1))

  const gas = departureProfile(rocky('g', 'Gas giant', 300, 11))
  assert.equal(gas.surface, false)
  assert.equal(gas.cost, null)

  const unmeasured = departureProfile({ id: 'u', kind: 'exoplanet', massEarthMeasured: null })
  assert.equal(unmeasured.surface, false)
  assert.equal(unmeasured.cost, null)

  const minimum = departureProfile({
    ...rocky('m', 'M sin i world', 2, 1.2),
    massSource: 'Minimum mass (M sin i)',
    massIsMinimum: true,
  })
  assert.equal(minimum.surface, true)
  assert.equal(minimum.massIsMinimum, true)
})

/* ------------------------------------------------------------------ route -- */

test('Test 1 — one continuous expedition has exactly three legs', () => {
  const x = rocky('x', 'Planet X', 5, 1.5)
  const y = rocky('y', 'Planet Y', 3, 1.2)
  const route = assembleExpedition(
    [stop('Alpha', [10, 0, 0], x), stop('Beta', [0, 12, 0], y)],
    {},
  )
  assert.equal(route.legs.length, 3)
  assert.equal(route.stops.length, 2)
  assert.deepEqual(
    route.legs.map((leg) => [leg.fromSystem, leg.toSystem]),
    [
      ['Solar System', 'Alpha'],
      ['Alpha', 'Beta'],
      ['Beta', 'Solar System'],
    ],
  )
  assert.equal(route.legs[2].arrivalPlanetId, 'earth')
})

test('Test 2 — every leg keeps its own velocity and cost', () => {
  const x = rocky('x', 'Planet X', 5, 1.5)
  const y = rocky('y', 'Planet Y', 3, 1.2)
  const stops = [stop('Alpha', [10, 0, 0], x), stop('Beta', [0, 12, 0], y)]
  const base = assembleExpedition(stops, {})
  const betas = { 0: 0.7, 1: 0.9, 2: 0.8 }
  const speeds = Object.fromEntries(base.legs.map((leg) => [leg.key, betas[leg.index]]))
  const route = assembleExpedition(stops, speeds)

  close(route.legs[0].beta, 0.7)
  close(route.legs[1].beta, 0.9)
  close(route.legs[2].beta, 0.8)
  close(route.legs[0].accelerationCost, lorentzFactor(0.7) - 1)
  close(route.legs[1].accelerationCost, lorentzFactor(0.9) - 1)
  close(route.legs[2].accelerationCost, lorentzFactor(0.8) - 1)
  assert.notEqual(route.legs[0].earthYears, route.legs[1].earthYears)

  // The return velocity is a real budget lever.
  const fasterReturn = assembleExpedition(stops, { ...speeds, [base.legs[2].key]: 0.95 })
  assert.ok(fasterReturn.totalEnergy > route.totalEnergy)
  assert.ok(fasterReturn.totalEarthYears < route.totalEarthYears)
})

test('Test 3 — escape energy uses each world’s own measured mass and radius', () => {
  const x = rocky('x', 'Planet X', 5, 2)
  const route = assembleExpedition([stop('Alpha', [10, 0, 0], x)], {})
  const earthEscape = gravityEscapeEnergy(1, 1)
  close(route.legs[0].gravityCost, earthEscape)
  close(route.legs[1].gravityCost, gravityEscapeEnergy(5, 2))
  assert.notEqual(route.legs[0].gravityCost, route.legs[1].gravityCost)
  assert.equal(route.legs[1].departureMode, 'surface')
  assert.ok(route.legs[1].gravityCost > earthEscape)
})

test('Test 10 — one leg charges one escape, one acceleration, one braking', () => {
  const x = rocky('x', 'Planet X', 5, 1.5)
  const route = assembleExpedition([stop('Alpha', [10, 0, 0], x)], {})
  const leg = route.legs[0]
  close(leg.totalEnergyCost, leg.gravityCost + accelerationEnergy(0.6) + brakingEnergy(0.6))
  close(route.totalEnergy, route.legs[0].totalEnergyCost + route.legs[1].totalEnergyCost)
  // No round-trip multiplier: the two legs are two separate journeys.
  assert.ok(route.totalEnergy < 2 * (route.legs[0].totalEnergyCost + route.legs[1].totalEnergyCost))
})

test('same-system planets are one stop, never a second journey', () => {
  const b = rocky('b', 'Alpha b', 5, 1.5)
  const c = rocky('c', 'Alpha c', 2, 1.1)
  const stops = groupStops([
    { ...b, systemName: 'Alpha', position: [10, 0, 0] },
    { ...c, systemName: 'Alpha', position: [10, 0, 0] },
  ])
  assert.equal(stops.length, 1)
  const route = assembleExpedition(stops, {})
  assert.equal(route.legs.length, 2)
  assert.equal(route.plannedSurveys, 2)
})

/* ----------------------------------------------------------------- engine -- */

function launch(route, energyBudget, earthTimeBudget) {
  return createExpedition({ route, energyBudget, earthTimeBudget })
}

function runUntilStopped(state, step = 0.05, limit = 4000) {
  let next = state
  for (let i = 0; i < limit && next.status === STATUS.ACTIVE; i += 1) {
    next = advanceExpedition(next, step)
  }
  return next
}

function simpleRoute(beta = 0.6, distance = 10) {
  const x = rocky('x', 'Planet X', 5, 1.5)
  return assembleExpedition(
    [stop('Alpha', [distance, 0, 0], x)],
    { 0: beta, 1: beta },
  )
}

test('Test 4 — cruise consumes no propulsion energy while clocks advance', () => {
  const route = simpleRoute()
  let state = launch(route, 2, 200)
  for (let i = 0; i < 4000 && state.currentPhase !== 'cruise'; i += 1) {
    state = advanceExpedition(state, 0.02)
  }
  assert.equal(state.currentPhase, 'cruise')
  const spent = state.energySpent
  const earth = state.earthTimeElapsed
  const ship = state.shipTimeElapsed
  state = advanceExpedition(state, 0.3)
  close(state.energySpent, spent)
  assert.ok(state.earthTimeElapsed > earth)
  assert.ok(state.shipTimeElapsed > ship)
})

test('Test 5 — energy failure happens mid-manoeuvre, after launch', () => {
  const route = simpleRoute()
  const state = launch(route, route.legs[0].totalEnergyCost * 0.8, 200)
  assert.equal(state.status, STATUS.ACTIVE, 'preflight never blocks the launch')
  const failed = runUntilStopped(state)
  assert.equal(failed.status, STATUS.FAILED)
  assert.equal(failed.failure.reason, 'energy')
  assert.ok(['acceleration', 'escape', 'deceleration'].includes(failed.failure.phase))
  assert.ok(failed.failure.shortfallEnergy > 0)
  assert.equal(failed.energySpent, failed.energyBudget)
  assert.equal(Math.max(0, failed.energyBudget - failed.energySpent), 0)
  const summary = expeditionSummary(failed)
  assert.equal(summary.energyRemaining, 0)
  assert.ok(summary.distanceLy > 0)
})

test('Test 6 — Earth-time failure freezes the ship mid-cruise', () => {
  const route = simpleRoute(0.6, 10) // 16.7 yr on Earth's clock
  const state = launch(route, 5, 5)
  const failed = runUntilStopped(state)
  assert.equal(failed.status, STATUS.FAILED)
  assert.equal(failed.failure.reason, 'time')
  assert.equal(failed.failure.phase, 'cruise')
  close(failed.earthTimeElapsed, 5)
  assert.equal(expeditionSummary(failed).earthTimeRemaining, 0)
  assert.ok(failed.legProgress > 0 && failed.legProgress < 0.9)
  assert.ok(failed.failure.shortfallYears > 0)
})

test('Test 7 — a surveyed planet returned home is a success', () => {
  const route = simpleRoute(0.6, 4)
  let state = launch(route, 5, 100)
  state = runUntilStopped(state)
  assert.equal(state.status, STATUS.SURVEYING)
  state = surveyPlanet(state, 'x')
  assert.deepEqual(state.surveyedPlanetIds, ['x'])
  close(state.earthTimeElapsed, 4 / 0.6 + SURVEY_YEARS, 1e-9)
  state = continueExpedition(state)
  state = runUntilStopped(state)
  assert.equal(state.status, STATUS.SUCCESS)
  const summary = expeditionSummary(state)
  assert.equal(summary.surveyedCount, 1)
  assert.equal(summary.systemsVisited, 1, 'Earth is home, not a surveyed host system')
  assert.ok(summary.energyRemaining > 0)
  assert.ok(summary.earthTimeRemaining > 0)
  close(
    summary.earthYears,
    route.legs[0].earthYears + SURVEY_YEARS + route.legs[1].earthYears,
    1e-6,
  )
  assert.ok(summary.shipYears < summary.earthYears)
})

test('Test 8 — arriving somewhere with several planets discovers nothing until scanned', () => {
  const b = rocky('b', 'Alpha b', 5, 1.5)
  const c = rocky('c', 'Alpha c', 2, 1.1)
  const stops = [
    {
      systemName: 'Alpha',
      position: [4, 0, 0],
      planetIds: ['b', 'c'],
      planetNames: ['Alpha b', 'Alpha c'],
      landingPlanet: b,
    },
  ]
  let state = launch(assembleExpedition(stops, {}), 5, 100)
  state = runUntilStopped(state)
  assert.equal(state.status, STATUS.SURVEYING)
  assert.equal(state.surveyedPlanetIds.length, 0)
  state = surveyPlanet(state, 'b')
  assert.equal(state.surveyedPlanetIds.length, 1)
  state = surveyPlanet(state, 'b')
  assert.equal(state.surveyedPlanetIds.length, 1, 'a planet is never counted twice')
  state = surveyPlanet(state, 'c')
  assert.equal(state.surveyedPlanetIds.length, 2)
})

test('Test 9 — running dry on the way home keeps the discoveries and never teleports', () => {
  const x = rocky('x', 'Planet X', 5, 1.5)
  const stops = [
    stop('Alpha', [4, 0, 0], x),
    stop('Beta', [4, 8, 0], rocky('y', 'Planet Y', 3, 1.2)),
  ]
  const route = assembleExpedition(stops, {})
  let state = launch(route, route.totalEnergy * 0.62, 500)
  state = runUntilStopped(state)
  assert.equal(state.status, STATUS.SURVEYING)
  state = surveyPlanet(state, 'x')
  state = continueExpedition(state)
  state = runUntilStopped(state)
  assert.equal(state.status, STATUS.SURVEYING)
  state = surveyPlanet(state, 'y')
  state = continueExpedition(state)
  state = runUntilStopped(state)
  assert.equal(state.status, STATUS.FAILED)
  const summary = expeditionSummary(state)
  assert.equal(summary.surveyedCount, 2, 'discoveries survive the failure')
  assert.equal(summary.systemsVisited, 2)
  assert.equal(state.currentLocation.systemName, 'Beta', 'the ship is not teleported home')
  assert.equal(summary.energyRemaining, 0)
  assert.ok(summary.distanceLy > 0)
})

test('a survey that would exhaust the Earth clock fails the expedition', () => {
  const route = simpleRoute(0.6, 4) // 6.667 yr out
  let state = launch(route, 5, 6.8)
  state = runUntilStopped(state)
  assert.equal(state.status, STATUS.SURVEYING)
  assert.ok(remainingRouteEstimate(state).earthYears > 0)
  state = surveyPlanet(state, 'x')
  assert.equal(state.status, STATUS.FAILED)
  assert.equal(state.failure.reason, 'time')
  assert.equal(expeditionSummary(state).earthTimeRemaining, 0)
})

test('returning with exactly zero energy is not a success', () => {
  const route = simpleRoute(0.6, 4)
  let state = launch(route, route.totalEnergy, 100)
  state = runUntilStopped(state)
  state = surveyPlanet(state, 'x')
  state = continueExpedition(state)
  state = runUntilStopped(state)
  assert.equal(state.status, STATUS.FAILED)
  assert.equal(expeditionSummary(state).energyRemaining, 0)
})

test('budgets and cruise speeds stay inside the challenge range', () => {
  assert.equal(BETA_MIN, 0.1)
  assert.equal(BETA_MAX, 0.99)
  const stops = [stop('Alpha', [4, 0, 0], rocky('x', 'X', 5, 1.5))]
  const base = assembleExpedition(stops, {})
  const route = assembleExpedition(stops, {
    [base.legs[0].key]: 0.02,
    [base.legs[1].key]: 2,
  })
  assert.equal(route.legs[0].beta, BETA_MIN)
  assert.equal(route.legs[1].beta, BETA_MAX)
})
