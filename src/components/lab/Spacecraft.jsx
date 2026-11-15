import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Procedural spacecraft. The nose points down −Z, the engine plume trails
 * toward +Z, matching the direction of travel used by every flight scene.
 */
export default function Spacecraft({ glow = '#5ee7ff', engine = 1, scale = 1, detail = true, light = 5 }) {
  const plume = useRef()
  const beacon = useRef()

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (plume.current) {
      plume.current.material.opacity = 0.28 + 0.34 * engine * (0.72 + 0.28 * Math.sin(t * 21))
      plume.current.scale.z = 0.85 + 0.2 * engine * Math.sin(t * 17)
    }
    if (beacon.current) {
      beacon.current.material.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 4.2))
    }
  })

  return (
    <group scale={scale}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.34, 0.44, 1.8, 26]} />
        <meshStandardMaterial color="#dfe9f5" metalness={0.78} roughness={0.26} />
      </mesh>

      <mesh position={[0, 0, -1.16]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.34, 0.74, 26]} />
        <meshStandardMaterial color="#f2f8ff" metalness={0.55} roughness={0.2} />
      </mesh>

      <mesh position={[0, 0, -0.42]}>
        <boxGeometry args={[0.5, 0.2, 0.5]} />
        <meshStandardMaterial color="#223247" metalness={0.4} roughness={0.35} emissive="#5ee7ff" emissiveIntensity={0.35} />
      </mesh>

      <mesh position={[0, 0, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.46, 0.035, 8, 32]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>

      {[0, 1, 2].map((index) => {
        const angle = (index / 3) * Math.PI * 2
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 0.48, Math.sin(angle) * 0.48, 0.62]}
            rotation={[0, 0, angle]}
          >
            <boxGeometry args={[0.42, 0.06, 0.66]} />
            <meshStandardMaterial color="#9db0c8" metalness={0.62} roughness={0.34} />
          </mesh>
        )
      })}

      {detail && (
        <>
          <mesh position={[0, 0.3, 0.1]}>
            <boxGeometry args={[0.08, 0.12, 0.9]} />
            <meshStandardMaterial color="#8195ad" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh ref={beacon} position={[0, 0.4, -0.32]}>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshBasicMaterial color="#ff7a7a" transparent toneMapped={false} />
          </mesh>
        </>
      )}

      <mesh ref={plume} position={[0, 0, 1.3]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.24, 1.5, 20, 1, true]} />
        <meshBasicMaterial
          color={glow}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <pointLight position={[0, 0, 1.9]} color={glow} intensity={light} distance={14} decay={2} />
    </group>
  )
}
