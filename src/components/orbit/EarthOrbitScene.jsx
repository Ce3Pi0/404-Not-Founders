import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import earthDayMap from '../../assets/earth/earth_atmos_2048.jpg'
import earthNormalMap from '../../assets/earth/earth_normal_2048.jpg'
import earthSpecularMap from '../../assets/earth/earth_specular_2048.jpg'
import earthCloudMap from '../../assets/earth/earth_clouds_1024.png'
import { MAPPED_SYSTEMS, SOLAR_WORLDS } from '../../lib/catalog'
import { classifyPlanet, mulberry32, starColor } from '../../lib/planet'
import { createZoomOutLatch, wheelPixels } from '../../lib/zoomTransition'
import { createGlowTexture } from '../../lib/glowTexture'
import { HAS_WEBGL } from '../../lib/webgl'
import Spacecraft from '../lab/Spacecraft'

/**
 * The opening scene: Earth from just above the atmosphere, lit by the Sun.
 *
 * Scale note — everything here is in Earth radii (1 unit = 6,371 km), so the
 * orbit scene never meets the star map's light-year coordinates. The two scenes
 * are separate renders joined by a transition; that is what keeps float
 * precision intact when zooming out to interstellar distances.
 */

const EARTH_TILT = THREE.MathUtils.degToRad(23.4)
const SUN_COLOR = '#fff3e2'
const SPACE = '#04010c'

/**
 * The orbit scene is Earth drawn from just above the atmosphere, with the Sun
 * and the rest of the Solar System at their real orbital distances around it.
 * The Sun's sky angle is measured from the opening camera, so it opens just past
 * Earth's limb in the direction the key light actually comes from; every other
 * world is placed on the ecliptic at its own semi-major axis from the extract.
 */
const HOME_CAMERA = new THREE.Vector3(2.3, 1.5, 5.9)
const VIEW_AXIS = HOME_CAMERA.clone().negate().normalize()
const SCREEN_RIGHT = new THREE.Vector3()
  .crossVectors(VIEW_AXIS, new THREE.Vector3(0, 1, 0))
  .normalize()
const SCREEN_UP = new THREE.Vector3().crossVectors(SCREEN_RIGHT, VIEW_AXIS).normalize()

/** Direction to a point at a given horizontal / vertical screen angle. */
function skyDirection(horizontalDeg, verticalDeg) {
  return VIEW_AXIS.clone()
    .add(SCREEN_RIGHT.clone().multiplyScalar(Math.tan(THREE.MathUtils.degToRad(horizontalDeg))))
    .add(SCREEN_UP.clone().multiplyScalar(Math.tan(THREE.MathUtils.degToRad(verticalDeg))))
    .normalize()
}

const SUN_HORIZONTAL_DEG = 14
const SUN_VERTICAL_DEG = 12
const SUN_DIRECTION = skyDirection(SUN_HORIZONTAL_DEG, SUN_VERTICAL_DEG)

/**
 * Solar System scale.
 *
 * Orbital distances use one linear factor for every planet — the spacing
 * between orbits is exactly the extract's spacing:
 *
 *     1 AU = 32 scene units          (1 unit = 1 Earth radius)
 *
 * Earth's real orbital radius is 23,481 Earth radii, so this is a uniform ~730×
 * compression of the orbit radii. Nothing else about the layout is stylised:
 * Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune sit at
 * 0.39 / 0.72 / 1 / 1.52 / 5.20 / 9.54 / 19.19 / 30.07 AU from the Sun.
 *
 * Body radii are the measured radii in Earth radii (so Jupiter really is ~11×
 * Earth), which at this distance is far below one pixel for the outer worlds —
 * hence the constant-screen-size glow, name labels and screen-space pick
 * targets. Those change how a planet is *found*, never where it is.
 */
const UNITS_PER_AU = 32
const SUN_DISTANCE = UNITS_PER_AU
const SUN_RADIUS = 3
const SUN_POSITION = SUN_DIRECTION.clone().multiplyScalar(SUN_DISTANCE)

/**
 * The ecliptic as a plane through the Sun and Earth: Earth is the scene origin,
 * so its direction from the Sun is -SUN_DIRECTION and is the plane's reference
 * axis. Planets take a deterministic starting phase (the extract carries no
 * epoch), which is illustrative — their orbital radii are not.
 */
const ORBIT_NORMAL = new THREE.Vector3()
  .crossVectors(SUN_DIRECTION, new THREE.Vector3(0, 1, 0))
  .normalize()
const ORBIT_RIGHT = SUN_DIRECTION.clone().negate().normalize()
const ORBIT_FORWARD = new THREE.Vector3().crossVectors(ORBIT_NORMAL, ORBIT_RIGHT).normalize()

function orbitPosition(au, angle) {
  const radius = au * UNITS_PER_AU
  return SUN_POSITION.clone()
    .addScaledVector(ORBIT_RIGHT, Math.cos(angle) * radius)
    .addScaledVector(ORBIT_FORWARD, Math.sin(angle) * radius)
}

/** Every Solar System world except Earth, at its own orbital distance. */
const ORBIT_SOURCES = SOLAR_WORLDS.filter((planet) => planet.id !== 'earth')

const ORBIT_BODIES = ORBIT_SOURCES.map((planet, index) => {
  /**
   * Starting phase along the orbit. The extract carries no epoch or mean
   * anomaly, so no present-day arrangement is claimed — but the phases are
   * spread evenly and rotated a third of a turn, which puts the inner system in
   * the opening frame instead of leaving it to chance. Orbital radii, and so
   * every distance between the planets, still come from the data.
   */
  const phase = THREE.MathUtils.degToRad(30) + (index / ORBIT_SOURCES.length) * Math.PI * 2
  return {
    planet,
    position: orbitPosition(planet.semiMajorAxisAu ?? 1, phase),
    // Measured radius in Earth radii, with a floor so the smallest still draws.
    radiusUnits: Math.max((planet.radiusEarth ?? 1) * 0.9, 0.14),
    color: classifyPlanet(planet).palette[2],
    ring: planet.id === 'saturn',
  }
})

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
  // Broad, very faint galactic haze.
  for (let i = 0; i < 26; i += 1) {
    const x = random() * width
    const centre = 256 + Math.sin((x / width) * Math.PI * 2) * 74
    const y = centre + (random() - 0.5) * 110
    const radius = 90 + random() * 130
    const glow = context.createRadialGradient(x, y, 0, x, y, radius)
    glow.addColorStop(0, `rgba(150,166,214,${0.026 + random() * 0.03})`)
    glow.addColorStop(1, 'rgba(120,132,190,0)')
    context.fillStyle = glow
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  // Individual dusty stars keep the band from reading as a painted smear.
  for (let i = 0; i < 7000; i += 1) {
    const x = random() * width
    const centre = 256 + Math.sin((x / width) * Math.PI * 2) * 74
    const spread = 46 + Math.sin((x / width) * Math.PI * 3) * 20
    const offset = (random() + random() + random() - 1.5) * spread
    const y = centre + offset
    const alpha = 0.04 + random() * 0.22
    context.fillStyle = `rgba(214,224,255,${alpha})`
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

  // The backdrop sits beyond Neptune's drawn orbit (~960 units out).
  return (
    <mesh rotation={[0.62, 1.15, 0.22]} scale={2600}>
      <sphereGeometry args={[1, 48, 48]} />
      <meshBasicMaterial
        map={texture}
        color="#c8d3ff"
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
 * layer is procedural filler, illustrative only.
 */
function StarField({ glow }) {
  const catalog = useMemo(() => {
    const systems = MAPPED_SYSTEMS.filter((system) => system.mapPosition && system.distanceLy > 0)
    const positions = new Float32Array(systems.length * 3)
    const colors = new Float32Array(systems.length * 3)
    const random = mulberry32(8128)
    const direction = new THREE.Vector3()
    const color = new THREE.Color()
    const white = new THREE.Color('#ffffff')
    systems.forEach((system, index) => {
      direction.set(...system.mapPosition)
      if (direction.lengthSq() === 0) return
      direction.normalize().multiplyScalar(112 + random() * 44)
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
      const radius = 118 + random() * 60
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

/** Fresnel rim: thin blue airglow on the lit limb, softer haze outside it. */
function AtmosphereShell({ scale, color, power, strength }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uSun: { value: SUN_DIRECTION.clone() },
          uPower: { value: power },
          uStrength: { value: strength },
        },
        vertexShader: /* glsl */ `
          varying vec3 vWorldNormal;
          varying vec3 vViewDirection;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vViewDirection = normalize(cameraPosition - worldPosition.xyz);
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform vec3 uSun;
          uniform float uPower;
          uniform float uStrength;
          varying vec3 vWorldNormal;
          varying vec3 vViewDirection;
          void main() {
            float rim = pow(clamp(1.0 - abs(dot(vWorldNormal, vViewDirection)), 0.0, 1.0), uPower);
            float sun = clamp(dot(vWorldNormal, normalize(uSun)), 0.0, 1.0);
            float glow = rim * uStrength * (0.16 + 0.95 * pow(sun, 0.65));
            gl_FragColor = vec4(uColor, glow);
          }
        `,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [color, power, strength],
  )

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh scale={scale} material={material}>
      <sphereGeometry args={[1, 96, 96]} />
    </mesh>
  )
}

function EarthPlaceholder() {
  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial color="#1b4f8c" roughness={0.9} metalness={0.03} />
    </mesh>
  )
}

/**
 * Earth's lit surface: NASA Blue Marble colour, terrain relief, glossy oceans
 * and a separate cloud shell. One directional light draws the day/night
 * boundary; the violet ambient keeps the night side readable at its edge.
 */
function EarthSurface() {
  const [day, normal, specular, clouds] = useLoader(THREE.TextureLoader, [
    earthDayMap,
    earthNormalMap,
    earthSpecularMap,
    earthCloudMap,
  ])
  const cloudShell = useRef()

  useMemo(() => {
    day.colorSpace = THREE.SRGBColorSpace
    clouds.colorSpace = THREE.SRGBColorSpace
    for (const texture of [day, normal, specular, clouds]) {
      texture.anisotropy = 8
      texture.wrapS = THREE.RepeatWrapping
    }
  }, [day, normal, specular, clouds])

  useFrame((_, delta) => {
    if (cloudShell.current) cloudShell.current.rotation.y += delta * 0.009
  })

  return (
    <>
      <mesh>
        <sphereGeometry args={[1, 160, 160]} />
        {/* The Sun now sits in frame, so the near hemisphere is backlit.
            A faint earthshine keeps the continents readable on the dark side. */}
        <meshPhongMaterial
          map={day}
          normalMap={normal}
          normalScale={[0.85, 0.85]}
          specularMap={specular}
          specular="#93b8e8"
          shininess={22}
          emissiveMap={day}
          emissive="#2f5f9e"
          emissiveIntensity={0.24}
        />
      </mesh>
      <mesh ref={cloudShell} scale={1.007}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshStandardMaterial
          map={clouds}
          transparent
          opacity={0.86}
          roughness={1}
          metalness={0}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}

function Earth() {
  const spin = useRef()

  useFrame((_, delta) => {
    // One slow turn: ~5 minutes, calm enough to read the terminator.
    if (spin.current) spin.current.rotation.y += delta * 0.021
  })

  return (
    <group rotation={[0, 0, EARTH_TILT]}>
      <group ref={spin}>
        <Suspense fallback={<EarthPlaceholder />}>
          <EarthSurface />
        </Suspense>
      </group>
      <AtmosphereShell scale={1.018} color="#8ec6ff" power={2.8} strength={0.95} />
      <AtmosphereShell scale={1.065} color="#3d74c8" power={1.7} strength={0.42} />
    </group>
  )
}

/** Small canvas name tag, drawn as a billboard so it always faces the camera. */
function createLabelTexture(text) {
  const width = 512
  const height = 128
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, width, height)
  context.font = '600 46px ui-sans-serif, system-ui, -apple-system, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(4, 1, 12, 0.62)'
  const metrics = context.measureText(text.toUpperCase())
  const padding = 26
  const boxX = width / 2 - metrics.width / 2 - padding
  if (typeof context.roundRect === 'function') {
    context.beginPath()
    context.roundRect(boxX, height / 2 - 38, metrics.width + padding * 2, 76, 18)
    context.fill()
  } else {
    context.fillRect(boxX, height / 2 - 38, metrics.width + padding * 2, 76)
  }
  context.fillStyle = '#eaf4ff'
  context.fillText(text.toUpperCase(), width / 2, height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/**
 * One Solar System world at its orbital position. The sphere is drawn at its
 * measured radius in Earth radii; the halo and the name tag scale with camera
 * distance so a dot 900 units away is still findable and clickable.
 */
function SolarBody({ body, glow, hovered }) {
  const node = useRef(null)
  const halo = useRef(null)
  const tag = useRef(null)
  const [label] = useState(() => createLabelTexture(body.planet.name))

  useEffect(() => () => label.dispose(), [label])

  useFrame(({ camera }) => {
    if (!node.current) return
    const distance = camera.position.distanceTo(node.current.position)
    const halfHeight = Math.tan((camera.fov * Math.PI) / 360) * distance
    if (halo.current) {
      const scale = Math.max(body.radiusUnits * 4, halfHeight * 0.028)
      halo.current.scale.set(scale, scale, 1)
      halo.current.material.opacity = hovered ? 0.9 : 0.5
    }
    if (tag.current) {
      const height = halfHeight * 0.055
      tag.current.position.set(0, Math.max(body.radiusUnits * 2, height * 1.6), 0)
      tag.current.scale.set(height * 4, height, 1)
      tag.current.material.opacity = hovered ? 1 : 0.75
    }
  })

  return (
    <group ref={node} position={body.position.toArray()}>
      <mesh>
        <sphereGeometry args={[body.radiusUnits, 32, 32]} />
        <meshStandardMaterial
          color={body.color}
          roughness={0.82}
          metalness={0.04}
          emissive={body.color}
          emissiveIntensity={hovered ? 0.55 : 0.16}
        />
      </mesh>
      {body.ring && (
        <mesh rotation={[Math.PI / 2 - 0.38, 0.28, 0]} scale={[1, 1, 0.35]}>
          <ringGeometry args={[body.radiusUnits * 1.4, body.radiusUnits * 2.15, 64]} />
          <meshBasicMaterial
            color="#d9c9a0"
            transparent
            opacity={0.72}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      <sprite ref={halo}>
        <spriteMaterial
          map={glow}
          color={body.color}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite ref={tag}>
        <spriteMaterial map={label} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  )
}

/**
 * The Sun and the seven other worlds. The Sun sits on the direction the key
 * light comes from, so Earth's lit limb and the visible star agree; every
 * planet is at its own semi-major axis from the Solar System extract.
 *
 * Clicking a planet opens the same record an exoplanet does — the entry is the
 * catalogue object itself, so `/planet/:id`, the destination picker and the
 * travel planner all see one shared planet.
 */
function SolarSystem({ glow, onSelectPlanet }) {
  const { camera, gl } = useThree()
  const [hoveredId, setHoveredId] = useState(null)
  const projection = useMemo(() => new THREE.Vector3(), [])

  const pick = useCallback(
    (clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      let best = null
      let bestDistance = 28
      for (const body of ORBIT_BODIES) {
        projection.copy(body.position).project(camera)
        if (projection.z < -1 || projection.z > 1) continue
        const screenX = (projection.x * 0.5 + 0.5) * rect.width
        const screenY = (-projection.y * 0.5 + 0.5) * rect.height
        const distance = Math.hypot(screenX - x, screenY - y)
        if (distance < bestDistance) {
          bestDistance = distance
          best = body
        }
      }
      return best
    },
    [camera, gl, projection],
  )

  useEffect(() => {
    const element = gl.domElement
    let downAt = null
    let hoveredName = null

    const handleDown = (event) => {
      downAt = { x: event.clientX, y: event.clientY }
    }
    const handleMove = (event) => {
      if (downAt) return
      const hit = pick(event.clientX, event.clientY)
      const name = hit?.planet.id ?? null
      if (name === hoveredName) return
      hoveredName = name
      setHoveredId(name)
      element.style.cursor = hit ? 'pointer' : 'grab'
    }
    const handleUp = (event) => {
      if (!downAt) return
      const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y)
      downAt = null
      if (moved > 5) return
      const hit = pick(event.clientX, event.clientY)
      if (hit) onSelectPlanet?.(hit.planet)
    }
    element.addEventListener('pointerdown', handleDown)
    element.addEventListener('pointermove', handleMove)
    element.addEventListener('pointerup', handleUp)
    return () => {
      element.removeEventListener('pointerdown', handleDown)
      element.removeEventListener('pointermove', handleMove)
      element.removeEventListener('pointerup', handleUp)
    }
  }, [gl, onSelectPlanet, pick])

  return (
    <group>
      <group position={SUN_POSITION.toArray()}>
        <mesh>
          <sphereGeometry args={[SUN_RADIUS, 48, 48]} />
          <meshBasicMaterial color="#fff4d8" toneMapped={false} />
        </mesh>
        <sprite scale={[SUN_RADIUS * 3.2, SUN_RADIUS * 3.2, 1]}>
          <spriteMaterial
            map={glow}
            color="#ffd9a0"
            transparent
            opacity={0.55}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <sprite scale={[SUN_RADIUS * 2.2, SUN_RADIUS * 2.2, 1]}>
          <spriteMaterial
            map={glow}
            color="#ffffff"
            transparent
            opacity={0.85}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      </group>

      {ORBIT_BODIES.map((body) => (
        <SolarBody
          key={body.planet.id}
          body={body}
          glow={glow}
          hovered={hoveredId === body.planet.id}
        />
      ))}
    </group>
  )
}

/** The ship holds a slow, low orbit, nose along its direction of travel. */
function OrbitingShip() {
  const group = useRef()
  const nose = useMemo(() => new THREE.Vector3(0, 0, -1), [])

  useFrame(({ clock }) => {
    if (!group.current) return
    // Start on the camera-facing side so the ship reads against the limb.
    const t = clock.elapsedTime * 0.038 + 2.4
    const radius = 1.78
    const x = Math.cos(t) * radius
    const z = Math.sin(t) * radius * 0.92
    const y = Math.sin(t * 0.7) * 0.22 + 0.16
    group.current.position.set(x, y, z)
    const tangent = new THREE.Vector3(-Math.sin(t), Math.cos(t * 0.7) * 0.16, Math.cos(t) * 0.92)
      .normalize()
    group.current.quaternion.setFromUnitVectors(nose, tangent)
  })

  return (
    <group ref={group}>
      <group scale={0.075}>
        {/* engine idle in orbit; the ship's own lamp would light Earth's night side */}
        <Spacecraft engine={0.22} glow="#9ad8ff" light={0} />
      </group>
    </group>
  )
}

/** Furthest the opening camera may pull back before the handoff gesture. */
const MAX_ORBIT_DISTANCE = 10
/** Within this share of the limit the scene is "at the limit" for the handoff. */
const LIMIT_BAND = 0.9

/**
 * Earth's orbit camera, plus the zoom-out handoff to the star map.
 *
 * The handoff used to require a nearly exact camera distance (97% of the limit)
 * *and* a fixed 220 of raw `deltaY`, which a trackpad or a coarse wheel could
 * miss entirely. It is now: engaged scene + camera inside the limit band +
 * 150 normalised pixels of outward wheel travel (lib/zoomTransition.js). The
 * latch fires once per gesture, so repeats cannot double-fire, and scrolling
 * back in clears it.
 *
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
    instance.rotateSpeed = 0.42
    instance.zoomSpeed = 0.55
    instance.minDistance = 2.35
    instance.maxDistance = MAX_ORBIT_DISTANCE
    instance.minPolarAngle = Math.PI * 0.17
    instance.maxPolarAngle = Math.PI * 0.83
    instance.autoRotate = true
    instance.autoRotateSpeed = 0.05
    instance.target.set(0, 0, 0)
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
      // The opening drift stops as soon as the visitor steers.
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

/** Keep the Sun and its neighbours in frame on tall phone screens. */
function ResponsiveFraming() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    camera.fov = aspect < 1 ? 62 : 48
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  return null
}

function Scene({ onZoomOut, onSelectPlanet, onLimitChange }) {
  const glow = useMemo(createGlowTexture, [])
  useEffect(() => () => glow.dispose(), [glow])

  return (
    <>
      <color attach="background" args={[SPACE]} />
      <ResponsiveFraming />
      <ambientLight intensity={0.18} color="#5f7bb8" />
      {/* Key light straight from the visible Sun, plus a soft camera-side fill
          so the backlit near hemisphere still reads. */}
      <directionalLight
        position={SUN_DIRECTION.clone().multiplyScalar(12).toArray()}
        intensity={2.4}
        color={SUN_COLOR}
      />
      <directionalLight position={[2.6, 1.2, 5.5]} intensity={1.0} color="#8fb6e8" />
      <MilkyWay />
      <StarField glow={glow} />
      <SolarSystem glow={glow} onSelectPlanet={onSelectPlanet} />
      <Earth />
      <OrbitingShip />
      <OrbitRig onZoomOut={onZoomOut} onLimitChange={onLimitChange} />
    </>
  )
}

const OrbitCanvas = memo(function OrbitCanvas({ onZoomOut, onSelectPlanet }) {
  const [atLimit, setAtLimit] = useState(false)

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 48, position: HOME_CAMERA.toArray(), near: 0.1, far: 4000 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          // Neptune is ~960 units out; a logarithmic depth buffer keeps Earth's
          // surface free of z-fighting across that range.
          logarithmicDepthBuffer: true,
        }}
      >
        <Scene
          onZoomOut={onZoomOut}
          onSelectPlanet={onSelectPlanet}
          onLimitChange={setAtLimit}
        />
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

export default function EarthOrbitScene({ onZoomOut, onSelectPlanet }) {
  if (!HAS_WEBGL) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#04010c] p-6 text-center">
        <p className="max-w-[300px] text-[12px] leading-relaxed text-ink/65">
          This browser could not start WebGL, so the Earth orbit scene cannot draw. Enable
          hardware acceleration and reload to begin the journey.
        </p>
      </div>
    )
  }

  return <OrbitCanvas onZoomOut={onZoomOut} onSelectPlanet={onSelectPlanet} />
}
