// Sky-space thinning for the decorative star layers.
//
// The archive is overwhelmingly Kepler/K2 discoveries, and those host stars sit
// inside a few square degrees of sky. Drawn one sprite per system, that field
// fuses into a dense disc of overlapping dots — a circle that reads as a
// rendering artifact (an Earth-view bug report) rather than a sky. Keeping only
// stars that stand at least a minimum angular distance apart spreads the crowd
// back into separate stars; thinly populated sky is untouched, because its
// systems already stand alone.

/** Smallest gap between two kept catalogue stars, in degrees. */
export const CATALOG_MIN_SEPARATION_DEG = 0.8

const DEG = Math.PI / 180

/** Unit vector for a sky position; null when the archive carried no position. */
function skyVector(raDeg, decDeg) {
  if (!Number.isFinite(raDeg) || !Number.isFinite(decDeg)) return null
  const ra = raDeg * DEG
  const dec = decDeg * DEG
  return {
    x: Math.cos(dec) * Math.cos(ra),
    y: Math.sin(dec),
    z: Math.cos(dec) * Math.sin(ra),
  }
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/** Angular separation between two RA/Dec positions, in degrees. */
export function angularSeparationDeg(a, b) {
  const first = skyVector(a.ra, a.dec)
  const second = skyVector(b.ra, b.dec)
  if (!first || !second) return 180
  return Math.acos(Math.min(1, Math.max(-1, dot(first, second)))) / DEG
}

/**
 * Keep at most one star per patch of sky, in input order, so callers decide
 * which star wins a crowded patch by ordering their list.
 *
 * A minimum angular distance is guaranteed rather than assumed: candidates are
 * hashed into a 3D grid whose cells are one chord apart, so only the 27
 * neighbouring cells can hold a closer star.
 */
export function thinSkyStars(systems, minSeparationDeg = CATALOG_MIN_SEPARATION_DEG) {
  const minCos = Math.cos(minSeparationDeg * DEG)
  const chord = 2 * Math.sin((minSeparationDeg * DEG) / 2)
  const buckets = new Map()
  const kept = []

  for (const system of systems) {
    const vector = skyVector(system.ra, system.dec)
    if (vector) {
      const ix = Math.floor(vector.x / chord)
      const iy = Math.floor(vector.y / chord)
      const iz = Math.floor(vector.z / chord)
      let crowded = false
      for (let dx = -1; dx <= 1 && !crowded; dx += 1) {
        for (let dy = -1; dy <= 1 && !crowded; dy += 1) {
          for (let dz = -1; dz <= 1 && !crowded; dz += 1) {
            const nearby = buckets.get(`${ix + dx}|${iy + dy}|${iz + dz}`)
            if (!nearby) continue
            for (const other of nearby) {
              if (dot(vector, other) >= minCos) {
                crowded = true
                break
              }
            }
          }
        }
      }
      if (crowded) continue
      const key = `${ix}|${iy}|${iz}`
      const bucket = buckets.get(key)
      if (bucket) bucket.push(vector)
      else buckets.set(key, [vector])
    }
    kept.push(system)
  }

  return kept
}
