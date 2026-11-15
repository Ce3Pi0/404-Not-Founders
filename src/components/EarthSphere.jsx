import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import earthDayMap from '../assets/earth/earth_atmos_2048.jpg'
import earthNormalMap from '../assets/earth/earth_normal_2048.jpg'
import earthSpecularMap from '../assets/earth/earth_specular_2048.jpg'
import earthCloudMap from '../assets/earth/earth_clouds_1024.png'

/**
 * Earth is the one world we have real imagery for, so every scene that draws it
 * shares one Blue Marble surface: NASA's day colour, terrain relief, ocean gloss
 * and a separate cloud shell. A scene owns its own camera, lighting and scale;
 * this owns only the surface, so the Earth close-up, the planet stage and the
 * Solar System view all show the same recognisable continents and oceans.
 */
function BlueMarble({ radius, segments, cloudOpacity, emissive }) {
  const [day, normal, specular, clouds] = useLoader(THREE.TextureLoader, [
    earthDayMap,
    earthNormalMap,
    earthSpecularMap,
    earthCloudMap,
  ])
  const cloudShell = useRef()

  useMemo(() => {
    day.colorSpace = THREE.SRGBColorSpace
    clouds.colorSpace = THREE.SRGBColorSpace
    for (const texture of [day, normal, specular, clouds]) {
      texture.anisotropy = 8
      texture.wrapS = THREE.RepeatWrapping
    }
  }, [day, normal, specular, clouds])

  useFrame((_, delta) => {
    // Clouds drift a little faster than the ground below them.
    if (cloudShell.current) cloudShell.current.rotation.y += delta * 0.009
  })

  return (
    <>
      <mesh scale={radius}>
        <sphereGeometry args={[1, segments, segments]} />
        {/* A backlit close-up (the Earth view with the Sun in frame) needs a
            little earthshine; a lit system view does not. */}
        <meshPhongMaterial
          map={day}
          normalMap={normal}
          normalScale={[0.85, 0.85]}
          specularMap={specular}
          specular="#93b8e8"
          shininess={22}
          emissiveMap={emissive ? day : null}
          emissive={emissive ? '#2f5f9e' : '#000000'}
          emissiveIntensity={emissive ? 0.24 : 0}
        />
      </mesh>
      <mesh ref={cloudShell} scale={radius * 1.007}>
        <sphereGeometry args={[1, Math.min(segments, 128), Math.min(segments, 128)]} />
        <meshStandardMaterial
          map={clouds}
          transparent
          opacity={cloudOpacity}
          roughness={1}
          metalness={0}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}

/** Shown for the moment the maps are still decoding. */
function EarthPlaceholder({ radius }) {
  return (
    <mesh scale={radius}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color="#1b4f8c" roughness={0.9} metalness={0.03} />
    </mesh>
  )
}

export default function EarthSphere({
  radius = 1,
  segments = 128,
  cloudOpacity = 0.86,
  emissive = false,
}) {
  return (
    <Suspense fallback={<EarthPlaceholder radius={radius} />}>
      <BlueMarble
        radius={radius}
        segments={segments}
        cloudOpacity={cloudOpacity}
        emissive={emissive}
      />
    </Suspense>
  )
}
