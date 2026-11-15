// Regression tests for the Earth-orbit ↔ star-map zoom handoff.
//
// The old rule accumulated raw `deltaY` and needed 220 of it while the camera
// sat at 97% of its maximum distance — unreachable on a trackpad, and reset by
// any event that arrived a pixel early. The latch below is unit-tested for both
// wheel units and both directions.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ZOOM_OUT_THRESHOLD_PX,
  createZoomOutLatch,
  wheelPixels,
} from '../src/lib/zoomTransition.js'

test('wheel deltas are normalised across pixel, line and page modes', () => {
  assert.equal(wheelPixels({ deltaY: 100, deltaMode: 0 }), 100)
  // A line-mode wheel reports a handful of lines, not pixels.
  assert.equal(wheelPixels({ deltaY: 3, deltaMode: 1 }), 48)
  assert.equal(wheelPixels({ deltaY: 1, deltaMode: 2 }), 400)
  assert.equal(wheelPixels({}), 0)
})

test('a coarse wheel and a trackpad both earn the handoff', () => {
  // Two mouse notches.
  const mouse = createZoomOutLatch()
  assert.equal(mouse.push(wheelPixels({ deltaY: 100 }), true), false)
  assert.equal(mouse.push(wheelPixels({ deltaY: 100 }), true), true)

  // A long run of small trackpad events.
  const trackpad = createZoomOutLatch()
  let fired = false
  for (let i = 0; i < 40 && !fired; i += 1) {
    fired = trackpad.push(wheelPixels({ deltaY: 4 }), true)
  }
  assert.equal(fired, true)

  // Line-mode wheel: 3 lines per notch.
  const lines = createZoomOutLatch()
  let lineFired = false
  for (let i = 0; i < 5 && !lineFired; i += 1) {
    lineFired = lines.push(wheelPixels({ deltaY: 3, deltaMode: 1 }), true)
  }
  assert.equal(lineFired, true)
})

test('the latch fires once and does not repeat on the next event', () => {
  const latch = createZoomOutLatch()
  let fires = 0
  for (let i = 0; i < 20; i += 1) {
    if (latch.push(100, true)) fires += 1
  }
  // 2000px of outward travel at a 150px threshold refills the latch every
  // other 100px event — never twice for a single event.
  assert.equal(fires, 10)
  assert.equal(latch.push(50, true), false)
})

test('nothing accumulates away from the zoom limit', () => {
  const latch = createZoomOutLatch()
  for (let i = 0; i < 10; i += 1) {
    assert.equal(latch.push(100, false), false)
  }
  // Reaching the limit starts from zero, then earns the handoff normally.
  assert.equal(latch.push(100, true), false)
  assert.equal(latch.push(100, true), true)
})

test('scrolling back in resets the gesture', () => {
  const latch = createZoomOutLatch()
  latch.push(ZOOM_OUT_THRESHOLD_PX - 10, true)
  assert.equal(latch.push(-40, true), false)
  assert.equal(latch.pulled, 0)
  assert.equal(latch.push(ZOOM_OUT_THRESHOLD_PX - 10, true), false)
  assert.equal(latch.push(20, true), true)
})

test('a page scroll that never reaches the limit can never hand off', () => {
  const latch = createZoomOutLatch()
  for (let i = 0; i < 50; i += 1) {
    assert.equal(latch.push(120, false), false)
  }
})
