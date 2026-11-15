import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MAPPED_SYSTEMS } from '../../lib/catalog'
import { mulberry32, starColor } from '../../lib/planet'
import { thinSkyStars } from '../../lib/skyStars'
import { createZoomOutLatch, wheelPixels } from '../../lib/zoomTransition'
import { createGlowTexture } from '../../lib/glowTexture'
import { createSunSurfaceTexture } from '../../lib/sunSurface'
import { HAS_WEBGL } from '../../lib/webgl'
import EarthSphere from '../EarthSphere'

/**
 * The opening scene: Earth, close up and filling the frame, with the rest of the
 * Solar System in the sky behind it.
 *
 * Scale note — one scene unit is one Earth radius (6,371 km). The Sun and the
 * neighbouring worlds behind it are drawn far smaller than their true angular
 * size would be at that range; this is a composition, not an ephemeris. The
 * headline Earth is the real thing: NASA's Blue Marble day colour, relief,
 * ocean gloss and cloud shell, so the journey starts on the world we know.
 */

const SPACE = '#04010c'
/** Everything that is "sky" (stars, Milky Way, the distant system) sits here. */
const SKY_RADIUS = 600
const EARTH_TILT = THREE.MathUtils.degToRad(23.4)
const TAU = Math.PI * 2

/** Opening viewpoint: close enough that Earth fills the frame. */
const HOME_CAMERA = new THREE.Vector3(0.86, 0.47, 3.2)
/**
 * Earth is staged low and left so the upper-right of the frame is open sky —
 * that is where the Sun and the rest of the system hang.
 */
const VIEW_SHIFT_X = 0.11
const VIEW_SHIFT_Y = -0.13
const CAMERA_AXIS = HOME_CAMERA.clone().normalize()
const SCREEN_RIGHT = new THREE.Vector3()
  .crossVectors(new THREE.Vector3(0, 1, 0), CAMERA_AXIS)
  .normalize()
const SCREEN_UP = new THREE.Vector3().crossVectors(CAMERA_AXIS, SCREEN_RIGHT).normalize()

/**
 * The Sun is staged just beyond Earth's upper-right limb, and the key light
 * carries the same offset, so the brightest part of Earth's disc and the limb
 * glow both face the visible Sun. One offset, one reading — see the scale note
 * above: a real Sun this close to Earth's disc would put us on the night side,
 * which is not the opening shot this screen is for.
 */
const SUN_ANGLE = THREE.MathUtils.degToRad(22)
const SUN_AZIMUTH = THREE.MathUtils.degToRad(34)
const SUN_DISTANCE = 400
/** Screen-space offset of the Sun (up and to the right) from Earth's centre. */
const SUN_OFFSET = SCREEN_UP.clone()
  .multiplyScalar(Math.sin(SUN_ANGLE) * Math.cos(SUN_AZIMUTH))
  .add(SCREEN_RIGHT.clone().multiplyScalar(Math.sin(SUN_ANGLE) * Math.sin(SUN_AZIMUTH)))
/** Where the Sun is drawn: past Earth, so it sits in the sky on screen. */
const SUN_DIRECTION = SUN_OFFSET.clone()
  .addScaledVector(CAMERA_AXIS, -Math.cos(SUN_ANGLE))
  .normalize()
/** Where the light comes from: the same direction seen from the camera side. */
const SUN_LIGHT_DIRECTION = SUN_OFFSET.clone()
  .addScaledVector(CAMERA_AXIS, Math.cos(SUN_ANGLE))
  .normalize()
const SUN_POSITION = SUN_DIRECTION.clone().multiplyScalar(SUN_DISTANCE)
const SUN_LIGHT_POSITION = SUN_LIGHT_DIRECTION.clone().multiplyScalar(SUN_DISTANCE)
const SUN_RADIUS = SUN_DISTANCE * Math.tan(THREE.MathUtils.degToRad(2.6))

/** The system's orbit plane, seen from Earth: tilted, mostly face-on. */
const SYSTEM_ROTATION = new THREE.Quaternion()
  .setFromAxisAngle(SCREEN_RIGHT, THREE.MathUtils.degToRad(32))
  .multiply(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), CAMERA_AXIS),
  )

/** The other worlds in the sky — illustrative companions, not true positions. */
const NEIGHBOURS = [
  { orbit: 45, angle: 0.4, size: 3, color: '#f2dcae' },
  { orbit: 45, angle: 3.5, size: 2.4, color: '#d9c39a' },
  { orbit: 70, angle: 5.4, size: 6, color: '#e8c79a', halo: '#ffd9a1', haloScale: 3 },
  { orbit: 100, angle: 3.4, size: 5, color: '#dbc79b', ring: true },
  { orbit: 130, angle: 1.1, size: 3.8, color: '#a9c9e6', halo: '#bcdcf5', haloScale: 3 },
]

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
    <mesh rotation={[0.55, 1.3, 0.24]} scale={SKY_RADIUS * 1.6}>
      <sphereGeometry args={[1, 48, 48]} />
      <meshBasicMaterial
        map={texture}
        color="#d9c8ff"
        side={THREE.BackSide}
        transparent
        opacity={0.7}
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
      direction.normalize().multiplyScalar(SKY_RADIUS * (0.9 + random() * 0.15))
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
      const radius = SKY_RADIUS * (0.94 + random() * 0.06)
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
          size={2.6}
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

/* ------------------------------------------------------------------ Earth -- */

/** Fresnel rim: thin blue airglow on the lit limb, softer haze outside it. */
function AtmosphereShell({ scale, color, power, strength }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uSun: { value: SUN_LIGHT_DIRECTION.clone() },
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

function Earth() {
  const spin = useRef()

  useFrame((_, delta) => {
    // One calm turn, slow enough to read the continents.
    if (spin.current) spin.current.rotation.y += delta * 0.02
  })

  return (
    <group rotation={[0, 0, EARTH_TILT]}>
      <group ref={spin} rotation={[0, -2.36, 0]}>
        <EarthSphere radius={1} segments={160} cloudOpacity={0.9} />
      </group>
      <AtmosphereShell scale={1.014} color="#8ec6ff" power={2.8} strength={0.95} />
      <AtmosphereShell scale={1.055} color="#3d74c8" power={1.7} strength={0.4} />
    </group>
  )
}

/* ------------------------------------------------------- the Solar System -- */

/** The Sun, small in the distance: textured photosphere wrapped in warm glows. */
function Sun({ glow }) {
  const surface = useMemo(createSunSurfaceTexture, [])
  const core = useRef()
  useEffect(() => () => surface.dispose(), [surface])
  useFrame((_, delta) => {
    if (core.current) core.current.rotation.y += delta * 0.03
  })

  const layers = [
    { scale: 1.5, color: '#fff2cf', opacity: 0.9 },
    { scale: 2.6, color: '#ffb75e', opacity: 0.45 },
    { scale: 4.6, color: '#ff8a24', opacity: 0.16 },
  ]

  return (
    <group>
      <mesh ref={core}>
        <sphereGeometry args={[SUN_RADIUS, 48, 48]} />
        <meshBasicMaterial map={surface} toneMapped={false} />
      </mesh>
      {layers.map((layer) => (
        <sprite key={layer.scale} scale={[SUN_RADIUS * layer.scale, SUN_RADIUS * layer.scale, 1]}>
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
    </group>
  )
}

/** One drawn orbit around the Sun — a thin cool ring, as on the star map. */
function OrbitArc({ radius }) {
  const geometry = useMemo(() => {
    const segments = 220
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
      <lineBasicMaterial color="#5f93c9" transparent opacity={0.45} depthWrite={false} />
    </lineLoop>
  )
}

/** A neighbour on its orbit: a small bright disc, plus Saturn's ring and halos. */
function Neighbour({ body, glow }) {
  const position = useMemo(
    () => new THREE.Vector3(Math.cos(body.angle) * body.orbit, 0, Math.sin(body.angle) * body.orbit),
    [body],
  )

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[body.size, 24, 24]} />
        <meshBasicMaterial color={body.color} toneMapped={false} />
      </mesh>
      {body.ring && (
        <mesh rotation={[-Math.PI / 2 + 0.42, 0, 0.3]}>
          <ringGeometry args={[body.size * 1.45, body.size * 2.4, 64]} />
          <meshBasicMaterial
            color="#d8c39a"
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
      {body.halo && (
        <sprite scale={[body.size * body.haloScale, body.size * body.haloScale, 1]}>
          <spriteMaterial
            map={glow}
            color={body.halo}
            transparent
            opacity={0.4}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      )}
    </group>
  )
}

/** The rest of the system, hanging in the sky behind Earth. */
function SolarSystemBackdrop({ glow }) {
  return (
    <group position={SUN_POSITION} quaternion={SYSTEM_ROTATION}>
      <Sun glow={glow} />
      {[45, 70, 100, 130].map((radius) => (
        <OrbitArc key={radius} radius={radius} />
      ))}
      {NEIGHBOURS.map((body, index) => (
        <Neighbour key={index} body={body} glow={glow} />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------- interaction -- */

/**
 * Orbit Earth, plus the zoom-out handoff to the star map: engaged scene +
 * camera inside the limit band + 150 normalised pixels of outward wheel travel.
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
    instance.zoomSpeed = 0.5
    instance.minDistance = 2.15
    instance.maxDistance = 8.4
    instance.minPolarAngle = Math.PI * 0.12
    instance.maxPolarAngle = Math.PI * 0.88
    instance.autoRotate = true
    instance.autoRotateSpeed = 0.07
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
      const withinLimit = distance >= instance.maxDistance * 0.9

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

/**
 * Frame the globe: a wide lens on tall screens, and Earth set a little below
 * centre so the Sun and the drawn orbits keep the upper band of the sky.
 */
function ResponsiveFraming() {
  const { camera, size } = useThree()
  useEffect(() => {
    const width = Math.max(1, size.width)
    const height = Math.max(1, size.height)
    const aspect = width / height
    camera.fov = aspect < 1 ? 54 : 46
    camera.setViewOffset(
      width,
      height,
      width * VIEW_SHIFT_X,
      height * VIEW_SHIFT_Y,
      width,
      height,
    )
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  return null
}

function Scene({ onZoomOut, onLimitChange }) {
  const glow = useMemo(createGlowTexture, [])
  useEffect(() => () => glow.dispose(), [glow])

  return (
    <>
      <color attach="background" args={[SPACE]} />
      <ResponsiveFraming />
      <ambientLight intensity={0.1} color="#5f7bb8" />
      <directionalLight position={SUN_LIGHT_POSITION} intensity={2.7} color="#fff1d6" />
      <MilkyWay />
      <StarField glow={glow} />
      <SolarSystemBackdrop glow={glow} />
      <Earth />
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
        camera={{ fov: 44, position: HOME_CAMERA.toArray(), near: 0.05, far: SKY_RADIUS * 4 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <Scene onZoomOut={onZoomOut} onLimitChange={setAtLimit} />
      </Canvas>

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

export default function EarthCloseupScene({ onZoomOut }) {
  if (!HAS_WEBGL) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#04010c] p-6 text-center">
        <p className="max-w-[300px] text-[12px] leading-relaxed text-ink/65">
          This browser could not start WebGL, so the Earth view cannot draw. Enable hardware
          acceleration and reload to begin the journey.
        </p>
      </div>
    )
  }

  return <OrbitCanvas onZoomOut={onZoomOut} />
}
