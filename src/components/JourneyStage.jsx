import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { formatDays, formatNumber, formatYears, C_KM_S } from '../lib/physics'
import { createPlanetTexture, mulberry32 } from '../lib/planet'
import { useAppStore } from '../store/appStore'

/* Top-down route: the ship leaves the origin marker and crosses to the
 * destination planet, which grows as the gap closes. */
const ORIGIN_X = -8
const DEST_X = 8.4
const TRAVEL_END = 6.1

function StarField() {
  const geometry = useMemo(() => {
    const count = 420
    const positions = new Float32Array(count * 3)
    const rand = mulberry32(4242)
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (rand() - 0.5) * 60
      positions[i * 3 + 1] = (rand() - 0.5) * 34
      positions[i * 3 + 2] = -18 - rand() * 24
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return buffer
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.09} color="#ffffff" sizeAttenuation transparent opacity={0.55} depthWrite={false} />
    </points>
  )
}

function RouteDots() {
  const geometry = useMemo(() => {
    const count = 72
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = ORIGIN_X + ((DEST_X - ORIGIN_X) / (count - 1)) * i
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = -0.02
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return buffer
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.045} color="#79018c" sizeAttenuation transparent opacity={0.9} depthWrite={false} />
    </points>
  )
}

function TraveledLine({ x }) {
  const length = Math.max(0.001, x - ORIGIN_X)
  return (
    <mesh position={[ORIGIN_X + length / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.018, 0.018, length, 6]} />
      <meshBasicMaterial color="#9a0680" toneMapped={false} />
    </mesh>
  )
}

function Ticks() {
  const marks = [0, 0.25, 0.5, 0.75, 1]
  return (
    <>
      {marks.map((mark) => (
        <mesh key={mark} position={[ORIGIN_X + (DEST_X - ORIGIN_X) * mark, 0, 0]}>
          <boxGeometry args={[0.02, mark === 0 || mark === 1 ? 0.42 : 0.24, 0.02]} />
          <meshBasicMaterial color="#4c0070" toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}

function OriginMarker() {
  return (
    <group position={[ORIGIN_X, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.26, 32]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  )
}

function DestinationPlanet({ planet, radius }) {
  const { texture } = useMemo(() => createPlanetTexture(planet), [planet])
  const spin = useRef()

  useEffect(() => () => texture.dispose(), [texture])
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.12
  })

  return (
    <group position={[DEST_X + radius * 0.6, 0, 0]}>
      <mesh ref={spin} scale={radius}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshStandardMaterial map={texture} roughness={0.85} metalness={0.02} />
      </mesh>
      <mesh scale={radius * 1.04}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#9a0680"
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

function Ship({ x, beta }) {
  const group = useRef()

  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.elapsedTime
    group.current.position.y = 0.03 + Math.sin(t * 2.4) * 0.03
  })

  return (
    <group ref={group} position={[x, 0.03, 0.06]} rotation={[0, 0, 0]}>
      <group scale={0.62}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.11, 0.14, 0.62, 16]} />
          <meshStandardMaterial color="#ffffff" metalness={0.35} roughness={0.42} />
        </mesh>
        <mesh position={[0.42, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.11, 0.26, 16]} />
          <meshStandardMaterial color="#ffffff" metalness={0.3} roughness={0.35} />
        </mesh>
        <mesh position={[-0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.13, 0.018, 6, 20]} />
          <meshBasicMaterial color="#9a0680" toneMapped={false} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[-0.14, side * 0.14, 0]} rotation={[0, 0, side * 0.5]}>
            <boxGeometry args={[0.22, 0.03, 0.1]} />
            <meshStandardMaterial color="#4c0070" roughness={0.6} />
          </mesh>
        ))}
        <mesh position={[-0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.085, 0.34 + beta * 0.2, 14, 1, true]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  )
}

function RouteScene({ planet, progress, beta }) {
  const eased = progress * progress * (3 - 2 * progress)
  const arrival = eased * eased
  const planetRadius = 0.32 + arrival * 1.62
  const shipX = ORIGIN_X + (TRAVEL_END - ORIGIN_X) * eased

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 6, 8]} intensity={1.5} color="#ffffff" />
      <StarField />
      <RouteDots />
      <Ticks />
      <TraveledLine x={shipX} />
      <OriginMarker />
      <DestinationPlanet planet={planet} radius={planetRadius} />
      <Ship x={shipX} beta={beta} />
    </>
  )
}

const RouteCanvas = memo(function RouteCanvas({ planet, progress, beta }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 42, position: [0, -9.5, 14], near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: true }}
    >
      <RouteScene planet={planet} progress={progress} beta={beta} />
    </Canvas>
  )
})

function Milestones({ distanceLy }) {
  return (
    <div className="flex justify-between border-t border-line/40 px-6 py-1.5 text-[9px] text-ink/45">
      {[0, 0.25, 0.5, 0.75, 1].map((mark) => (
        <span key={mark} className="num">
          {formatNumber(distanceLy * mark, distanceLy < 1 ? 4 : 1)} ly
        </span>
      ))}
    </div>
  )
}

function JourneyStage() {
  const origin = useAppStore((state) => state.location)
  const planet = useAppStore((state) => state.planet)
  const mission = useAppStore((state) => state.mission)
  const onArrive = useAppStore((state) => state.arrive)
  const shipName = mission?.shipName ?? 'Odyssey'
  const [progress, setProgress] = useState(0)
  const finished = useRef(false)
  const arrivedTimer = useRef(null)
  const frame = useRef(0)
  const start = useRef(0)
  const duration = useMemo(
    () => Math.min(14000, Math.max(6000, 6000 + (mission?.distanceLy ?? 0) * 60)),
    [mission?.distanceLy],
  )

  useEffect(() => {
    start.current = performance.now()
    let lastPaint = 0

    const complete = () => {
      if (finished.current) return
      finished.current = true
      arrivedTimer.current = setTimeout(onArrive, 700)
    }

    const tick = (now) => {
      const raw = Math.min(1, (now - start.current) / duration)
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
    if (!mission || finished.current) return
    finished.current = true
    cancelAnimationFrame(frame.current)
    setProgress(1)
    onArrive()
  }

  if (!mission) return null

  const eased = progress * progress * (3 - 2 * progress)
  const travelled = mission.distanceLy * eased
  const remaining = Math.max(0, mission.distanceLy - travelled)
  const earthNow = mission.earthYears * eased
  const shipNow = mission.shipYears * eased
  const compression = mission.earthYears / (duration / 1000)

  return (
    <div className="screen panel overflow-hidden">
      <div className="relative h-[440px] sm:h-[520px]">
        <div className="absolute inset-0 bg-void" />
        <RouteCanvas planet={planet} progress={progress} beta={mission.beta} />

        <div className="pointer-events-none absolute inset-x-4 top-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="label flex items-center gap-2">
              <span className="pulse-soft h-1.5 w-1.5 rounded-full bg-ion" />
              In transit · top-down route
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              {origin.name} <span className="text-ink/45">→</span> {planet.name}
            </h2>
            <div className="mt-1 text-[11px] text-ink/60">
              {shipName} · {formatNumber(mission.distanceLy, 2)} ly
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full border border-line/70 bg-void/85 px-3 py-1 text-[11px] text-ink">
              {mission.beta.toFixed(3)} c · {formatNumber(mission.beta * C_KM_S, 0)} km/s
            </span>
            <span className="rounded-full border border-line/60 bg-void/85 px-3 py-1 text-[11px] text-ink/70">
              travelled {formatNumber(travelled, mission.distanceLy < 1 ? 5 : 2)} ly
            </span>
            <span className="rounded-full border border-line/60 bg-void/85 px-3 py-1 text-[11px] text-ink/70">
              remaining {formatNumber(remaining, mission.distanceLy < 1 ? 5 : 2)} ly
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-4 bottom-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line/60 bg-void/85 px-4 py-3">
            <div className="label text-[9px]">Earth frame</div>
            <div className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{formatYears(earthNow)}</div>
            <div className="mt-0.5 text-[10px] text-ink/60">{formatDays(earthNow)}</div>
          </div>
          <div className="rounded-xl border border-line/70 bg-panel/60 px-4 py-3">
            <div className="label text-[9px] text-ink/60">{shipName} frame</div>
            <div className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{formatYears(shipNow)}</div>
            <div className="mt-0.5 text-[10px] text-ink/60">{formatDays(shipNow)}</div>
          </div>
        </div>

      </div>

      <Milestones distanceLy={mission.distanceLy} />

      <div className="flex flex-col gap-4 border-t border-line/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-[10px] tracking-[0.16em] text-ink/55 uppercase">
            <span>{origin.name}</span>
            <span>{Math.round(progress * 100)}%</span>
            <span>{planet.name}</span>
          </div>
          <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-panel/70">
            <div
              className="h-full rounded-full bg-ion transition-[width] duration-100"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="mt-2 text-[10px] text-ink/50">
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
