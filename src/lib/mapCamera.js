// Camera framing for the 3D universe map, shared with the Earth orbit handoff.
// Kept out of UniverseScene so the scene module exports only its component and
// Fast Refresh keeps working while editing the map.

/**
 * Home framing. Deliberately oblique (a little above the reference plane and
 * off to one side) and close enough that the nearest dozen catalogue systems —
 * Proxima Cen, Barnard's star, GJ 1061 — are separated by real empty space in
 * the frame instead of collapsing into the Solar System marker. Distance to the
 * origin is ~17.1 ly.
 */
export const HOME_CAMERA = [8.6, 6.4, 13.8]
export const HOME_TARGET = [0, 0, 0]

/** Camera distance from the Solar origin at which the map hands back to Earth. */
export const EARTH_RETURN_DISTANCE = 2.5

/** Reference-plane rings drawn in the scene, in light-years from the Sun. */
export const GRID_RINGS_LY = [5, 10, 25, 50, 100]

/** Unit direction the camera sits along when framing a route. */
const FRAME_DIRECTION = [0.56, 0.4, 0.73]

/**
 * Camera position and target that fit both ends of a route in frame, keeping
 * the map's oblique viewing angle. Returns the home framing when the endpoints
 * coincide, so "frame the route" on a same-system hop can never produce a
 * degenerate camera.
 */
export function framingForRoute(from, to) {
  if (!from || !to) return { position: [...HOME_CAMERA], target: [...HOME_TARGET] }
  const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]
  const span = Math.hypot(from[0] - to[0], from[1] - to[1], from[2] - to[2])
  if (!(span > 0.001)) {
    return {
      position: [mid[0] + HOME_CAMERA[0], mid[1] + HOME_CAMERA[1], mid[2] + HOME_CAMERA[2]],
      target: mid,
    }
  }
  const length = Math.hypot(...FRAME_DIRECTION)
  const distance = Math.max(6, span * 1.15 + 4)
  return {
    position: [
      mid[0] + (FRAME_DIRECTION[0] / length) * distance,
      mid[1] + (FRAME_DIRECTION[1] / length) * distance,
      mid[2] + (FRAME_DIRECTION[2] / length) * distance,
    ],
    target: mid,
  }
}
