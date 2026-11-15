// Shared wheel handling for the two zoom-out handoffs:
//   · Earth orbit → star map (scroll out past the maximum orbit distance)
//   · star map → Earth orbit (scroll in through the Solar origin)
//
// Both scenes used to count raw `deltaY` values, which made the gesture depend
// on the device: a mouse notch arrives as ±100 (or ±120), a line-mode wheel as
// ±3, a page-mode wheel as ±1, and a trackpad as a stream of ±1…±10. The
// accumulator below works in pixels, normalises the three delta modes, and only
// counts outward motion while the camera is actually at its zoom limit.

const LINE_HEIGHT_PX = 16
const PAGE_HEIGHT_PX = 400

/** One wheel event's vertical travel, in pixels, whichever unit it arrived in. */
export function wheelPixels(event) {
  const delta = Number(event?.deltaY) || 0
  switch (event?.deltaMode) {
    case 1:
      return delta * LINE_HEIGHT_PX
    case 2:
      return delta * PAGE_HEIGHT_PX
    default:
      return delta
  }
}

/**
 * Outward travel needed to hand off, in normalised pixels. Two mouse notches,
 * or roughly a quarter-second of trackpad scrolling: deliberate, but nowhere
 * near the precision the old fixed-delta rule demanded.
 */
export const ZOOM_OUT_THRESHOLD_PX = 150

/**
 * A small latch that turns a stream of wheel events into a single handoff.
 *
 * `push()` returns true exactly once per earned gesture, so repeated wheel
 * events can never fire the transition twice, and any inward motion (or a
 * camera that has not reached its limit) clears the accumulated pull so the
 * state resets cleanly when the user zooms back in.
 */
export function createZoomOutLatch(threshold = ZOOM_OUT_THRESHOLD_PX) {
  let pulled = 0
  return {
    push(pixels, atLimit) {
      if (!(pixels > 0) || !atLimit) {
        pulled = 0
        return false
      }
      pulled += pixels
      if (pulled < threshold) return false
      pulled = 0
      return true
    },
    reset() {
      pulled = 0
    },
    get pulled() {
      return pulled
    },
  }
}
