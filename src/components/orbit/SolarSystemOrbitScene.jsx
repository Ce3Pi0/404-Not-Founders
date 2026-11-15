import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MAPPED_SYSTEMS } from '../../lib/catalog'
import { createPlanetTexture, mulberry32, starColor } from '../../lib/planet'
import { buildPlanetSystem } from '../../lib/planetSystem'
import { thinSkyStars } from '../../lib/skyStars'
import { SOLAR_SYSTEM } from '../../lib/starMap'
import { createZoomOutLatch, wheelPixels } from '../../lib/zoomTransition'
import { createGlowTexture, createRingTexture } from '../../lib/glowTexture'
import { createSunSurfaceTexture } from '../../lib/sunSurface'
import { HAS_WEBGL } from '../../lib/webgl'
import EarthSphere from '../EarthSphere'

/**
 * The opening scene: the Solar System from just above the ecliptic, with Earth
 * carrying the "you are here" marker.
 *
 * Scale note — one scene unit is one AU, and every orbit's *drawn* radius comes
 * from `buildPlanetSystem`, which log-spaces a system this wide (0.39–30 AU) so
 * the rocky worlds do not collapse into the Sun. The archive's semi-major axes
 * are untouched and still reported everywhere else in the app; planet sizes are
 * exaggerated for visibility and orbital phases are illustrative, never an
 * ephemeris. Orbit rates keep their true ratios from the observed periods, so
 * Mercury laps Neptune rather than the other way round.
 */
const SOLAR = buildPlanetSystem(SOLAR_SYSTEM)
const EXTENT = SOLAR?.extentAu ?? 30
const TAU = Math.PI * 2

/** Hero clock: in simulated days per real second. */
const DAYS_PER_SECOND = 3

const SPACE = '#05050a'
/** The Sun's own warm tones — the star is never drawn as a white ball. */
const SUN_MID = '#ffb75e'
const SUN_GLOW = '#ff8a24'
/** Orbit paths read as thin, cool, glowing rings against the black. */
const ORBIT_COLOR = '#3f6f9e'
const ORBIT_HOME = '#8fd8ff'

const EARTH_BODY = SOLAR?.bodies.find((body) => body.planet.id === 'earth') ?? null
const EARTH_START = EARTH_BODY
  ? new THREE.Vector3(
      Math.cos(EARTH_BODY.phase) * EARTH_BODY.orbitUnits,
      0,
      Math.sin(EARTH_BODY.phase) * EARTH_BODY.orbitUnits,
    )
  : new THREE.Vector3(1, 0, 0)

/**
 * Opening viewpoint: above the ecliptic and just off the Sun–Earth line, so the
 * Sun sits near the middle of frame and Earth is the nearest orbit — the focus
 * the journey starts from.
 */
const VIEW_AZIMUTH = (EARTH_BODY?.phase ?? 0) + THREE.MathUtils.degToRad(18)
const HOME_DISTANCE = EXTENT * 2.15
const HOME_CAMERA = new THREE.Vector3(
  Math.cos(VIEW_AZIMUTH) * HOME_DISTANCE * 0.85,
  HOME_DISTANCE * 0.53,
  Math.sin(VIEW_AZIMUTH) * HOME_DISTANCE * 0.85,
)
const HOME_TARGET = EARTH_START.clone().multiplyScalar(0.45)

/** Furthest the opening camera may pull back before the handoff gesture. */
const MAX_DISTANCE = EXTENT * 2.9
/** Close enough to inspect a planet's surface without entering the Sun. */
const MIN_DISTANCE = EXTENT * 0.08
/** Within this share of the limit the scene is "at the limit" for the handoff. */
const LIMIT_BAND = 0.9

/* --------------------------------------------------------------- textures -- */

/** Faint Milky Way dust band. Illustrative — a painted backdrop, not catalogue data. */
function createMilkyWayTexture() {
  const width = 1024
  const height = 512
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.fillStyle = '#000000'
  context.fillRect(0, 0, width, height)

  const random = mulberry32(1977)
  // Violet-to-magenta dust with warm gold star clouds, the palette of the
  // reference: deep indigo hazing into pinks, picked out by gold.
  const tones = [
    [104, 62, 176],
    [128, 44, 158],
    [72, 40, 132],
    [186, 104, 172],
    [196, 138, 82],
    [214, 166, 104],
  ]
  for (let i = 0; i < 34; i += 1) {
    const x = random() * width
    const centre = 256 + Math.sin((x / width) * Math.PI * 2) * 74
    const y = centre + (random() - 0.5) * 118
    const radius = 80 + random() * 150
    const [r, g, b] = tones[Math.floor(random() * tones.length)]
    const glow = context.createRadialGradient(x, y, 0, x, y, radius)
    glow.addColorStop(0, `rgba(${r},${g},${b},${0.1 + random() * 0.14})`)
    glow.addColorStop(0.5, `rgba(${r},${g},${b},${0.04 + random() * 0.05})`)
    glow.addColorStop(1, `rgba(${r},${g},${b},0)`)
    context.fillStyle = glow
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  for (let i = 0; i < 9000; i += 1) {
    const x = random() * width
    const centre = 256 + Math.sin((x / width) * Math.PI * 2) * 74
    const spread = 46 + Math.sin((x / width) * Math.PI * 3) * 20
    const offset = (random() + random() + random() - 1.5) * spread
    const y = centre + offset
    const alpha = 0.05 + random() * 0.26
    const warm = random() < 0.22
    context.fillStyle = warm ? `rgba(255,214,170,${alpha})` : `rgba(214,196,255,${alpha})`
    context.fillRect(x, y, random() < 0.88 ? 1 : 1.6, 1)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/* ---------------------------------------------------------------- scenery -- */

function MilkyWay() {
  const texture = useMemo(createMilkyWayTexture, [])
  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh rotation={[0.5, 1.42, 0.3]} scale={EXTENT * 90}>
      <sphereGeometry args={[1, 48, 48]} />
      <meshBasicMaterial
        map={texture}
        color="#d9c8ff"
        side={THREE.BackSide}
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

/**
 * Background stars. The brighter layer uses each catalogue system's real
 * direction (its RA/Dec position projected onto the sky sphere); the dimmer
 * layer is procedural filler, illustrative only. The thicker catalogue is
 * thinned on the sky first — see lib/skyStars.js for why.
 */
function StarField({ glow }) {
  const catalog = useMemo(() => {
    const systems = thinSkyStars(
      MAPPED_SYSTEMS.filter((system) => system.mapPosition && system.distanceLy > 0),
    )
    const positions = new Float32Array(systems.length * 3)
    const colors = new Float32Array(systems.length * 3)
    const random = mulberry32(8128)
    const direction = new THREE.Vector3()
    const color = new THREE.Color()
    const white = new THREE.Color('#ffffff')
    systems.forEach((system, index) => {
      direction.set(...system.mapPosition)
      if (direction.lengthSq() === 0) return
      direction.normalize().multiplyScalar(EXTENT * (11 + random() * 4))
      positions.set([direction.x, direction.y, direction.z], index * 3)
      color.set(starColor(system.planets[0]?.starTeffK))
      color.lerp(white, 0.5)
      const brightness = 0.5 + random() * 0.5
      colors.set([color.r * brightness, color.g * brightness, color.b * brightness], index * 3)
    })
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return buffer
  }, [])

  const filler = useMemo(() => {
    const random = mulberry32(424242)
    const count = 1800
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const u = random() * 2 - 1
      const theta = random() * Math.PI * 2
      const radius = EXTENT * (11.5 + random() * 6)
      const ring = Math.sqrt(1 - u * u)
      positions.set(
        [Math.cos(theta) * ring * radius, u * radius, Math.sin(theta) * ring * radius],
        i * 3,
      )
      const brightness = 0.2 + random() * 0.45
      colors.set([brightness, brightness, brightness * 1.04], i * 3)
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return buffer
  }, [])

  useEffect(
    () => () => {
      catalog.dispose()
      filler.dispose()
    },
    [catalog, filler],
  )

  return (
    <>
      <points geometry={filler} frustumCulled={false}>
        <pointsMaterial
          map={glow}
          size={1.35}
          sizeAttenuation={false}
          vertexColors
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points geometry={catalog} frustumCulled={false}>
        <pointsMaterial
          map={glow}
          size={2.9}
          sizeAttenuation={false}
          vertexColors
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  )
}

/* ------------------------------------------------------------ the system -- */

/**
 * The Sun: a textured photosphere — granulation, dark plasma patches and
 * sunspots, see lib/sunSurface.js — wrapped in progressively wider, softer
 * glows drawn from the same sprite the rest of the map uses. Its light is the
 * scene's only key light, so the planets' phases are the real ones.
 */
function Sun({ glow }) {
  const radius = SOLAR.star.units
  const surface = useMemo(createSunSurfaceTexture, [])
  const core = useRef(null)
  useEffect(() => () => surface.dispose(), [surface])
  useFrame((_, delta) => {
    if (core.current) core.current.rotation.y += delta * 0.035
  })
  const layers = [
    { scale: 1.45, color: '#fff2cf', opacity: 0.85 },
    { scale: 2.7, color: SUN_MID, opacity: 0.5 },
    { scale: 5, color: SUN_GLOW, opacity: 0.22 },
  ]

  return (
    <group>
      <mesh ref={core}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshBasicMaterial map={surface} toneMapped={false} />
      </mesh>
      {layers.map((layer) => (
        <sprite key={layer.scale} scale={[radius * layer.scale, radius * layer.scale, 1]}>
          <spriteMaterial
            map={glow}
            color={layer.color}
            transparent
            opacity={layer.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
      {/* decay 0: an AU-scale scene must keep the outer worlds lit. */}
      <pointLight intensity={2.6} decay={0} color="#fff0cf" />
    </group>
  )
}

/** Circular orbit at the drawn radius (see the scale note at the top). */
function OrbitRing({ radius, highlight }) {
  const geometry = useMemo(() => {
    const segments = 240
    const points = []
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * TAU
      points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [radius])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial
        color={highlight ? ORBIT_HOME : ORBIT_COLOR}
        transparent
        opacity={highlight ? 0.5 : 0.3}
        depthWrite={false}
      />
    </lineLoop>
  )
}

/** Banded tan terrain for Saturn's ring disc — planar UVs, so circles read as rings. */
function createSaturnRingTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  const centre = size / 2
  const random = mulberry32(9031)

  let radius = size * 0.295
  while (radius < size * 0.5) {
    const width = 0.8 + random() * 6
    const tone = 138 + Math.floor(random() * 84)
    context.strokeStyle = `rgba(${tone + 26},${tone},${Math.floor(tone * 0.78)},${
      0.12 + random() * 0.5
    })`
    context.lineWidth = width
    context.beginPath()
    context.arc(centre, centre, radius, 0, TAU)
    context.stroke()
    radius += width * (0.45 + random() * 0.95)
  }

  // Cassini division: a clean gap through the bands.
  context.globalCompositeOperation = 'destination-out'
  context.lineWidth = 6
  context.beginPath()
  context.arc(centre, centre, size * 0.4, 0, TAU)
  context.stroke()
  context.globalCompositeOperation = 'source-over'

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function SaturnRings({ radius }) {
  const rings = useMemo(createSaturnRingTexture, [])
  useEffect(() => () => rings.dispose(), [rings])

  return (
    <mesh rotation={[-Math.PI / 2 + 0.47, 0, 0.22]} scale={radius}>
      <ringGeometry args={[1.32, 2.25, 160]} />
      <meshBasicMaterial
        map={rings}
        transparent
        opacity={0.95}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

/**
 * One planet riding its orbit. Earth wears the shared Blue Marble surface and
 * a small home marker; every other world keeps its procedural surface.
 */
function PlanetBody({ body, ring }) {
  const isEarth = body.planet.kind === 'earth'
  const isSaturn = body.planet.id === 'saturn'
  const surface = useMemo(
    () => (isEarth ? null : createPlanetTexture(body.planet)),
    [body.planet, isEarth],
  )
  const orbit = useRef(null)
  const spin = useRef(null)
  const elapsed = useRef(0)

  useEffect(() => () => surface?.texture.dispose(), [surface])

  useFrame((_, delta) => {
    elapsed.current += delta
    const angle = body.phase + elapsed.current * body.angularSpeed * DAYS_PER_SECOND
    if (orbit.current) {
      orbit.current.position.set(
        Math.cos(angle) * body.orbitUnits,
        0,
        Math.sin(angle) * body.orbitUnits,
      )
    }
    if (spin.current) spin.current.rotation.y += delta * 0.09
  })

  // Earth is drawn slightly above its slot size so the home world can be picked
  // out on its orbit; every size here is illustrative (see the scale note).
  const radius = body.radiusUnits * (isEarth ? 1.7 : 1)

  return (
    <group ref={orbit}>
      <group ref={spin}>
        {isEarth ? (
          <EarthSphere radius={radius} segments={64} />
        ) : (
          <mesh>
            <sphereGeometry args={[radius, 32, 32]} />
            <meshStandardMaterial map={surface.texture} roughness={0.92} metalness={0.03} />
          </mesh>
        )}
      </group>
      {/* Home marker: a hairline ring just outside the disc, depth-tested so it
          can never paint over Earth. Small on purpose — the planet stays
          readable when you zoom in. */}
      {isEarth && (
        <sprite scale={[radius * 2.75, radius * 2.75, 1]}>
          <spriteMaterial
            map={ring}
            color="#8fd8ff"
            transparent
            opacity={0.45}
            depthWrite={false}
          />
        </sprite>
      )}
      {isSaturn && <SaturnRings radius={radius} />}
    </group>
  )
}

/* ------------------------------------------------------------- interaction -- */

/**
 * The opening camera, plus the zoom-out handoff to the star map.
 *
 * The handoff: engaged scene + camera inside the limit band + 150 normalised
 * pixels of outward wheel travel (lib/zoomTransition.js). The latch fires once
 * per gesture, so repeats cannot double-fire, and scrolling back in clears it.
 * Engagement is what keeps a page scroll over the hero from warping anyone: the
 * scene must have been clicked (or focused), and it lets go when the pointer
 * leaves the canvas.
 */
function OrbitRig({ onZoomOut, onLimitChange }) {
  const { camera, gl } = useThree()
  const controls = useRef(null)
  const zoomOut = useRef(onZoomOut)
  zoomOut.current = onZoomOut
  const limitChange = useRef(onLimitChange)
  limitChange.current = onLimitChange

  useEffect(() => {
    const instance = new OrbitControls(camera, gl.domElement)
    instance.enablePan = false
    instance.enableDamping = true
    instance.dampingFactor = 0.05
    instance.rotateSpeed = 0.4
    instance.zoomSpeed = 0.55
    instance.minDistance = MIN_DISTANCE
    instance.maxDistance = MAX_DISTANCE
    instance.minPolarAngle = Math.PI * 0.12
    instance.maxPolarAngle = Math.PI * 0.86
    instance.autoRotate = true
    instance.autoRotateSpeed = 0.06
    instance.target.copy(HOME_TARGET)
    instance.update()
    controls.current = instance

    const element = gl.domElement
    element.tabIndex = 0
    element.style.outline = 'none'

    let engaged = false
    let atLimit = false
    let idleTimer = null
    const latch = createZoomOutLatch()

    const reportLimit = (next) => {
      if (next === atLimit) return
      atLimit = next
      limitChange.current?.(next)
    }

    const engage = () => {
      engaged = true
      instance.autoRotate = false
      element.focus?.({ preventScroll: true })
    }
    const release = () => {
      engaged = false
      latch.reset()
      reportLimit(false)
    }

    const handleWheel = (event) => {
      const pixels = wheelPixels(event)
      const distance = camera.position.distanceTo(instance.target)
      const withinLimit = distance >= instance.maxDistance * LIMIT_BAND

      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        latch.reset()
        reportLimit(false)
      }, 420)

      if (!engaged) {
        latch.reset()
        reportLimit(false)
        return
      }

      instance.autoRotate = false
      reportLimit(pixels > 0 && withinLimit)

      if (latch.push(pixels, withinLimit)) {
        latch.reset()
        reportLimit(false)
        zoomOut.current?.()
      }
    }

    element.addEventListener('pointerdown', engage)
    element.addEventListener('focus', engage)
    element.addEventListener('pointerleave', release)
    window.addEventListener('blur', release)
    element.addEventListener('wheel', handleWheel, { passive: true })
    return () => {
      clearTimeout(idleTimer)
      element.removeEventListener('pointerdown', engage)
      element.removeEventListener('focus', engage)
      element.removeEventListener('pointerleave', release)
      window.removeEventListener('blur', release)
      element.removeEventListener('wheel', handleWheel)
      latch.reset()
      limitChange.current?.(false)
      instance.dispose()
    }
  }, [camera, gl])

  useFrame(() => controls.current?.update())
  return null
}

/** Widen the lens on tall screens so the inner system stays in frame. */
function ResponsiveFraming() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    camera.fov = aspect < 1 ? 66 : 48
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  return null
}

function Scene({ onZoomOut, onLimitChange }) {
  const glow = useMemo(createGlowTexture, [])
  const ring = useMemo(() => createRingTexture(5), [])
  useEffect(
    () => () => {
      glow.dispose()
      ring.dispose()
    },
    [glow, ring],
  )

  return (
    <>
      <color attach="background" args={[SPACE]} />
      <ResponsiveFraming />
      <ambientLight intensity={0.14} color="#5f7bb8" />
      <MilkyWay />
      <StarField glow={glow} />
      <Sun glow={glow} />
      {SOLAR.bodies.map((body) => (
        <OrbitRing
          key={`orbit-${body.planet.id}`}
          radius={body.orbitUnits}
          highlight={body.planet.id === 'earth'}
        />
      ))}
      {SOLAR.bodies.map((body) => (
        <PlanetBody key={body.planet.id} body={body} ring={ring} />
      ))}
      <OrbitRig onZoomOut={onZoomOut} onLimitChange={onLimitChange} />
    </>
  )
}

const OrbitCanvas = memo(function OrbitCanvas({ onZoomOut }) {
  const [atLimit, setAtLimit] = useState(false)

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 48, position: HOME_CAMERA.toArray(), near: 0.05, far: EXTENT * 90 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          logarithmicDepthBuffer: true,
        }}

      >
        <Scene onZoomOut={onZoomOut} onLimitChange={setAtLimit} />
      </Canvas>

      {/* Outward-scroll affordance: the handoff is a gesture, so it says so. */}
      {atLimit && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center px-4">
          <div className="rounded-full border border-white/25 bg-[#04010c]/80 px-3 py-1.5 text-[10px] tracking-[0.16em] text-white/80 uppercase backdrop-blur">
            Keep scrolling out to open the star map
          </div>
        </div>
      )}
    </div>
  )
})

export default function SolarSystemOrbitScene({ onZoomOut }) {
  if (!HAS_WEBGL) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#04010c] p-6 text-center">
        <p className="max-w-[300px] text-[12px] leading-relaxed text-ink/65">
          This browser could not start WebGL, so the Solar System scene cannot draw. Enable
          hardware acceleration and reload to begin the journey.
        </p>
      </div>
    )
  }

  return <OrbitCanvas onZoomOut={onZoomOut} />
}
