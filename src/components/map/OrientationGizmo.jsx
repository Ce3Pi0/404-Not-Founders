import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const AXES = [
  { color: '#5ee7ff', vector: [1, 0, 0] },
  { color: '#ffffff', vector: [0, 1, 0] },
  { color: '#a78bfa', vector: [0, 0, 1] },
]

/** The three map axes rotate opposite the camera, so up stays up. */
function Axes({ quaternionRef }) {
  const group = useRef(null)
  const lines = useMemo(
    () =>
      AXES.map(({ color, vector }) => {
        const geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(...vector),
        ])
        return new THREE.Line(
          geometry,
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
        )
      }),
    [],
  )

  useFrame(() => {
    if (group.current && quaternionRef.current) {
      group.current.quaternion.copy(quaternionRef.current)
    }
  })

  return (
    <group ref={group}>
      {lines.map((line, index) => (
        <primitive key={`axis-${index}`} object={line} />
      ))}
      {AXES.map(({ color, vector }) => (
        <mesh key={color} position={vector}>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
      <mesh>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

export default function OrientationGizmo({ quaternionRef }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-[72px] w-[72px]">
        <Canvas camera={{ position: [0, 0, 3.2], fov: 45 }} dpr={[1, 2]} gl={{ alpha: true }}>
          <Axes quaternionRef={quaternionRef} />
        </Canvas>
      </div>
      <span className="text-[8px] tracking-[0.16em] text-white/40 uppercase">Orientation</span>
    </div>
  )
}
