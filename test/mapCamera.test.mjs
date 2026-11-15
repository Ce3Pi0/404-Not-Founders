// Tests for the map's camera framing helpers.
//
// "Frame the route" must always fit both systems on screen and keep the map's
// oblique viewing angle; a same-system hop must never produce a degenerate
// camera sitting on top of the target.

import test from 'node:test'
import assert from 'node:assert/strict'

import { HOME_CAMERA, HOME_TARGET, framingForRoute } from '../src/lib/mapCamera.js'

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

test('route framing centres on the midpoint and keeps an oblique angle', () => {
  const from = [0, 0, 0]
  const to = [0, 0, 40]
  const framing = framingForRoute(from, to)
  assert.deepEqual(framing.target, [0, 0, 20])
  // Both ends sit well inside the frustum, not on the near plane.
  for (const end of [from, to]) {
    assert.ok(distance(framing.position, end) > 20)
  }
  // Oblique: the camera is above the reference plane, not edge-on to it.
  assert.ok(framing.position[1] > 5)
})

test('a longer route pulls the camera further back', () => {
  const short = framingForRoute([0, 0, 0], [0, 0, 5])
  const long = framingForRoute([0, 0, 0], [0, 0, 120])
  assert.ok(
    distance(long.position, long.target) > distance(short.position, short.target),
    'the far route needs the wider framing',
  )
})

test('a same-system hop falls back to the home offset instead of collapsing', () => {
  const framing = framingForRoute([3, 2, 1], [3, 2, 1])
  assert.deepEqual(framing.target, [3, 2, 1])
  const offset = framing.position.map((value, index) => value - framing.target[index])
  assert.deepEqual(offset, HOME_CAMERA)
  assert.ok(distance(framing.position, framing.target) > 0)
})

test('missing endpoints return the home framing', () => {
  assert.deepEqual(framingForRoute(null, [1, 2, 3]), {
    position: [...HOME_CAMERA],
    target: [...HOME_TARGET],
  })
})
