import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Spacecraft from '../../lab/Spacecraft'
import { HAS_WEBGL } from '../../../lib/webgl'
import { createGlowTexture } from '../../../lib/glowTexture'
import { mulberry32 } from '../../../lib/planet'
import { retardedProgress } from '../../../lib/flight'

/* The four palette colours, plus white for star cores and readouts. */
const VOID = '#160040'
const ION = '#9a0680'
const VIOLET = '#79018c'
const INK = '#ffffff'

const ROUTE_SEGMENTS = 240

/* ------------------------------------------------------------- route frame -- */

/**
 * Real NASA coordinates for both ends, in light-years. The scene keeps that
 * physical scale (1 unit = 1 ly); every camera distance and marker size is
 * derived from the route span so a 4-ly hop and a 900-ly haul both read well.
 */
function routeGeometry(origin, destination) {
  if (!origin?.renderPosition || !destination?.renderPosition) return null
  const from = new THREE.Vector3(...origin.renderPosition)
  const to = new THREE.Vector3(...destination.renderPosition)
  const delta = to.clone().sub(from)
  const span = delta.length()
  if (!Number.isFinite(span) || span <= 0) return null
  const dir = delta.divideScalar(span)
  const helper = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const right = new THREE.Vector3().crossVectors(dir, helper).normalize()
  const up = new THREE.Vector3().crossVectors(right, dir).normalize()
  return {
    from,
    to,
    dir,
    right,
    up,
    span,
    mid: from.clone().lerp(to, 0.5),
  }
}

/* ------------------------------------------------------------------ stars -- */

function StarField({ mid, span }) {
  const geometry = useMemo(() => {
    const count = 1100
    const random = mulberry32(73013)
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const u = random() * 2 - 1
      const theta = random() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      const radius = span * (5 + random() * 26)
      positions[i * 3] = mid.x + Math.cos(theta) * s * radius
      positions[i * 3 + 1] = mid.y + u * radius
      positions[i * 3 + 2] = mid.z + Math.sin(theta) * s * radius
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return buffer
  }, [mid, span])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={1.5}
        sizeAttenuation={false}
        color={INK}
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  )
}

/* --------------------------------------------------------------- markers -- */

function StarMarker({ position, span, glow, solar = false }) {
  const radius = span * 0.0035
  const glowScale = span * 0.04
  return (
    <group position={position.toArray()}>
      <mesh>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshBasicMaterial color={INK} toneMapped={false} />
      </mesh>
      <sprite scale={[glowScale, glowScale, 1]}>
        <spriteMaterial
          map={glow}
          color={ION}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      <sprite scale={[glowScale * 0.45, glowScale * 0.45, 1]}>
        <spriteMaterial
          map={glow}
          color={INK}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      {solar && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 3.4, radius * 3.8, 64]} />
          <meshBasicMaterial color={INK} transparent opacity={0.45} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

/* ---------------------------------------------------------------- route ---- */

function RouteLine({ route, progressRef }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array((ROUTE_SEGMENTS + 1) * 3)
    for (let i = 0; i <= ROUTE_SEGMENTS; i += 1) {
      const point = route.from.clone().addScaledVector(route.dir, route.span * (i / ROUTE_SEGMENTS))
      positions.set([point.x, point.y, point.z], i * 3)
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute('color', new THREE.BufferAttribute(new Float32Array((ROUTE_SEGMENTS + 1) * 3), 3))
    return buffer
  }, [route])

  useEffect(() => () => geometry.dispose(), [geometry])

  const painted = useRef(-1)
  useFrame(() => {
    const progress = progressRef.current
    if (painted.current >= 0 && Math.abs(progress - painted.current) < 0.0015) return
    painted.current = progress
    const colors = geometry.attributes.color.array
    const traveled = new THREE.Color(ION)
    const remaining = new THREE.Color(VIOLET)
    for (let i = 0; i <= ROUTE_SEGMENTS; i += 1) {
      const color = i / ROUTE_SEGMENTS <= progress ? traveled : remaining
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    geometry.attributes.color.needsUpdate = true
  })

  return (
    <line geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={0.9} toneMapped={false} />
    </line>
  )
}

/* ----------------------------------------------------------- spacecraft ---- */

function FlightShip({ route, progressRef }) {
  const group = useRef()
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), route.dir),
    [route],
  )

  useFrame(() => {
    if (!group.current) return
    group.current.position
      .copy(route.from)
      .addScaledVector(route.dir, route.span * progressRef.current)
  })

  return (
    <group ref={group} quaternion={quaternion}>
      <Spacecraft glow={ION} engine={1} scale={route.span * 0.0055} />
    </group>
  )
}

/**
 * Departure Observer's optional delayed view: the retarded image of the ship,
 * placed where the light arriving at the origin now was emitted.
 */
function DelayedGhost({ route, progressRef, beta, glow }) {
  const group = useRef()
  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints([route.from.clone(), route.from.clone()]),
    [route],
  )

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    if (!group.current) return
    const progress = retardedProgress(progressRef.current, beta)
    group.current.visible = progressRef.current > 0.0005
    group.current.position.copy(route.from).addScaledVector(route.dir, route.span * progress)
    const position = geometry.attributes.position
    position.setXYZ(0, route.from.x, route.from.y, route.from.z)
    position.setXYZ(1, group.current.position.x, group.current.position.y, group.current.position.z)
    position.needsUpdate = true
  })

  return (
    <>
      <group ref={group}>
        <sprite scale={[route.span * 0.018, route.span * 0.018, 1]}>
          <spriteMaterial
            map={glow}
            color={INK}
            transparent
            opacity={0.9}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      </group>
      <line geometry={geometry} frustumCulled={false}>
        <lineBasicMaterial color={ION} transparent opacity={0.4} toneMapped={false} />
      </line>
    </>
  )
}

/* --------------------------------------------------------------- cameras -- */

function useFieldOfView(fov) {
  const { camera } = useThree()
  useFrame(() => {
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })
}

function shipPosition(route, progress) {
  return route.from.clone().addScaledVector(route.dir, route.span * progress)
}

/** Bird's-eye follow: the ship, the route and its place on it. */
function ExternalCamera({ route, progressRef }) {
  const { camera } = useThree()
  useFieldOfView(50)
  const ship = useRef(new THREE.Vector3())
  const target = useRef(new THREE.Vector3())

  useFrame(() => {
    ship.current.copy(route.from).addScaledVector(route.dir, route.span * progressRef.current)
    target.current.copy(ship.current).addScaledVector(route.dir, route.span * 0.07)
    camera.position
      .copy(ship.current)
      .addScaledVector(route.right, route.span * 0.13)
      .addScaledVector(route.up, route.span * 0.1)
      .addScaledVector(route.dir, -route.span * 0.06)
    camera.lookAt(target.current)
  })

  return null
}

/** Departure Observer: fixed near the origin, watching the ship leave. */
function ObserverCamera({ route, progressRef }) {
  const { camera } = useThree()
  useFieldOfView(55)
  const home = useMemo(
    () =>
      route.from
        .clone()
        .addScaledVector(route.right, route.span * 0.1)
        .addScaledVector(route.up, route.span * 0.08)
        .addScaledVector(route.dir, route.span * 0.03),
    [route],
  )
  const target = useRef(new THREE.Vector3())

  useFrame(() => {
    const ship = shipPosition(route, progressRef.current)
    camera.position.copy(home)
    target.current.copy(route.from).lerp(ship, 0.4)
    camera.lookAt(target.current)
  })

  return null
}

/** Cockpit: forward-looking camera riding on the spacecraft. */
function CockpitCamera({ route, progressRef }) {
  const { camera } = useThree()
  useFieldOfView(72)
  const target = useRef(new THREE.Vector3())

  useFrame(() => {
    const ship = shipPosition(route, progressRef.current)
    camera.position
      .copy(ship)
      .addScaledVector(route.dir, route.span * 0.002)
      .addScaledVector(route.up, route.span * 0.0006)
    target.current.copy(ship).addScaledVector(route.dir, route.span)
    camera.lookAt(target.current)
  })

  return null
}

/* ------------------------------------------------------------------ scene -- */

function SceneRig({ route, cameraMode, beta, progressRef, delayed, glow, solarOrigin, solarDestination }) {
  return (
    <>
      <color attach="background" args={[VOID]} />
      <ambientLight intensity={1.1} />
      <directionalLight
        position={route.mid.clone().addScaledVector(route.up, route.span * 0.4).toArray()}
        intensity={1.2}
      />

      <StarField mid={route.mid} span={route.span} />
      <RouteLine route={route} progressRef={progressRef} />
      <StarMarker position={route.from} span={route.span} glow={glow} solar={solarOrigin} />
      <StarMarker position={route.to} span={route.span} glow={glow} solar={solarDestination} />

      {cameraMode !== 'cockpit' && <FlightShip route={route} progressRef={progressRef} />}
      {cameraMode === 'observer' && delayed && (
        <DelayedGhost route={route} progressRef={progressRef} beta={beta} glow={glow} />
      )}

      {cameraMode === 'external' && <ExternalCamera route={route} progressRef={progressRef} />}
      {cameraMode === 'observer' && <ObserverCamera route={route} progressRef={progressRef} />}
      {cameraMode === 'cockpit' && <CockpitCamera route={route} progressRef={progressRef} />}
    </>
  )
}

/**
 * Live Flight's 3D stage. `progressRef` is a mutable ref updated by the page's
 * requestAnimationFrame clock, so the ship and the cameras move at display
 * refresh rate while the HUD only re-renders a few times per second.
 */
export default function FlightScene({
  origin,
  destination,
  cameraMode = 'external',
  beta = 0.8,
  progressRef,
  delayed = false,
}) {
  const glow = useMemo(createGlowTexture, [])
  const route = useMemo(() => routeGeometry(origin, destination), [origin, destination])

  if (!HAS_WEBGL) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-void p-6 text-center">
        <div className="text-[10px] tracking-[0.18em] text-ink/45 uppercase">Live flight</div>
        <p className="max-w-[300px] text-[12px] leading-relaxed text-ink/70">
          This browser could not start WebGL, so the flight scene cannot draw. Enable hardware
          acceleration and reload to fly the route.
        </p>
      </div>
    )
  }

  if (!route) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-void p-6 text-center">
        <div className="text-[10px] tracking-[0.18em] text-ink/45 uppercase">Live flight</div>
        <p className="max-w-[320px] text-[12px] leading-relaxed text-ink/70">
          This route has no measured distance at one end, so the spacecraft has no coordinates to
          fly between. Go back to the Travel Planner and choose two charted systems.
        </p>
      </div>
    )
  }

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{
        fov: 50,
        near: Math.max(route.span * 1e-6, 1e-6),
        far: route.span * 120,
        position: [0, 0, 0],
      }}
      gl={{ antialias: true }}
    >
      <SceneRig
        route={route}
        cameraMode={cameraMode}
        beta={beta}
        progressRef={progressRef}
        delayed={delayed}
        glow={glow}
        solarOrigin={origin?.name === 'Solar System'}
        solarDestination={destination?.name === 'Solar System'}
      />
    </Canvas>
  )
}
