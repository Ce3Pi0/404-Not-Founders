import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HAS_WEBGL } from '../lib/webgl'
import { classifyPlanet, createPlanetTexture, starColor } from '../lib/planet'

function Planet({ planet }) {
  const surface = useMemo(() => createPlanetTexture(planet), [planet])
  const look = useMemo(() => classifyPlanet(planet), [planet])
  const spin = useRef()

  useEffect(() => () => surface.texture.dispose(), [surface])

  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.05
  })

  return (
    <group rotation={[0, 0, 0.18]}>
      <mesh ref={spin}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshStandardMaterial map={surface.texture} roughness={0.9} metalness={0.03} />
      </mesh>
      <mesh scale={1.03}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial
          color={look.atmosphere}
          transparent
          opacity={0.16}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

/** Portrait of one world on its `/planet/:id` record page. */
export default function PlanetPortrait({ planet }) {
  const look = useMemo(() => classifyPlanet(planet), [planet])
  const light = useMemo(() => starColor(planet.starTeffK), [planet.starTeffK])

  if (!HAS_WEBGL) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-void text-[11px] text-ink/55"
        aria-hidden="true"
      >
        {look.label}
      </div>
    )
  }

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 35, position: [0, 0, 4.3], near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.28} />
      <directionalLight position={[2.6, 1.4, 3.4]} intensity={2.1} color={light} />
      <Planet planet={planet} />
    </Canvas>
  )
}
