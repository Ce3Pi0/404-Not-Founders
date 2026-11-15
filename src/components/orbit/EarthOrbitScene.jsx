import { memo, Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import earthDayMap from '../../assets/earth/earth_atmos_2048.jpg'
import earthNormalMap from '../../assets/earth/earth_normal_2048.jpg'
import earthSpecularMap from '../../assets/earth/earth_specular_2048.jpg'
import earthCloudMap from '../../assets/earth/earth_clouds_1024.png'
import { MAPPED_SYSTEMS } from '../../lib/catalog'
import { mulberry32, starColor } from '../../lib/planet'
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
/** One direction for sunlight, atmosphere rim and shadow, so they agree. */
const SUN_DIRECTION = new THREE.Vector3(-0.72, 0.3, 0.42).normalize()
const SUN_COLOR = '#fff3e2'
const SPACE = '#04010c'

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

  return (
    <mesh rotation={[0.62, 1.15, 0.22]} scale={260}>
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
        <meshPhongMaterial
          map={day}
          normalMap={normal}
          normalScale={[0.85, 0.85]}
          specularMap={specular}
          specular="#93b8e8"
          shininess={22}
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

/** The ship holds a slow, low orbit, nose along its direction of travel. */
function OrbitingShip() {
  const group = useRef()
  const nose = useMemo(() => new THREE.Vector3(0, 0, -1), [])

  useFrame(({ clock }) => {
    if (!group.current) return
    // Start on the Sun-facing side so the ship reads against the lit Earth.
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

function OrbitRig({ onZoomOut }) {
  const { camera, gl } = useThree()
  const controls = useRef(null)
  const zoomOut = useRef(onZoomOut)
  zoomOut.current = onZoomOut

  useEffect(() => {
    const instance = new OrbitControls(camera, gl.domElement)
    instance.enablePan = false
    instance.enableDamping = true
    instance.dampingFactor = 0.05
    instance.rotateSpeed = 0.42
    instance.zoomSpeed = 0.55
    instance.minDistance = 2.35
    instance.maxDistance = 7.4
    instance.minPolarAngle = Math.PI * 0.17
    instance.maxPolarAngle = Math.PI * 0.83
    instance.autoRotate = true
    instance.autoRotateSpeed = 0.05
    instance.target.set(0, 0, 0)
    instance.update()
    controls.current = instance

    // Scrolling out at the zoom limit is the gesture that leaves orbit: once
    // the camera is fully back and the user keeps pulling, hand off to the map.
    let pull = 0
    const handleWheel = (event) => {
      const distance = camera.position.distanceTo(instance.target)
      if (event.deltaY > 0 && distance > instance.maxDistance * 0.97) {
        pull += event.deltaY
        if (pull > 220) {
          pull = 0
          zoomOut.current?.()
        }
      } else {
        pull = 0
      }
    }
    gl.domElement.addEventListener('wheel', handleWheel, { passive: true })
    return () => {
      gl.domElement.removeEventListener('wheel', handleWheel)
      instance.dispose()
    }
  }, [camera, gl])

  useFrame(() => controls.current?.update())
  return null
}

function Scene({ onZoomOut }) {
  const glow = useMemo(createGlowTexture, [])
  useEffect(() => () => glow.dispose(), [glow])

  return (
    <>
      <color attach="background" args={[SPACE]} />
      <ambientLight intensity={0.09} color="#5f7bb8" />
      <directionalLight
        position={SUN_DIRECTION.clone().multiplyScalar(12).toArray()}
        intensity={2.6}
        color={SUN_COLOR}
      />
      <MilkyWay />
      <StarField glow={glow} />
      <Earth />
      <OrbitingShip />
      <OrbitRig onZoomOut={onZoomOut} />
    </>
  )
}

const OrbitCanvas = memo(function OrbitCanvas({ onZoomOut }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 34, position: [2.3, 1.5, 5.9], near: 0.05, far: 1200 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <Scene onZoomOut={onZoomOut} />
    </Canvas>
  )
})

export default function EarthOrbitScene({ onZoomOut }) {
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

  return <OrbitCanvas onZoomOut={onZoomOut} />
}
