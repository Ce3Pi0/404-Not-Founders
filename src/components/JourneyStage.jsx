import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { formatDays, formatYears, formatNumber } from '../lib/physics'
import { mulberry32, starColor } from '../lib/planet'
import { classifyPlanet } from '../lib/planet'

const DURATION_MS = 9000
const TINTS = ['#bfefff', '#ffffff', '#ffe6b8', '#9fc9ff', '#d9c8ff']

function StarStreaks({ beta }) {
  const count = 480
  const geometry = useMemo(() => {
    const buffer = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 6)
    const colors = new Float32Array(count * 6)
    const rand = mulberry32(90210)

    for (let i = 0; i < count; i += 1) {
      const angle = rand() * Math.PI * 2
      const radius = 1.1 + Math.pow(rand(), 0.65) * 8.5
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius * 0.72
      const z = -92 + rand() * 96
      const tint = new THREE.Color(TINTS[Math.floor(rand() * TINTS.length)])
      for (let v = 0; v < 2; v += 1) {
        positions[i * 6 + v * 3] = x
        positions[i * 6 + v * 3 + 1] = y
        positions[i * 6 + v * 3 + 2] = z - v
        colors[i * 6 + v * 3] = tint.r
        colors[i * 6 + v * 3 + 1] = tint.g
        colors[i * 6 + v * 3 + 2] = tint.b
      }
    }

    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return buffer
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    const positions = geometry.attributes.position.array
    const speed = 26 + beta * 150
    const trail = 1.2 + beta * 9
    for (let i = 0; i < count; i += 1) {
      const base = i * 6
      let z = positions[base + 2] + speed * delta
      if (z > 6) z -= 100
      positions[base + 2] = z
      positions[base + 5] = z - trail
    }
    geometry.attributes.position.needsUpdate = true
  })

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  )
}

function WarpRings({ beta }) {
  const group = useRef()
  const offset = useRef(0)
  const rings = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({ seed: i, radius: 1.35 + (i % 4) * 0.14 })),
    [],
  )

  useFrame((_, delta) => {
    offset.current += delta * (7 + beta * 26)
    if (!group.current) return
    group.current.children.forEach((child, index) => {
      const spacing = 7.5
      child.position.z = -110 + ((index * spacing + offset.current) % (spacing * 16))
    })
  })

  return (
    <group ref={group}>
      {rings.map((ring) => (
        <mesh key={ring.seed} position={[0, 0, -110]}>
          <torusGeometry args={[ring.radius, 0.008, 5, 48]} />
          <meshBasicMaterial
            color="#4fd6ff"
            transparent
            opacity={0.16}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function Ship({ tint }) {
  const group = useRef()

  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.elapsedTime
    group.current.position.y = -0.1 + Math.sin(t * 1.3) * 0.05
    group.current.rotation.z = Math.sin(t * 0.8) * 0.05
  })

  return (
    <group ref={group} position={[0, -0.1, 0.4]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.3, 1.2, 22]} />
        <meshStandardMaterial color="#dbe6f2" metalness={0.75} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0, -0.82]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.24, 0.5, 22]} />
        <meshStandardMaterial color="#f0f6ff" metalness={0.5} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.025, 8, 28]} />
        <meshBasicMaterial color={tint} toneMapped={false} />
      </mesh>
      {[0, 1, 2].map((index) => {
        const angle = (index / 3) * Math.PI * 2
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 0.34, Math.sin(angle) * 0.34, 0.42]}
            rotation={[0, 0, angle]}
          >
            <boxGeometry args={[0.26, 0.05, 0.4]} />
            <meshStandardMaterial color="#94a9c2" metalness={0.6} roughness={0.35} />
          </mesh>
        )
      })}
      <mesh position={[0, 0, 0.72]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.18, 0.85, 18, 1, true]} />
        <meshBasicMaterial
          color="#7ff2ff"
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight position={[0, 0, 1.1]} color="#5ee7ff" intensity={8} distance={9} decay={2} />
    </group>
  )
}

const JourneyCanvas = memo(function JourneyCanvas({ beta, tint }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 55, position: [0, 0.35, 5.6], near: 0.1, far: 300 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 4, 6]} intensity={1.4} color="#cfe6ff" />
      <StarStreaks beta={beta} />
      <WarpRings beta={beta} />
      <Ship tint={tint} />
    </Canvas>
  )
})

function JourneyStage({ planet, mission, shipName, onArrive }) {
  const [progress, setProgress] = useState(0)
  const finished = useRef(false)
  const arrivedTimer = useRef(null)
  const frame = useRef(0)
  const start = useRef(0)
  const look = classifyPlanet(planet)
  const tint = starColor(planet.starTeffK)

  useEffect(() => {
    start.current = performance.now()
    let lastPaint = 0

    const complete = () => {
      if (finished.current) return
      finished.current = true
      arrivedTimer.current = setTimeout(onArrive, 700)
    }

    const tick = (now) => {
      const raw = Math.min(1, (now - start.current) / DURATION_MS)
      if (now - lastPaint > 70) {
        setProgress(raw)
        lastPaint = now
      }
      if (raw < 1) {
        frame.current = requestAnimationFrame(tick)
      } else {
        setProgress(1)
        complete()
      }
    }

    frame.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame.current)
      if (arrivedTimer.current) clearTimeout(arrivedTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finish = () => {
    if (finished.current) return
    finished.current = true
    cancelAnimationFrame(frame.current)
    setProgress(1)
    onArrive()
  }

  const eased = progress * progress * (3 - 2 * progress)
  const earthNow = mission.earthYears * eased
  const shipNow = mission.shipYears * eased
  const compression = mission.earthYears / (DURATION_MS / 1000)

  return (
    <div className="screen panel overflow-hidden">
      <div className="relative h-[440px] sm:h-[520px]">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_50%,#071019,#030509_70%)]" />
        <JourneyCanvas beta={mission.beta} tint={tint} />

        <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
          <div>
            <div className="label flex items-center gap-2">
              <span className="pulse-soft h-1.5 w-1.5 rounded-full bg-ion" />
              In transit
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{planet.name}</h2>
            <div className="num mt-1 text-[11px] text-muted">
              {shipName} · {formatNumber(mission.distanceLy, 2)} ly · {mission.beta.toFixed(3)} c
            </div>
          </div>
          <div className="rounded-full border border-line/80 bg-void/60 px-3 py-1 text-[10px] tracking-[0.16em] text-muted uppercase backdrop-blur">
            {look.label}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-4 bottom-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line/70 bg-void/75 px-4 py-3 backdrop-blur">
            <div className="label text-[9px]">Earth frame</div>
            <div className="num mt-1 text-xl font-semibold text-ink sm:text-2xl">{formatYears(earthNow)}</div>
            <div className="num mt-0.5 text-[10px] text-muted">{formatDays(earthNow)}</div>
          </div>
          <div className="rounded-xl border border-ion/35 bg-ion/[0.07] px-4 py-3 backdrop-blur">
            <div className="label text-[9px] text-ion/80">{shipName} frame</div>
            <div className="num mt-1 text-xl font-semibold text-ion sm:text-2xl">{formatYears(shipNow)}</div>
            <div className="num mt-0.5 text-[10px] text-muted">{formatDays(shipNow)}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-line/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-[10px] tracking-[0.16em] text-muted uppercase">
            <span>Departure</span>
            <span>{Math.round(progress * 100)}%</span>
            <span>Arrival</span>
          </div>
          <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ion/60 to-ion transition-[width] duration-100"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="num mt-2 text-[10px] text-muted">
            1 s of playback ≈ {formatYears(compression)} of mission time
          </div>
        </div>
        <button type="button" className="btn shrink-0" onClick={finish}>
          Complete mission →
        </button>
      </div>
    </div>
  )
}

export default JourneyStage
