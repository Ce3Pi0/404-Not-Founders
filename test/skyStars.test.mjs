import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CATALOG_MIN_SEPARATION_DEG,
  angularSeparationDeg,
  thinSkyStars,
} from '../src/lib/skyStars.js'

/** A Kepler-field-like crowd: many host stars inside a couple of degrees. */
function crowd(count, raOffset = 0) {
  const systems = []
  for (let i = 0; i < count; i += 1) {
    systems.push({
      name: `crowd-${i}`,
      ra: 295 + raOffset + (i % 20) * 0.05,
      dec: 44 + Math.floor(i / 20) * 0.05,
    })
  }
  return systems
}

test('a crowded field is thinned instead of drawn as one dense disc', () => {
  const systems = crowd(400)
  const kept = thinSkyStars(systems)
  assert.ok(kept.length < systems.length / 4, `kept ${kept.length} of ${systems.length}`)
  assert.ok(kept.length > 0)
})

test('every kept star stands at least the minimum distance from the others', () => {
  const kept = thinSkyStars([...crowd(400), ...crowd(400, 2.5)])
  for (let i = 0; i < kept.length; i += 1) {
    for (let j = i + 1; j < kept.length; j += 1) {
      assert.ok(
        angularSeparationDeg(kept[i], kept[j]) >= CATALOG_MIN_SEPARATION_DEG,
        `${kept[i].name} and ${kept[j].name} are closer than the minimum separation`,
      )
    }
  }
})

test('the minimum separation holds near the celestial pole', () => {
  const polar = [
    { name: 'p1', ra: 100, dec: 89.6 },
    { name: 'p2', ra: 140, dec: 89.9 },
    { name: 'p3', ra: 10, dec: 89.2 },
  ]
  const kept = thinSkyStars(polar)
  assert.ok(kept.length < polar.length, 'near-polar neighbours were all kept')
  for (let i = 0; i < kept.length; i += 1) {
    for (let j = i + 1; j < kept.length; j += 1) {
      assert.ok(angularSeparationDeg(kept[i], kept[j]) >= CATALOG_MIN_SEPARATION_DEG)
    }
  }
})

test('sparse sky keeps every star in its original order', () => {
  const sparse = [
    { name: 'a', ra: 10, dec: 10 },
    { name: 'b', ra: 120, dec: -20 },
    { name: 'c', ra: 250, dec: 60 },
    { name: 'd', ra: 300, dec: -70 },
  ]
  assert.deepEqual(
    thinSkyStars(sparse).map((system) => system.name),
    ['a', 'b', 'c', 'd'],
  )
})

test('missing coordinates never throw', () => {
  const kept = thinSkyStars([{ name: 'no-coords-a' }, { name: 'no-coords-b' }])
  assert.equal(kept.length, 2)
})
