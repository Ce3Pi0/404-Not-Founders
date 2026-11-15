// Camera placement for the three Live Flight perspectives.
//
// Every camera is driven by the same route basis and the same progress
// fraction, so all panels always agree with the simulation. The bird's-eye and
// departure-observer cameras add the user's own orbit (yaw, pitch, zoom)
// around their target; the cockpit is fixed forward, where rotation would only
// mean turning away from the direction of travel.

import * as THREE from 'three'

export const PERSPECTIVE_FOV = { external: 50, observer: 55, cockpit: 72 }

export const ORBIT_LIMITS = { minZoom: 0.35, maxZoom: 4.5, maxPitch: 1.3 }

/**
 * Framing chosen to match the original single-view scene:
 * bird's-eye ≈ 0.18 route spans out and above, observer ≈ 0.14 near the origin.
 */
export const DEFAULT_ORBIT = {
  external: { yaw: -0.43, pitch: 0.58, zoom: 1 },
  observer: { yaw: 0.29, pitch: 0.62, zoom: 1 },
  cockpit: { yaw: 0, pitch: 0, zoom: 1 },
}

export function freshOrbit(perspective) {
  const preset = DEFAULT_ORBIT[perspective] ?? DEFAULT_ORBIT.external
  return { ...preset }
}

const ship = new THREE.Vector3()
const offset = new THREE.Vector3()
const target = new THREE.Vector3()

/** Offset from a target in the route's own basis: right × up × travel direction. */
function orbitOffset(route, orbit, radius) {
  const cosPitch = Math.cos(orbit.pitch)
  return offset
    .copy(route.right)
    .multiplyScalar(Math.cos(orbit.yaw) * cosPitch)
    .addScaledVector(route.up, Math.sin(orbit.pitch))
    .addScaledVector(route.dir, Math.sin(orbit.yaw) * cosPitch)
    .multiplyScalar(radius * orbit.zoom)
}

export function placeCamera(camera, perspective, route, progress, orbit) {
  const state = orbit ?? DEFAULT_ORBIT[perspective] ?? DEFAULT_ORBIT.external
  camera.fov = PERSPECTIVE_FOV[perspective] ?? 55
  camera.near = Math.max(route.span * 1e-6, 1e-6)
  camera.far = route.span * 220
  camera.up.copy(route.up)

  ship.copy(route.from).addScaledVector(route.dir, route.span * progress)

  if (perspective === 'cockpit') {
    camera.position
      .copy(ship)
      .addScaledVector(route.dir, route.span * 0.002)
      .addScaledVector(route.up, route.span * 0.0006)
    target.copy(ship).addScaledVector(route.dir, route.span)
    camera.lookAt(target)
  } else if (perspective === 'observer') {
    camera.position.copy(route.from).add(orbitOffset(route, state, route.span * 0.14))
    target.copy(route.from).lerp(ship, 0.4)
    camera.lookAt(target)
  } else {
    target.copy(ship).addScaledVector(route.dir, route.span * 0.07)
    camera.position.copy(target).add(orbitOffset(route, state, route.span * 0.18))
    camera.lookAt(target)
  }

  camera.updateProjectionMatrix()
}

export function clampOrbitPitch(value) {
  return Math.min(ORBIT_LIMITS.maxPitch, Math.max(-ORBIT_LIMITS.maxPitch, value))
}

export function clampOrbitZoom(value) {
  return Math.min(ORBIT_LIMITS.maxZoom, Math.max(ORBIT_LIMITS.minZoom, value))
}
