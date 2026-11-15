// Regression tests for the Solar System data normalisation.
//
// The attached Solar System OpenData extract is the source of truth for the
// eight planets' orbital distances and physical properties; these tests pin the
// conversions the catalogue and the renderer both depend on.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  AU_KM,
  EARTH_MASS_KG,
  EARTH_RADIUS_KM,
  SOLAR_PLANET_ORDER,
  SOLAR_SYSTEM_NAME,
  buildSolarPlanets,
  normalizeSolarBody,
} from '../src/lib/solarSystem.js'

const dataset = JSON.parse(
  readFileSync(new URL('../src/data/solarSystem.json', import.meta.url), 'utf8'),
)
const planets = buildSolarPlanets(dataset.bodies)

test('the eight planets are normalised, in orbital order, with no duplicates', () => {
  assert.deepEqual(
    planets.map((planet) => planet.id),
    SOLAR_PLANET_ORDER,
  )
  assert.equal(new Set(planets.map((planet) => planet.id)).size, 8)
  assert.equal(planets.filter((planet) => planet.name === 'Earth').length, 1)
})

test('every Solar System planet orbits the Sun and sits at the origin of the map', () => {
  for (const planet of planets) {
    assert.equal(planet.star, SOLAR_SYSTEM_NAME)
    // Zero light-years from the Solar origin — never the orbital distance.
    assert.equal(planet.distanceLy, 0)
    assert.deepEqual(planet.position, [0, 0, 0])
    // Sun's stellar properties are carried by every record.
    assert.equal(planet.starMassSun, 1)
    assert.equal(planet.starRadiusSun, 1)
    assert.equal(planet.starTeffK, 5772)
  }
})

test('orbital distances convert from kilometres to AU', () => {
  const earth = planets.find((planet) => planet.id === 'earth')
  assert.ok(Math.abs(earth.semiMajorAxisAu - 1) < 1e-5, `${earth.semiMajorAxisAu} AU for Earth`)

  const neptune = planets.find((planet) => planet.id === 'neptune')
  // 4,498,396,441 km ÷ 149,597,870.7 km
  assert.ok(Math.abs(neptune.semiMajorAxisAu - 30.07) < 0.02)

  const expected = 57909050 / AU_KM
  const mercury = planets.find((planet) => planet.id === 'mercury')
  assert.ok(Math.abs(mercury.semiMajorAxisAu - expected) < 1e-9)

  // Order is orbital, so the semi-major axes are strictly increasing.
  const axes = planets.map((planet) => planet.semiMajorAxisAu)
  assert.deepEqual(axes, [...axes].sort((a, b) => a - b))
})

test('mass and radius use the documented reference constants', () => {
  const mars = normalizeSolarBody(dataset.bodies.find((body) => body.id === 'mars'))
  const massKg = 6.41712e23
  assert.ok(Math.abs(mars.massEarthMeasured - massKg / EARTH_MASS_KG) < 1e-12)
  assert.ok(Math.abs(mars.radiusEarthMeasured - 3389.5 / EARTH_RADIUS_KM) < 1e-12)
  // Measured, so the record is not flagged as an estimate and the source says so.
  assert.equal(mars.bulkEstimated, undefined)
  assert.match(mars.massSource, /measurement/)

  const jupiter = planets.find((planet) => planet.id === 'jupiter')
  assert.ok(jupiter.radiusEarthMeasured > 10 && jupiter.radiusEarthMeasured < 12)
  assert.ok(jupiter.massEarthMeasured > 300 && jupiter.massEarthMeasured < 330)
})

test('periods, temperatures and extra fields survive normalisation', () => {
  const earth = planets.find((planet) => planet.id === 'earth')
  assert.ok(Math.abs(earth.orbitalPeriodDays - 365.256) < 1e-9)
  // avgTemp is already kelvin in this extract, so Earth reads 288 K.
  assert.equal(earth.meanTempK, 288)
  assert.equal(earth.axialTiltDeg, 23.4393)

  const neptune = planets.find((planet) => planet.id === 'neptune')
  assert.ok(Math.abs(neptune.eccentricity - 0.0113) < 1e-12)
  assert.ok(Math.abs(neptune.inclinationDeg - 1.769) < 1e-12)
  assert.ok(neptune.surfaceGravityMs2 > 11 && neptune.surfaceGravityMs2 < 12)
  assert.ok(neptune.escapeVelocityMs > 23000)
})

test('zero placeholders are treated as unknown, not as measurements', () => {
  const mercury = planets.find((planet) => planet.id === 'mercury')
  // The extract reports avgTemp 0 for Mercury, which means "not reported".
  assert.equal(mercury.meanTempK, null)

  const zeroed = normalizeSolarBody({
    id: 'venus',
    englishName: 'Venus',
    isPlanet: true,
    semimajorAxis: 0,
    meanRadius: 0,
    density: 0,
    mass: { massValue: 0, massExponent: 0 },
  })
  assert.equal(zeroed.semiMajorAxisAu, null)
  assert.equal(zeroed.radiusEarthMeasured, null)
  assert.equal(zeroed.massEarthMeasured, null)
  assert.equal(zeroed.densityGcc, null)
})

test('only planets are imported — a Sun or moon row never becomes a world', () => {
  assert.equal(normalizeSolarBody({ id: 'soleil', englishName: 'Sun', isPlanet: false }), null)
  assert.equal(
    normalizeSolarBody({ id: 'lune', englishName: 'Moon', isPlanet: false }),
    null,
  )
  // A duplicate row cannot add a second Earth.
  const duplicated = buildSolarPlanets([...dataset.bodies, dataset.bodies[6]])
  assert.equal(duplicated.filter((planet) => planet.id === 'earth').length, 1)
  assert.equal(duplicated.length, 8)
})

test('stable ids keep deep links working', () => {
  assert.equal(normalizeSolarBody({ id: 'terre', isPlanet: true }).id, 'earth')
  assert.equal(normalizeSolarBody({ id: 'saturne', isPlanet: true }).id, 'saturn')
  assert.equal(normalizeSolarBody({ id: 'mercure', isPlanet: true }).id, 'mercury')
  const earth = planets.find((planet) => planet.id === 'earth')
  assert.equal(earth.kind, 'earth')
  for (const planet of planets.filter((entry) => entry.id !== 'earth')) {
    assert.equal(planet.kind, 'solar')
  }
})
