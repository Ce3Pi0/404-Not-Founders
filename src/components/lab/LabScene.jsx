import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Spacecraft from './Spacecraft'
import { classifyPlanet, mulberry32, starColor } from '../../lib/planet'

const TINTS = ['#dff4ff', '#ffffff', '#ffe6b8', '#9fc9ff', '#d9c8ff']

/* ------------------------------------------------------------- starfield -- */

function StarStreaks({ beta = 0.9, count = 440, spread = 46, depth = 100 }) {
  const geometry = useMemo(() => {
    const random = mulberry32(424242)
    const positions = new Float32Array(count * 6)
    const colors = new Float32Array(count * 6)
    for (let i = 0; i < count; i += 1) {
      const x = (random() - 0.5) * spread * 2
      const y = (random() - 0.5) * spread * 1.15
      const z = -depth + random() * depth
      const tint = new THREE.Color(TINTS[Math.floor(random() * TINTS.length)])
      for (let v = 0; v < 2; v += 1) {
        positions[i * 6 + v * 3] = x
        positions[i * 6 + v * 3 + 1] = y
        positions[i * 6 + v * 3 + 2] = z - v
        colors[i * 6 + v * 3] = tint.r
        colors[i * 6 + v * 3 + 1] = tint.g
        colors[i * 6 + v * 3 + 2] = tint.b
      }
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return buffer
  }, [count, spread, depth])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    const positions = geometry.attributes.position.array
    const speed = 14 + beta * 105
    const trail = 0.35 + beta * 7
    for (let i = 0; i < count; i += 1) {
      const base = i * 6
      let z = positions[base + 2] + speed * delta
      if (z > 12) z -= depth + 12
      positions[base + 2] = z
      positions[base + 5] = z - trail
    }
    geometry.attributes.position.needsUpdate = true
  })

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  )
}

function StarField({ count = 900, radius = 110 }) {
  const geometry = useMemo(() => {
    const random = mulberry32(1337)
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const u = random() * 2 - 1
      const theta = random() * Math.PI * 2
      const r = radius * (0.55 + random() * 0.45)
      const s = Math.sqrt(1 - u * u)
      positions[i * 3] = Math.cos(theta) * s * r
      positions[i * 3 + 1] = u * r
      positions[i * 3 + 2] = Math.sin(theta) * s * r
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return buffer
  }, [count, radius])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.55} color="#d6ecff" sizeAttenuation transparent opacity={0.85} depthWrite={false} />
    </points>
  )
}

/* ---------------------------------------------------------------- planets -- */

function PlanetBall({ position = [0, 0, 0], radius = 3, palette, atmosphere, spin = 0.03 }) {
  const mesh = useRef()
  useFrame((_, delta) => {
    if (mesh.current) mesh.current.rotation.y += delta * spin
  })
  return (
    <group position={position}>
      <mesh ref={mesh}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshStandardMaterial
          color={palette[1]}
          emissive={palette[0]}
          emissiveIntensity={0.24}
          roughness={0.88}
          metalness={0.04}
        />
      </mesh>
      <mesh scale={1.06}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={atmosphere}
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function DestinationWorld({ planet, progress = 0, z = -80, radius = 3.2 }) {
  const look = useMemo(() => classifyPlanet(planet), [planet])
  const star = starColor(planet?.starTeffK)
  return (
    <group position={[0, 0, z + 34 * progress]}>
      <PlanetBall radius={radius} palette={look.palette} atmosphere={look.atmosphere} spin={0.05} />
      <pointLight color={star} intensity={2.4} distance={260} />
      <mesh scale={2.4}>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshBasicMaterial
          color={star}
          transparent
          opacity={0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/* ---------------------------------------------------------------- cameras -- */

function Aim({ at = [0, 0, 0], fov }) {
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3(at[0], at[1], at[2]))
  useEffect(() => {
    target.current.set(at[0], at[1], at[2])
  }, [at[0], at[1], at[2]])
  useFrame((_, delta) => {
    camera.lookAt(target.current)
    if (fov && Math.abs(camera.fov - fov) > 0.02) {
      camera.fov += (fov - camera.fov) * (1 - Math.exp(-delta * 7))
      camera.updateProjectionMatrix()
    }
  })
  return null
}

function ChaseRig({ distance }) {
  const { camera } = useThree()
  const desired = useRef(new THREE.Vector3(0, 1.6, distance))
  useFrame((_, delta) => {
    desired.current.set(0, 1.6, distance)
    camera.position.lerp(desired.current, 1 - Math.exp(-delta * 5))
    camera.lookAt(0, 0, -4)
  })
  return null
}

/* --------------------------------------------------------------- scenarios -- */

function FirstPersonCanvas({ beta, fraction, endPlanet }) {
  const look = useMemo(() => classifyPlanet(endPlanet), [endPlanet])
  const targetRadius = 0.6 + 2.8 * fraction
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ fov: 64, near: 0.05, far: 400, position: [0, 0.14, 0.9] }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.55} />
      <StarStreaks beta={beta} count={560} spread={30} depth={120} />
      <Aim at={[0, 0.02, -40]} />
      <group position={[0, 0.1, -125 + 58 * fraction]}>
        <mesh>
          <sphereGeometry args={[targetRadius, 32, 32]} />
          <meshBasicMaterial color={look.palette[1]} toneMapped={false} />
        </mesh>
        <mesh scale={2.2}>
          <sphereGeometry args={[targetRadius, 20, 20]} />
          <meshBasicMaterial
            color={starColor(endPlanet?.starTeffK)}
            transparent
            opacity={0.16}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </Canvas>
  )
}

function SecondPersonCanvas({ beta, fraction, endPlanet }) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ fov: 52, near: 0.1, far: 420, position: [6.6, 2.9, 5.0] }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 6, 7]} intensity={1.4} color="#d6e9ff" />
      <StarStreaks beta={beta} count={380} />
      <Aim at={[0, 0, -3]} />
      <Spacecraft glow="#5ee7ff" engine={0.9} scale={1.2} />
      <DestinationWorld planet={endPlanet} progress={fraction} z={-78} radius={3.6} />
    </Canvas>
  )
}

function ThirdPersonCanvas({ beta, fraction, endPlanet, chaseDistance }) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ fov: 55, near: 0.1, far: 420, position: [0, 1.6, chaseDistance] }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.42} />
      <directionalLight position={[5, 6, 7]} intensity={1.3} color="#d6e9ff" />
      <StarStreaks beta={beta} count={420} />
      <ChaseRig distance={chaseDistance} />
      <Spacecraft glow="#5ee7ff" engine={1} scale={1.25} />
      <DestinationWorld planet={endPlanet} progress={fraction} z={-88} radius={4} />
    </Canvas>
  )
}

const MAP_MIN = -18
const MAP_MAX = 18
const MAP_DASHES = 64

function Trajectory({ fraction }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(MAP_DASHES * 6)
    const colors = new Float32Array(MAP_DASHES * 6)
    for (let i = 0; i < MAP_DASHES; i += 1) {
      const x0 = MAP_MIN + ((MAP_MAX - MAP_MIN) * i) / MAP_DASHES
      const x1 = x0 + ((MAP_MAX - MAP_MIN) / MAP_DASHES) * 0.58
      positions[i * 6] = x0
      positions[i * 6 + 1] = 0
      positions[i * 6 + 2] = 0
      positions[i * 6 + 3] = x1
      positions[i * 6 + 4] = 0
      positions[i * 6 + 5] = 0
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return buffer
  }, [])

  const fractionRef = useRef(fraction)
  fractionRef.current = fraction
  const painted = useRef(-1)

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    const current = fractionRef.current
    if (Math.abs(current - painted.current) < 0.0015) return
    painted.current = current
    const colors = geometry.attributes.color.array
    const travelledX = MAP_MIN + (MAP_MAX - MAP_MIN) * current
    for (let i = 0; i < MAP_DASHES; i += 1) {
      const x = MAP_MIN + ((MAP_MAX - MAP_MIN) * i) / MAP_DASHES
      const bright = x <= travelledX
      const r = bright ? 0.37 : 0.13
      const g = bright ? 0.91 : 0.22
      const b = bright ? 1 : 0.3
      for (let v = 0; v < 2; v += 1) {
        colors[i * 6 + v * 3] = r
        colors[i * 6 + v * 3 + 1] = g
        colors[i * 6 + v * 3 + 2] = b
      }
    }
    geometry.attributes.color.needsUpdate = true
  })

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={0.95} toneMapped={false} />
    </lineSegments>
  )
}

function MapShip({ fraction }) {
  const ring = useRef()
  const x = MAP_MIN + (MAP_MAX - MAP_MIN) * fraction
  useFrame(({ clock }) => {
    if (ring.current) {
      const pulse = 1 + 0.22 * Math.sin(clock.elapsedTime * 3.4)
      ring.current.scale.setScalar(pulse)
    }
  })
  return (
    <group position={[x, 0.5, 0]}>
      <mesh>
        <sphereGeometry args={[0.85, 24, 24]} />
        <meshBasicMaterial color="#5ee7ff" toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.5, 0.07, 8, 40]} />
        <meshBasicMaterial color="#5ee7ff" transparent opacity={0.6} toneMapped={false} />
      </mesh>
      <pointLight color="#5ee7ff" intensity={6} distance={16} />
    </group>
  )
}

function BirdEyeCanvas({ fraction, startPlanet, endPlanet }) {
  const startLook = useMemo(() => classifyPlanet(startPlanet), [startPlanet])
  const endLook = useMemo(() => classifyPlanet(endPlanet), [endPlanet])
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ fov: 46, near: 0.1, far: 400, position: [0, 46, 0.01] }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 30, 12]} intensity={1.3} color="#dcecff" />
      <StarField count={800} radius={130} />
      <Aim at={[0, 0, 0]} />
      <group position={[-22, 0, 0]}>
        <PlanetBall radius={3.6} palette={startLook.palette} atmosphere={startLook.atmosphere} spin={0.05} />
        <pointLight color={starColor(startPlanet?.starTeffK)} intensity={2} distance={40} />
      </group>
      <group position={[22, 0, 0]}>
        <PlanetBall radius={4.4} palette={endLook.palette} atmosphere={endLook.atmosphere} spin={0.05} />
        <pointLight color={starColor(endPlanet?.starTeffK)} intensity={2} distance={46} />
      </group>
      <Trajectory fraction={fraction} />
      <MapShip fraction={fraction} />
    </Canvas>
  )
}

function ObserverCanvas({ side, fraction, planet, otherPlanet }) {
  const look = useMemo(() => classifyPlanet(planet), [planet])
  const otherLook = useMemo(() => classifyPlanet(otherPlanet), [otherPlanet])
  const isA = side === 'A'
  const shipZ = isA ? -(2.4 + 74 * fraction) : -(78 - 74 * fraction)
  const glow = isA ? '#ff9d7a' : '#8fc6ff'

  return (
    <Canvas
      dpr={[1, 1.7]}
      camera={{ fov: 55, near: 0.1, far: 420, position: [0, 2.6, 7.5] }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.44} />
      <directionalLight position={[7, 6, 5]} intensity={0.55} color="#b9d4ff" />
      <pointLight position={[0, 9, -26]} intensity={1.6} color={starColor(planet?.starTeffK)} distance={140} />
      <StarField count={760} radius={115} />
      <Aim at={[0, 0.1, -22]} />

      <PlanetBall
        position={[0, -13.6, -9]}
        radius={13}
        palette={look.palette}
        atmosphere={look.atmosphere}
        spin={0.012}
      />

      <group position={[0, 0, shipZ]}>
        <Spacecraft glow={glow} engine={0.72} scale={1.05} />
      </group>

      {isA ? (
        <group position={[0, 0, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <torusGeometry args={[1.9, 0.05, 8, 48]} />
            <meshBasicMaterial color="#5ee7ff" transparent opacity={0.5} toneMapped={false} />
          </mesh>
        </group>
      ) : (
        <group position={[0, 0, -4.4]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <torusGeometry args={[2.1, 0.045, 8, 48]} />
            <meshBasicMaterial color="#8fc6ff" transparent opacity={0.42} toneMapped={false} />
          </mesh>
        </group>
      )}

      {isA && (
        <group position={[0, 0, -150]}>
          <mesh>
            <sphereGeometry args={[2.2, 28, 28]} />
            <meshBasicMaterial color={otherLook.palette[1]} toneMapped={false} />
          </mesh>
        </group>
      )}
    </Canvas>
  )
}

export default function LabScene({ view, telemetry, startPlanet, endPlanet, chaseDistance, side }) {
  const beta = telemetry?.beta ?? 0
  const fraction = telemetry?.fraction ?? 0

  if (side === 'A') {
    return <ObserverCanvas side="A" fraction={fraction} planet={startPlanet} otherPlanet={endPlanet} />
  }
  if (side === 'B') {
    return <ObserverCanvas side="B" fraction={fraction} planet={endPlanet} otherPlanet={startPlanet} />
  }
  if (view === 'first') return <FirstPersonCanvas beta={beta} fraction={fraction} endPlanet={endPlanet} />
  if (view === 'second') return <SecondPersonCanvas beta={beta} fraction={fraction} endPlanet={endPlanet} />
  if (view === 'bird') return <BirdEyeCanvas fraction={fraction} startPlanet={startPlanet} endPlanet={endPlanet} />
  return (
    <ThirdPersonCanvas
      beta={beta}
      fraction={fraction}
      endPlanet={endPlanet}
      chaseDistance={chaseDistance}
    />
  )
}
