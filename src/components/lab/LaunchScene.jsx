import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Spacecraft from './Spacecraft'
import { classifyPlanet, mulberry32, starColor } from '../../lib/planet'
import { clamp } from '../../lib/physics'
import { ATMOSPHERE_M } from '../../lib/launchPhysics'

const PLANET_R = 7
const ROUTE_SPAN = 60
const ROUTE_END_R = PLANET_R + ROUTE_SPAN
const EXIT_R = PLANET_R + 1.7
const DEST_R = 4.2

/* --------------------------------------------------------------- geometry -- */

/** Launch site direction: tilted away from the pole by the chosen azimuth. */
export function siteDirection(azimuthDeg) {
  const az = (azimuthDeg * Math.PI) / 180
  const tilt = 0.6
  return new THREE.Vector3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)).normalize()
}

/**
 * World position of the ship. Altitude is exaggerated inside the atmosphere so
 * the climb is visible; once above it, the position is linear in the fraction
 * of the route actually travelled.
 */
export function shipWorldPosition(altitudeM, fraction, dir) {
  const climb = clamp(altitudeM / ATMOSPHERE_M, 0, 1)
  const radius =
    altitudeM < ATMOSPHERE_M
      ? PLANET_R + 0.12 + climb * (EXIT_R - PLANET_R - 0.12)
      : EXIT_R + fraction * (ROUTE_END_R - EXIT_R)
  return dir.clone().multiplyScalar(radius)
}

function basis(dir) {
  const right = new THREE.Vector3(0, 1, 0).cross(dir)
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0)
  right.normalize()
  const up = dir.clone().cross(right).normalize()
  return { right, up }
}

/* ----------------------------------------------------------------- effects -- */

function StarField({ count = 900, radius = 240 }) {
  const geometry = useMemo(() => {
    const random = mulberry32(90210)
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const u = random() * 2 - 1
      const theta = random() * Math.PI * 2
      const r = radius * (0.5 + random() * 0.5)
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
      <pointsMaterial size={0.7} color="#d6ecff" sizeAttenuation transparent opacity={0.8} depthWrite={false} />
    </points>
  )
}

/* ----------------------------------------------------------------- planets -- */

function PlanetBody({ radius = PLANET_R, palette, atmosphere, spin = 0.03 }) {
  const mesh = useRef()
  useFrame((_, delta) => {
    if (mesh.current) mesh.current.rotation.y += delta * spin
  })
  return (
    <group>
      <mesh ref={mesh}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshStandardMaterial
          color={palette[1]}
          emissive={palette[0]}
          emissiveIntensity={0.22}
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>
      <mesh scale={1.03}>
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

/** The 100 km shell the ship has to climb out of, drawn as a translucent dome. */
function AtmosphereShell({ palette }) {
  return (
    <mesh scale={1.07}>
      <sphereGeometry args={[PLANET_R, 48, 48]} />
      <meshBasicMaterial
        color={palette}
        transparent
        opacity={0.1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function LaunchPad({ dir, thrustLevel, phase }) {
  const glow = useRef()
  const ring = useRef()
  const firing = phase !== 'prelaunch' && phase !== 'countdown'
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (glow.current) {
      const target = firing ? 0.25 + 0.75 * thrustLevel : 0.06
      glow.current.material.opacity = target * (0.85 + 0.15 * Math.sin(t * 12))
      glow.current.scale.setScalar(firing ? 0.9 + 0.25 * thrustLevel : 0.75)
    }
    if (ring.current) {
      ring.current.material.opacity = phase === 'prelaunch' || phase === 'countdown' ? 0.35 + 0.25 * Math.sin(t * 2.4) : 0.25
    }
  })

  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
    [dir],
  )

  return (
    <group position={dir.clone().multiplyScalar(PLANET_R).toArray()} quaternion={quaternion}>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <torusGeometry args={[0.9, 0.05, 8, 44]} />
        <meshBasicMaterial color="#ffb35c" transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <mesh ref={glow} position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.36, 0.7, 0.3, 20, 1, true]} />
        <meshBasicMaterial
          color="#ffd7a0"
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/* -------------------------------------------------------------- trajectory -- */

const DASHES = 62

function Trajectory({ dir, fraction }) {
  const positions = useMemo(() => {
    const start = dir.clone().multiplyScalar(EXIT_R)
    const end = dir.clone().multiplyScalar(ROUTE_END_R)
    const pos = new Float32Array(DASHES * 6)
    for (let i = 0; i < DASHES; i += 1) {
      const a = i / DASHES
      const b = a + 0.58 / DASHES
      const p0 = start.clone().lerp(end, a)
      const p1 = start.clone().lerp(end, b)
      pos.set([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z], i * 6)
    }
    return pos
  }, [dir])

  const geometry = useMemo(() => {
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute('color', new THREE.BufferAttribute(new Float32Array(DASHES * 6), 3))
    return buffer
  }, [positions])

  useEffect(() => () => geometry.dispose(), [geometry])

  const painted = useRef(-1)
  useFrame(() => {
    if (Math.abs(fraction - painted.current) < 0.0012) return
    painted.current = fraction
    const colors = geometry.attributes.color.array
    for (let i = 0; i < DASHES; i += 1) {
      const travelled = i / DASHES <= fraction
      const rgb = travelled ? [0.37, 0.91, 1] : [0.16, 0.26, 0.36]
      for (let v = 0; v < 2; v += 1) {
        colors[i * 6 + v * 3] = rgb[0]
        colors[i * 6 + v * 3 + 1] = rgb[1]
        colors[i * 6 + v * 3 + 2] = rgb[2]
      }
    }
    geometry.attributes.color.needsUpdate = true
  })

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={0.9} toneMapped={false} />
    </lineSegments>
  )
}

/* ----------------------------------------------------------------- cameras -- */

function OrbitRig({ target, distance = 110, elevation = 0.32, azimuth = 0.8 }) {
  const { camera, gl } = useThree()
  const view = useRef({ az: azimuth, el: elevation, r: distance, drag: null })

  useEffect(() => {
    const element = gl.domElement
    const onDown = (event) => {
      view.current.drag = { x: event.clientX, y: event.clientY }
    }
    const onMove = (event) => {
      if (!view.current.drag) return
      const dx = event.clientX - view.current.drag.x
      const dy = event.clientY - view.current.drag.y
      view.current.drag = { x: event.clientX, y: event.clientY }
      view.current.az -= dx * 0.006
      view.current.el = clamp(view.current.el + dy * 0.004, -1.45, 1.45)
    }
    const onUp = () => {
      view.current.drag = null
    }
    const onWheel = (event) => {
      event.preventDefault()
      view.current.r = clamp(view.current.r * (1 + event.deltaY * 0.0012), 18, 340)
    }
    element.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      element.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame(() => {
    const { az, el, r } = view.current
    camera.position.set(
      target.x + r * Math.cos(el) * Math.cos(az),
      target.y + r * Math.sin(el),
      target.z + r * Math.cos(el) * Math.sin(az),
    )
    camera.lookAt(target)
  })

  return null
}

function FirstPersonCamera({ ship, dir }) {
  const { camera } = useThree()
  useFrame(() => {
    camera.position.set(ship.x + dir.x * 1.5, ship.y + dir.y * 1.5, ship.z + dir.z * 1.5)
    camera.lookAt(ship.x + dir.x * 40, ship.y + dir.y * 40, ship.z + dir.z * 40)
  })
  return null
}

function TrackingCamera({ ship, anchor, dir }) {
  const { camera } = useThree()
  const { right, up } = useMemo(() => basis(dir), [dir])
  const home = useMemo(
    () =>
      anchor
        .clone()
        .add(right.clone().multiplyScalar(19))
        .add(up.clone().multiplyScalar(10))
        .add(dir.clone().multiplyScalar(2)),
    [anchor, right, up, dir],
  )
  useFrame((_, delta) => {
    camera.position.lerp(home, 1 - Math.exp(-delta * 4))
    const look = ship.clone().lerp(anchor, 0.4)
    camera.lookAt(look)
  })
  return null
}

function ChaseCamera({ ship, dir, distance, angle }) {
  const { camera } = useThree()
  const { up } = useMemo(() => basis(dir), [dir])
  const desired = useRef(new THREE.Vector3())
  useFrame((_, delta) => {
    desired.current
      .copy(ship)
      .add(dir.clone().multiplyScalar(-distance * Math.cos(angle)))
      .add(up.clone().multiplyScalar(distance * Math.sin(angle)))
    if (desired.current.length() < PLANET_R + 0.6) {
      desired.current.setLength(PLANET_R + 0.6)
    }
    camera.position.lerp(desired.current, 1 - Math.exp(-delta * 6))
    camera.lookAt(ship.x + dir.x * 3, ship.y + dir.y * 3, ship.z + dir.z * 3)
  })
  return null
}

/* ------------------------------------------------------------------- world -- */

function LaunchWorld({
  view,
  focus,
  telemetry,
  route,
  chaseDistance,
  cameraAngle,
  thrustLevel,
  azimuthDeg,
}) {
  const dir = useMemo(() => siteDirection(azimuthDeg), [azimuthDeg])
  const ship = useMemo(
    () => shipWorldPosition(telemetry.altitudeM, telemetry.fraction, dir),
    [telemetry.altitudeM, telemetry.fraction, dir],
  )
  const destination = useMemo(() => dir.clone().multiplyScalar(ROUTE_END_R + DEST_R * 2.2), [dir])
  const startLook = useMemo(() => classifyPlanet(route.startPlanet), [route.startPlanet])
  const endLook = useMemo(() => classifyPlanet(route.endPlanet), [route.endPlanet])
  const starA = starColor(route.startPlanet?.starTeffK)
  const starB = starColor(route.endPlanet?.starTeffK)
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir),
    [dir],
  )
  const ascending = telemetry.altitudeM < ATMOSPHERE_M
  const plasma = ascending ? clamp(telemetry.velocityMs / 1600, 0, 1) : 0
  const anchor = focus === 'B' ? dir.clone().multiplyScalar(ROUTE_END_R) : dir.clone().multiplyScalar(PLANET_R)
  const routeMid = dir.clone().multiplyScalar(ROUTE_END_R * 0.5)

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[30, 40, 20]} intensity={1.25} color={starA} />
      <pointLight position={dir.clone().multiplyScalar(-140).toArray()} intensity={2.4} color={starA} distance={420} />
      <StarField />

      <group>
        <PlanetBody palette={startLook.palette} atmosphere={startLook.atmosphere} />
        <AtmosphereShell palette={startLook.atmosphere} />
        <LaunchPad dir={dir} thrustLevel={thrustLevel} phase={telemetry.phase} />
      </group>

      <group position={destination.toArray()}>
        <PlanetBody radius={DEST_R} palette={endLook.palette} atmosphere={endLook.atmosphere} spin={0.06} />
        <pointLight color={starB} intensity={2.2} distance={200} />
        <mesh scale={2.2}>
          <sphereGeometry args={[DEST_R, 24, 24]} />
          <meshBasicMaterial
            color={starB}
            transparent
            opacity={0.06}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      <Trajectory dir={dir} fraction={telemetry.fraction} />

      <group position={ship.toArray()} quaternion={quaternion}>
        <Spacecraft glow="#5ee7ff" engine={thrustLevel} scale={1.15} detail={view !== 'first'} />
        {plasma > 0.02 && (
          <mesh position={[0, 0, 2.6]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.5 + plasma * 0.5, 2 + plasma * 4, 18, 1, true]} />
            <meshBasicMaterial
              color="#ffd9a0"
              transparent
              opacity={0.1 + plasma * 0.35}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        )}
        {(view === 'second' || view === 'bird' || focus !== 'single') && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.9, 0.05, 8, 40]} />
            <meshBasicMaterial color="#5ee7ff" transparent opacity={0.5} toneMapped={false} />
          </mesh>
        )}
      </group>

      {view === 'first' && <FirstPersonCamera ship={ship} dir={dir} />}
      {view === 'second' && <TrackingCamera ship={ship} anchor={anchor} dir={dir} />}
      {view === 'third' && (
        <ChaseCamera ship={ship} dir={dir} distance={chaseDistance} angle={cameraAngle} />
      )}
      {view === 'bird' && (
        <OrbitRig
          target={focus === 'single' ? routeMid : anchor.clone().add(ship).multiplyScalar(0.5)}
          distance={focus === 'single' ? 118 : 74}
          elevation={0.34}
          azimuth={0.9}
        />
      )}
    </>
  )
}

export default function LaunchScene({
  view = 'third',
  focus = 'single',
  telemetry,
  route,
  chaseDistance = 12,
  cameraAngle = 0.5,
  thrustLevel = 0,
  azimuthDeg = 30,
}) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ fov: view === 'first' ? 68 : 55, near: 0.1, far: 900, position: [0, 60, 90] }}
      gl={{ antialias: true, alpha: true }}
    >
      <LaunchWorld
        view={view}
        focus={focus}
        telemetry={telemetry}
        route={route}
        chaseDistance={chaseDistance}
        cameraAngle={cameraAngle}
        thrustLevel={thrustLevel}
        azimuthDeg={azimuthDeg}
      />
    </Canvas>
  )
}
