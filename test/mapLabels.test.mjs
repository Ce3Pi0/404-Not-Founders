// Regression tests for the star map's label rules.
//
// GJ 1061 used to disappear from the map the moment another system was hovered,
// because the label list was a fixed-length queue of whatever happened to be
// near the focus. Persistent labels are now mandatory and ignore the cap.

import test from 'node:test'
import assert from 'node:assert/strict'

import { LABEL_LIMIT, PERSISTENT_LABEL_NAMES, labelSystems } from '../src/lib/mapLabels.js'

const system = (name, distanceLy = 10) => ({ name, distanceLy, planets: [] })

const GJ_1061 = system('GJ 1061', 11.98)
const SOLAR = system('Solar System', 0)
const TRAPPIST = system('TRAPPIST-1', 12.5)
const PROXIMA = system('Proxima Cen', 4.2)
const DESTINATION = system('Kepler-22', 190)

const nearby = Array.from({ length: 20 }, (_, index) => system(`Nearby ${index}`, index + 1))

test('GJ 1061 stays labelled while another system is hovered', () => {
  const labels = labelSystems({
    selected: TRAPPIST,
    hovered: PROXIMA,
    origin: SOLAR,
    destination: DESTINATION,
    nearby,
    persistent: [GJ_1061],
  })
  const names = labels.map((entry) => entry.name)
  assert.ok(names.includes('GJ 1061'))
  assert.ok(names.includes(PROXIMA.name))
  assert.ok(names.includes(TRAPPIST.name))
  // Same result with nothing selected — the hover alone cannot hide it.
  const hoverOnly = labelSystems({
    selected: null,
    hovered: PROXIMA,
    nearby,
    persistent: [GJ_1061],
  }).map((entry) => entry.name)
  assert.ok(hoverOnly.includes('GJ 1061'))
  assert.ok(hoverOnly.includes(PROXIMA.name))
})

test('the cap never removes a mandatory label', () => {
  const labels = labelSystems({
    selected: TRAPPIST,
    hovered: PROXIMA,
    origin: SOLAR,
    destination: DESTINATION,
    nearby,
    persistent: [GJ_1061],
  })
  const names = labels.map((entry) => entry.name)
  for (const name of ['TRAPPIST-1', 'Proxima Cen', 'Solar System', 'Kepler-22', 'GJ 1061']) {
    assert.ok(names.includes(name), `${name} was dropped by the cap`)
  }
  // Fill still respects the cap once the mandatory names are in.
  assert.ok(labels.length <= LABEL_LIMIT)
})

test('mandatory labels survive even when they exceed the cap', () => {
  const landmarks = Array.from({ length: LABEL_LIMIT }, (_, index) => system(`Landmark ${index}`))
  const labels = labelSystems({
    selected: TRAPPIST,
    hovered: PROXIMA,
    origin: SOLAR,
    destination: DESTINATION,
    nearby: landmarks,
    persistent: [GJ_1061, ...landmarks],
  })
  const names = labels.map((entry) => entry.name)
  // Twelve persistent landmarks plus the four roles is more than the cap: all stay.
  assert.equal(names.length, LABEL_LIMIT + 5)
  assert.ok(names.includes('Landmark 11'))
  assert.ok(names.includes('GJ 1061'))
})

test('no system is labelled twice', () => {
  const labels = labelSystems({
    selected: TRAPPIST,
    hovered: TRAPPIST,
    origin: TRAPPIST,
    destination: TRAPPIST,
    nearby: [TRAPPIST, ...nearby],
    persistent: [TRAPPIST, GJ_1061],
  })
  const names = labels.map((entry) => entry.name)
  assert.equal(new Set(names).size, names.length)
})

test('persistent names are the documented set', () => {
  assert.ok(PERSISTENT_LABEL_NAMES.includes('GJ 1061'))
})

test('nearby systems fill the remaining slots', () => {
  const labels = labelSystems({
    selected: SOLAR,
    nearby,
    persistent: [GJ_1061],
  })
  assert.equal(labels.length, LABEL_LIMIT)
  assert.equal(labels[0].name, 'Solar System')
  assert.equal(labels[1].name, 'GJ 1061')
})
