import { memo, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  createPlanetTexture,
  classifyPlanet,
  starAngularDiameterDeg,
  starColor,
  describeStar,
  mulberry32,
  hashString,
} from '../lib/planet'
import { EARTH_ATMOSPHERE, EARTH_SUN_DIRECTION, useEarthTextures } from '../lib/earthTexture'
import { describeAge } from '../lib/aging'
import { formatNumber } from '../lib/physics'
import BobbleFigure from './BobbleFigure'
import SkeletonFigure from './SkeletonFigure'

const UP = new THREE.Vector3(0, 1, 0)

/* Where the host star sits in an exoplanet's sky; Earth aims its own star at
 * EARTH_SUN_DIRECTION so the day side matches the real planet. */
const STAR_DIRECTION = [-0.55, 0.45, -0.7]
const EARTH_NORMAL_SCALE = new THREE.Vector2(0.9, 0.9)

/* The crew stands on the surface, so their size is fixed in planet radii.
 * ~0.07 of a planet radius keeps a human visible without pretending a person is
 * a meaningful fraction of a world. */
const CREW_SCALE = 0.07

function PlanetMesh({ planet, earthYears, alienYears }) {
  const isEarth = planet.kind === 'earth'
  const { texture, look } = useMemo(() => createPlanetTexture(planet), [planet])
  // Earth is the one world with a known surface: real continents, relief, ocean
  // glint, city lights and a cloud shell instead of an inferred palette.
  const earthTextures = useEarthTextures()
  const earth = isEarth ? earthTextures : null
  const tilt = useMemo(() => {
    if (isEarth) return 0.409 // 23.4° axial tilt
    const rand = mulberry32(hashString(planet.name))
    return rand() * 0.5 - 0.25
  }, [isEarth, planet.name])
  const spin = useRef()
  const clouds = useRef()

  useEffect(() => () => texture.dispose(), [texture])

  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.02
    if (clouds.current) clouds.current.rotation.y += delta * 0.028
  })

  return (
    <group rotation={[0, 0, tilt]}>
      <group ref={spin}>
        <mesh>
          <sphereGeometry args={[1, 128, 128]} />
          {earth ? (
            <meshPhongMaterial
              map={earth.surface}
              normalMap={earth.normal}
              normalScale={EARTH_NORMAL_SCALE}
              specularMap={earth.specular}
              specular="#3a6484"
              shininess={24}
            />
          ) : (
            <meshStandardMaterial map={texture} roughness={0.9} metalness={0.03} />
          )}
        </mesh>
        {earth && <NightLights map={earth.lights} />}
        <SurfaceCrew planet={planet} look={look} earthYears={earthYears} alienYears={alienYears} />
      </group>
      {earth && (
        <mesh ref={clouds} scale={1.008}>
          <sphereGeometry args={[1, 128, 128]} />
          <meshPhongMaterial
            color="#ffffff"
            alphaMap={earth.clouds}
            transparent
            opacity={0.92}
            depthWrite={false}
            shininess={2}
          />
        </mesh>
      )}
      <Atmosphere color={earth ? EARTH_ATMOSPHERE : look.atmosphere} rim={isEarth} />
    </group>
  )
}

/**
 * City lights. They ride on a shell just above the surface and are masked by the
 * same direction as Earth's sun, so they only appear where the planet is dark —
 * the warm dotted edge along the night side that makes the globe read as inhabited.
 */
function NightLights({ map }) {
  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uSun: { value: new THREE.Vector3(...EARTH_SUN_DIRECTION).normalize() },
      uIntensity: { value: 1 },
    }),
    [map],
  )

  return (
    <mesh scale={1.002}>
      <sphereGeometry args={[1, 128, 128]} />
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vWorldNormal;
          void main() {
            vUv = uv;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform sampler2D uMap;
          uniform vec3 uSun;
          uniform float uIntensity;
          varying vec2 vUv;
          varying vec3 vWorldNormal;
          void main() {
            vec3 lights = texture2D(uMap, vUv).rgb;
            float lit = dot(normalize(vWorldNormal), normalize(uSun));
            float night = 1.0 - smoothstep(-0.22, 0.14, lit);
            gl_FragColor = vec4(lights * night * uIntensity, 1.0);
          }
        `}
      />
    </mesh>
  )
}

/**
 * Atmospheric glow. Earth keeps the soft rim shader that reads as a real
 * planet limb; the inferred worlds use the flat shell.
 */
function Atmosphere({ color, rim = false }) {
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(color) } }), [color])

  if (rim) {
    return (
      <mesh scale={1.045}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vNormal = normalize(normalMatrix * normal);
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              float rim = 1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0);
              gl_FragColor = vec4(uColor, pow(rim, 2.6) * 0.85);
            }
          `}
        />
      </mesh>
    )
  }

  return (
    <mesh scale={1.03}>
      <sphereGeometry args={[1, 48, 48]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.14}
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

function SurfaceAnchor({ normal, children }) {
  const { position, quaternion } = useMemo(() => {
    const direction = new THREE.Vector3(...normal).normalize()
    return {
      position: direction.clone().multiplyScalar(1.001).toArray(),
      quaternion: new THREE.Quaternion().setFromUnitVectors(UP, direction),
    }
  }, [normal])

  return (
    <group position={position} quaternion={quaternion}>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.032, 20]} />
        <meshBasicMaterial color="#9a0680" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {children}
    </group>
  )
}

function SurfaceCrew({ planet, look, earthYears, alienYears }) {
  const isEarth = planet.kind === 'earth'
  const humanStage = describeAge(earthYears).stage.id
  const alienStage = describeAge(alienYears).stage.id
  const skeletonHuman = humanStage === 'skeleton'
  const skeletonAlien = alienStage === 'skeleton'

  return (
    <>
      <SurfaceAnchor normal={[0.42, 0.3, 0.86]}>
        <group scale={CREW_SCALE}>
          {skeletonHuman ? (
            <SkeletonFigure
              shape={{ legH: 0.24, bodyH: 0.44, bodyW: 0.17, headR: 0.25, armL: 0.23 }}
              species="human"
            />
          ) : (
            <BobbleFigure
              stage={humanStage}
              species="human"
              accent="#9a0680"
              position={[0, 0, 0]}
              scale={1}
              seed={1}
            />
          )}
        </group>
      </SurfaceAnchor>

      {/* Local life is only ever present on an exoplanet. */}
      {!isEarth && (
        <SurfaceAnchor normal={[-0.38, 0.18, 0.9]}>
          <group scale={CREW_SCALE}>
            {skeletonAlien ? (
              <SkeletonFigure
                shape={{ legH: 0.24, bodyH: 0.44, bodyW: 0.17, headR: 0.25, armL: 0.23 }}
                species="alien"
                accent={look.palette[2]}
              />
            ) : (
              <BobbleFigure
                stage={alienStage}
                species="alien"
                skin={look.palette[2]}
                accent={look.palette[2]}
                position={[0, 0, 0]}
                scale={1}
                seed={3}
              />
            )}
          </group>
        </SurfaceAnchor>
      )}
    </>
  )
}

/**
 * The star sits in the sky at a fixed viewing distance and its radius is sized
 * from the *real* apparent angular diameter of the host star seen from this
 * planet's orbit — so a hot Jupiter's sun fills the sky while a distant world
 * sees a small disc. Star and planet therefore keep their true relative size.
 */
function HostStar({ planet, direction = STAR_DIRECTION, intensity = 2.4 }) {
  const color = useMemo(() => starColor(planet.starTeffK), [planet.starTeffK])
  const angle = starAngularDiameterDeg(planet) ?? 1.5
  const distance = 20
  const radius = THREE.MathUtils.clamp(Math.tan((angle * Math.PI) / 360) * distance, 0.08, 7)
  const position = useMemo(() => {
    const vector = new THREE.Vector3(...direction).normalize()
    return vector.multiplyScalar(distance).toArray()
  }, [direction])

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 40, 40]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh scale={1.35}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <directionalLight position={[0, 0, 0]} intensity={intensity} color={color} />
    </group>
  )
}

function StarField() {
  const geometry = useMemo(() => {
    const count = 1600
    const positions = new Float32Array(count * 3)
    const rand = mulberry32(1337)
    for (let i = 0; i < count; i += 1) {
      const u = rand() * 2 - 1
      const theta = rand() * Math.PI * 2
      const radius = 45 + rand() * 55
      const s = Math.sqrt(1 - u * u)
      positions[i * 3] = Math.cos(theta) * s * radius
      positions[i * 3 + 1] = u * radius
      positions[i * 3 + 2] = Math.sin(theta) * s * radius
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return buffer
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={0.42}
        color="#ffffff"
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </points>
  )
}

function OrbitRig() {
  const { camera, gl } = useThree()
  const controls = useRef(null)

  useEffect(() => {
    const instance = new ThreeOrbitControls(camera, gl.domElement)
    instance.enablePan = false
    instance.enableDamping = true
    instance.dampingFactor = 0.08
    instance.rotateSpeed = 0.55
    instance.zoomSpeed = 0.65
    instance.minDistance = 1.45
    instance.maxDistance = 6
    instance.minPolarAngle = Math.PI * 0.16
    instance.maxPolarAngle = Math.PI * 0.84
    instance.target.set(0, 0, 0)
    controls.current = instance
    return () => instance.dispose()
  }, [camera, gl])

  useFrame(() => controls.current?.update())
  return null
}

function Scene({ planet, earthYears, alienYears }) {
  const isEarth = planet.kind === 'earth'
  return (
    <>
      <ambientLight intensity={isEarth ? 0.08 : 0.22} />
      {/* camera-side fill so the visible hemisphere reads; the host star is the key light */}
      <directionalLight
        position={[2.6, 1.2, 5.5]}
        intensity={isEarth ? 0.3 : 0.95}
        color="#ffffff"
      />
      <StarField />
      <HostStar
        planet={planet}
        direction={isEarth ? EARTH_SUN_DIRECTION : STAR_DIRECTION}
        intensity={isEarth ? 2 : 2.4}
      />
      <PlanetMesh planet={planet} earthYears={earthYears} alienYears={alienYears} />
      <OrbitRig />
    </>
  )
}

function PlanetStage({ planet, earthYears, alienYears, compact = false, onGoHome }) {
  const look = classifyPlanet(planet)
  const star = describeStar(planet)
  const starAngle = starAngularDiameterDeg(planet)
  const human = describeAge(earthYears)
  const alien = describeAge(alienYears)
  const isEarth = planet.kind === 'earth'

  return (
    <div className="panel relative overflow-hidden">
      <div className="relative h-[400px] sm:h-[460px] lg:h-[560px]">
        <div className="absolute inset-0 bg-void" />
        <Canvas
          dpr={[1, 2]}
          camera={{ fov: 40, position: [0, 0.55, 3.9], near: 0.1, far: 400 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Scene planet={planet} earthYears={earthYears} alienYears={alienYears} />
        </Canvas>

        <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
          <div>
            <div className="label">{isEarth ? 'You are here' : 'Current location'}</div>
            <h2 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
              {planet.name}
            </h2>
            <div className="mt-1 text-[11px] text-ink/70">
              {planet.star ?? planet.name} ·{' '}
              {isEarth ? 'origin' : `${formatNumber(planet.distanceLy, 2)} ly from Earth`}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="rounded-full border border-line/70 bg-void/80 px-2.5 py-1 text-[10px] tracking-[0.16em] text-ink/75 uppercase">
              {look.label}
            </span>
            <span className="rounded-full border border-line/60 bg-void/80 px-2.5 py-1 text-[10px] text-ink/70">
              {star.name}
              {starAngle != null
                ? ` · ${starAngle < 1 ? starAngle.toFixed(2) : starAngle.toFixed(1)}° wide`
                : ''}
            </span>
            <span className="rounded-full border border-line/60 bg-void/80 px-2.5 py-1 text-[10px] text-ink/60">
              orbit{' '}
              {planet.semiMajorAxisAu != null
                ? `${formatNumber(planet.semiMajorAxisAu, planet.semiMajorAxisAu < 0.1 ? 3 : 2)} AU`
                : 'unknown'}
            </span>
          </div>
        </div>

        {!compact && (
          <>
            <div className="pointer-events-none absolute bottom-3 left-3 max-w-[46%] rounded-xl border border-line/60 bg-void/85 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9a0680]" />
                <span className="label text-[9px]">{isEarth ? 'Crew on Earth' : 'You (crew)'}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-ink">{human.label}</div>
            </div>
            {!isEarth && (
              <div className="pointer-events-none absolute right-3 bottom-3 max-w-[46%] rounded-xl border border-line/60 bg-void/85 px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: look.palette[2] }} />
                  <span className="label text-[9px]">Local life</span>
                </div>
                <div className="mt-0.5 text-[11px] text-ink">{alien.label}</div>
              </div>
            )}
          </>
        )}

        {!isEarth && onGoHome && (
          <button
            type="button"
            onClick={onGoHome}
            className="btn absolute right-3 bottom-16 px-3 py-1.5 text-xs"
          >
            ← Go home to Earth
          </button>
        )}

        {!compact && (
          <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center">
            <span className="text-[10px] tracking-[0.18em] text-ink/35 uppercase">
              drag to orbit · scroll to zoom
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(PlanetStage)
