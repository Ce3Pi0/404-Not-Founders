import { useMemo } from 'react'
import * as THREE from 'three'

const UP = new THREE.Vector3(0, 1, 0)

function boneColor(species, accent) {
  const color = new THREE.Color(species === 'human' ? '#ece6d2' : accent)
  color.lerp(new THREE.Color('#ffffff'), species === 'human' ? 0.06 : 0.4)
  return `#${color.getHexString()}`
}

/** A single limb/rib bone drawn as a tapered cylinder between two points. */
function Bone({ from, to, radius = 0.024, color, taper = 0.72 }) {
  const { position, quaternion, length } = useMemo(() => {
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    const direction = end.clone().sub(start)
    const span = Math.max(0.01, direction.length())
    return {
      position: start.clone().add(end).multiplyScalar(0.5).toArray(),
      quaternion: new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize()),
      length: span,
    }
  }, [from, to])

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius * taper, radius, length, 8, 1]} />
      <meshStandardMaterial color={color} roughness={0.82} metalness={0.03} />
    </mesh>
  )
}

function Joint({ at, radius = 0.026, color }) {
  return (
    <mesh position={at}>
      <sphereGeometry args={[radius, 12, 12]} />
      <meshStandardMaterial color={color} roughness={0.8} metalness={0.03} />
    </mesh>
  )
}

/**
 * Anatomically-shaped skeleton: cranium with jaw and eye sockets, a vertebral
 * column, a ribcage with sternum, pelvis, and two-bone limbs with joints and
 * hands. The alien skeleton is deliberately different from the human one —
 * elongated cranium, larger orbits, extra ribs and an extra finger joint.
 */
export default function SkeletonFigure({ shape, species = 'human', accent = '#9a0680' }) {
  const { legH, bodyH, bodyW, headR, armL } = shape
  const alien = species === 'alien'
  const color = boneColor(species, accent)
  const boneRadius = (alien ? 0.02 : 0.026) * 1
  const hipY = legH
  const shoulderY = legH + bodyH
  const spineTop = shoulderY - bodyH * 0.04
  const craniumY = shoulderY + headR * (alien ? 1.55 : 1.4)
  const headScale = alien ? [1.02, 1.32, 1.08] : [1, 1.1, 1.02]
  const eyeRadius = headR * (alien ? 0.26 : 0.16)
  const ribCount = alien ? 6 : 4

  const ribs = Array.from({ length: ribCount }, (_, index) => {
    const t = (index + 0.6) / (ribCount + 0.2)
    const y = hipY + bodyH * (0.22 + t * 0.66)
    const span = bodyW * (0.86 + Math.sin(t * Math.PI) * 0.3)
    return { y, span, index }
  })

  const fingers = Array.from({ length: alien ? 5 : 4 }, (_, index) => index)

  return (
    <group>
      {/* pelvis */}
      <mesh position={[0, hipY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[bodyW * 0.46, 0.026, 8, 20]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <Bone from={[-bodyW * 0.4, hipY, 0]} to={[bodyW * 0.4, hipY, 0]} radius={0.03} color={color} />

      {/* legs: femur, tibia, foot */}
      {[-1, 1].map((side) => {
        const hip = [side * bodyW * 0.28, hipY - 0.01, 0]
        const knee = [side * bodyW * 0.3, legH * 0.52, alien ? 0.02 : 0]
        const ankle = [side * bodyW * 0.26, 0.045, 0]
        return (
          <group key={`leg-${side}`}>
            <Bone from={hip} to={knee} radius={boneRadius * 1.25} color={color} />
            <Bone from={knee} to={ankle} radius={boneRadius} color={color} taper={0.6} />
            <Joint at={knee} radius={boneRadius * 1.3} color={color} />
            <Joint at={ankle} radius={boneRadius * 1.1} color={color} />
            <Bone from={ankle} to={[side * bodyW * 0.26, 0.025, 0.11]} radius={boneRadius * 0.8} color={color} />
            {fingers.slice(0, 3).map((toe) => (
              <Bone
                key={`toe-${side}-${toe}`}
                from={[side * bodyW * 0.26 + (toe - 1) * 0.022, 0.024, 0.1]}
                to={[side * bodyW * 0.26 + (toe - 1) * 0.045, 0.02, 0.15]}
                radius={boneRadius * 0.42}
                color={color}
              />
            ))}
          </group>
        )
      })}

      {/* vertebral column */}
      {Array.from({ length: 7 }, (_, index) => {
        const t = index / 6
        return (
          <mesh key={`vertebra-${index}`} position={[0, hipY + (spineTop - hipY) * t, -bodyW * 0.02]}>
            <sphereGeometry args={[0.02 + (1 - t) * 0.012, 10, 10]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
        )
      })}

      {/* ribcage + sternum */}
      {ribs.map((rib) => (
        <mesh key={`rib-${rib.index}`} position={[0, rib.y, -bodyW * 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[rib.span, 0.014, 6, 18, Math.PI * 1.35]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      ))}
      <Bone
        from={[0, hipY + bodyH * 0.32, bodyW * 0.42]}
        to={[0, hipY + bodyH * 0.86, bodyW * 0.4]}
        radius={0.018}
        color={color}
        taper={0.85}
      />

      {/* shoulders and arms */}
      {[-1, 1].map((side) => {
        const shoulder = [side * bodyW * 0.52, shoulderY - 0.015, 0]
        const elbow = [side * (bodyW * 0.62), shoulderY - armL * 0.58, 0.01]
        const wrist = [side * (bodyW * 0.68), shoulderY - armL * 1.02, 0.02]
        return (
          <group key={`arm-${side}`}>
            <Bone from={[0, shoulderY - 0.02, 0]} to={shoulder} radius={boneRadius * 0.7} color={color} />
            <Bone from={shoulder} to={elbow} radius={boneRadius * 0.95} color={color} />
            <Bone from={elbow} to={wrist} radius={boneRadius * 0.8} color={color} taper={0.6} />
            <Joint at={shoulder} radius={boneRadius * 1.25} color={color} />
            <Joint at={elbow} radius={boneRadius * 1.1} color={color} />
            <Joint at={wrist} radius={boneRadius * 0.9} color={color} />
            {fingers.map((finger) => (
              <Bone
                key={`finger-${side}-${finger}`}
                from={[wrist[0], wrist[1], wrist[2]]}
                to={[
                  wrist[0] + side * (0.02 + finger * 0.008),
                  wrist[1] - 0.055 - finger * 0.012,
                  wrist[2] + (finger - 1) * 0.016,
                ]}
                radius={boneRadius * 0.3}
                color={color}
                taper={0.55}
              />
            ))}
          </group>
        )
      })}

      {/* neck */}
      <Bone from={[0, spineTop, 0]} to={[0, shoulderY + headR * 0.55, 0]} radius={boneRadius * 0.9} color={color} />

      {/* cranium, jaw, orbits */}
      <group position={[0, craniumY, 0]}>
        <mesh scale={headScale}>
          <sphereGeometry args={[headR, 26, 26]} />
          <meshStandardMaterial color={color} roughness={0.78} metalness={0.02} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={`socket-${side}`}
            position={[side * headR * (alien ? 0.38 : 0.3), headR * 0.06, headR * 0.74]}
          >
            <sphereGeometry args={[eyeRadius, 14, 14]} />
            <meshStandardMaterial color="#160040" roughness={0.55} />
          </mesh>
        ))}
        {/* nasal cavity */}
        <mesh position={[0, -headR * 0.22, headR * 0.9]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[headR * 0.1, headR * 0.22, 6]} />
          <meshStandardMaterial color="#160040" roughness={0.6} />
        </mesh>
        {/* teeth and jaw */}
        <mesh position={[0, -headR * 0.44, headR * 0.46]}>
          <boxGeometry args={[headR * 0.62, headR * 0.16, headR * 0.4]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
        <mesh position={[0, -headR * 0.55, headR * 0.34]}>
          <boxGeometry args={[headR * 0.5, headR * 0.09, headR * 0.3]} />
          <meshStandardMaterial color={alien ? accent : '#c9c2ad'} roughness={0.85} />
        </mesh>
        {Array.from({ length: alien ? 8 : 6 }, (_, index) => (
          <mesh
            key={`tooth-${index}`}
            position={[
              (-0.5 + index / (alien ? 7 : 5)) * headR * 0.5,
              -headR * 0.36,
              headR * 0.66,
            ]}
          >
            <boxGeometry args={[headR * 0.05, headR * 0.09, headR * 0.04]} />
            <meshStandardMaterial color="#ffffff" roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
