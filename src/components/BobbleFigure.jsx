import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const SHAPES = {
  baby: { legH: 0.08, bodyH: 0.2, bodyW: 0.3, headR: 0.3, armL: 0.12 },
  toddler: { legH: 0.12, bodyH: 0.26, bodyW: 0.27, headR: 0.29, armL: 0.15 },
  child: { legH: 0.17, bodyH: 0.32, bodyW: 0.24, headR: 0.28, armL: 0.18 },
  teen: { legH: 0.22, bodyH: 0.4, bodyW: 0.23, headR: 0.26, armL: 0.22 },
  adult: { legH: 0.24, bodyH: 0.46, bodyW: 0.24, headR: 0.26, armL: 0.24 },
  elderly: { legH: 0.22, bodyH: 0.42, bodyW: 0.25, headR: 0.26, armL: 0.23 },
  skeleton: { legH: 0.24, bodyH: 0.44, bodyW: 0.17, headR: 0.25, armL: 0.23 },
}

/**
 * A miniature 3D "bobble-head" that swaps proportions and details with the
 * biological stage. Humans wear flight suits; aliens share their world's palette.
 */
export default function BobbleFigure({
  stage = 'adult',
  species = 'human',
  skin = '#f2c9a4',
  accent = '#5ce1a6',
  position = [0, 0, 0],
  scale = 1,
  seed = 0,
}) {
  const bob = useRef()
  const shape = SHAPES[stage] ?? SHAPES.adult
  const human = species === 'human'
  const skeleton = stage === 'skeleton'
  const elderly = stage === 'elderly'
  const { legH, bodyH, bodyW, headR, armL } = shape

  const headY = legH + bodyH + headR * 0.82
  const bodyY = legH + bodyH / 2
  const armY = legH + bodyH * 0.72
  const bodyColor = skeleton ? '#e7e1d2' : human ? '#1e2c3e' : accent
  const headColor = skeleton ? '#efe9da' : human ? skin : accent
  const hairColor = skeleton ? null : human ? (elderly ? '#d5dbe2' : '#2a1c15') : null
  const limbRadius = skeleton ? 0.026 : 0.045

  useFrame(({ clock }) => {
    if (!bob.current) return
    const t = clock.elapsedTime + seed
    bob.current.position.y = Math.sin(t * 1.5) * 0.035
    bob.current.rotation.z = Math.sin(t * 1.05) * 0.04
  })

  return (
    <group position={position} scale={scale}>
      <group ref={bob}>
        {/* legs */}
        {[-1, 1].map((side) => (
          <mesh key={`leg-${side}`} position={[side * bodyW * 0.22, legH / 2, 0]}>
            <capsuleGeometry args={[limbRadius, Math.max(0.02, legH - limbRadius * 2), 4, 10]} />
            <meshStandardMaterial color={bodyColor} roughness={0.7} metalness={0.05} />
          </mesh>
        ))}

        {/* torso */}
        <mesh position={[0, bodyY, 0]}>
          <cylinderGeometry args={[bodyW * 0.4, bodyW * 0.47, bodyH, 18]} />
          <meshStandardMaterial color={bodyColor} roughness={0.72} metalness={0.04} />
        </mesh>

        {/* suit detail */}
        {!skeleton && (
          <mesh position={[0, bodyY + bodyH * 0.12, bodyW * 0.42]}>
            <boxGeometry args={[bodyW * 0.5, 0.035, 0.02]} />
            <meshStandardMaterial color={human ? accent : '#f6fbff'} emissive={human ? accent : '#000000'} emissiveIntensity={0.35} roughness={0.4} />
          </mesh>
        )}

        {/* skeleton ribs */}
        {skeleton &&
          [0.12, 0.28, 0.44].map((offset) => (
            <mesh key={`rib-${offset}`} position={[0, legH + bodyH * offset, 0.01]}>
              <torusGeometry args={[bodyW * 0.34, 0.012, 6, 16]} />
              <meshStandardMaterial color="#dcd5c4" roughness={0.8} />
            </mesh>
          ))}

        {/* arms */}
        {[-1, 1].map((side) => (
          <mesh
            key={`arm-${side}`}
            position={[side * (bodyW * 0.5 + 0.02), armY, 0]}
            rotation={[0, 0, side * 0.34]}
          >
            <capsuleGeometry args={[limbRadius, Math.max(0.02, armL - limbRadius * 2), 4, 10]} />
            <meshStandardMaterial color={bodyColor} roughness={0.7} metalness={0.04} />
          </mesh>
        ))}

        {/* head */}
        <mesh position={[0, headY, 0]}>
          <sphereGeometry args={[headR, 28, 28]} />
          <meshStandardMaterial color={headColor} roughness={0.62} metalness={0.02} />
        </mesh>

        {/* eyes */}
        {[-1, 1].map((side) => (
          <mesh
            key={`eye-${side}`}
            position={[side * headR * (human ? 0.34 : 0.38), headY + headR * 0.08, headR * 0.84]}
            scale={human ? [1, 1, 1] : [1.4, 1.1, 1]}
          >
            <sphereGeometry args={[headR * (skeleton ? 0.12 : human ? 0.1 : 0.15), 14, 14]} />
            <meshStandardMaterial color={skeleton ? '#141414' : '#101820'} roughness={0.25} />
          </mesh>
        ))}

        {/* hair / antennae */}
        {hairColor && (
          <mesh position={[0, headY + headR * 0.5, -headR * 0.08]} scale={[1.01, 0.62, 1.01]}>
            <sphereGeometry args={[headR, 24, 24]} />
            <meshStandardMaterial color={hairColor} roughness={0.85} />
          </mesh>
        )}
        {!human &&
          [-1, 1].map((side) => (
            <group key={`antenna-${side}`} position={[side * headR * 0.4, headY + headR * 0.86, 0]} rotation={[0, 0, side * -0.35]}>
              <mesh>
                <cylinderGeometry args={[0.012, 0.012, headR * 0.8, 6]} />
                <meshStandardMaterial color={accent} roughness={0.5} />
              </mesh>
              <mesh position={[0, headR * 0.42, 0]}>
                <sphereGeometry args={[0.035, 10, 10]} />
                <meshStandardMaterial color="#f8fbff" emissive={accent} emissiveIntensity={0.6} />
              </mesh>
            </group>
          ))}

        {/* walking cane */}
        {elderly && (
          <mesh position={[bodyW * 0.85, 0.3, 0.1]} rotation={[0, 0, -0.14]}>
            <cylinderGeometry args={[0.015, 0.015, 0.62, 6]} />
            <meshStandardMaterial color="#8a7256" roughness={0.8} />
          </mesh>
        )}

        {/* contact shadow */}
        <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[bodyW * 0.95, 24]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.32} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}
