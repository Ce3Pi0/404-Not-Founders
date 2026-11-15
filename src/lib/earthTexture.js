import { useEffect, useState } from 'react'
import * as THREE from 'three'

/**
 * Earth is the one world whose surface is actually known, so it does not use an
 * inferred palette like the archive planets. The day map, relief, ocean glint,
 * cloud shell and night-side city lights are real NASA Blue Marble imagery
 * bundled at `public/textures`, which is what makes the home world read as the
 * planet from orbit instead of a painted sphere.
 */

export const EARTH_ATMOSPHERE = '#6fb4ff'

/**
 * Direction (from Earth's centre, world space) of the light that defines the day
 * side. `PlanetStage` aims the host star this way for Earth, and the night-lights
 * shell masks its cities against the same direction.
 */
export const EARTH_SUN_DIRECTION = [0.82, 0.34, 0.46]

const MAPS = {
  surface: '/textures/earth_day.jpg',
  normal: '/textures/earth_normal.jpg',
  specular: '/textures/earth_specular.jpg',
  clouds: '/textures/earth_clouds.png',
  lights: '/textures/earth_lights.png',
}

const loader = new THREE.TextureLoader()
let cache = null
let pending = null

function prepare(texture, srgb) {
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

const load = (url, srgb = true) =>
  new Promise((resolve, reject) => {
    loader.load(url, (texture) => resolve(prepare(texture, srgb)), undefined, reject)
  })

/** Loads the five maps once; later callers share the same textures. */
export function preloadEarthTextures() {
  if (cache) return Promise.resolve(cache)
  if (!pending) {
    pending = Promise.all([
      load(MAPS.surface),
      load(MAPS.normal, false),
      load(MAPS.specular, false),
      load(MAPS.clouds, false),
      load(MAPS.lights),
    ]).then(([surface, normal, specular, clouds, lights]) => {
      cache = { surface, normal, specular, clouds, lights }
      return cache
    })
  }
  return pending
}

/** Earth's maps, or `null` while the images are still decoding. */
export function useEarthTextures() {
  const [textures, setTextures] = useState(cache)

  useEffect(() => {
    if (textures) return undefined
    let mounted = true
    preloadEarthTextures().then((loaded) => {
      if (mounted) setTextures(loaded)
    })
    return () => {
      mounted = false
    }
  }, [textures])

  return textures
}
