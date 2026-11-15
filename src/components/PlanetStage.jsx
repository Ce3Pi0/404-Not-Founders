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
import { describeAge } from '../lib/aging'
import { formatNumber } from '../lib/physics'
import BobbleFigure from './BobbleFigure'
import SkeletonFigure from './SkeletonFigure'

const UP = new THREE.Vector3(0, 1, 0)

/* The crew stands on the surface, so their size is fixed in planet radii.
 * ~0.07 of a planet radius keeps a human visible without pretending a person is
 * a meaningful fraction of a world. */
const CREW_SCALE = 0.07

function PlanetMesh({ planet, earthYears, alienYears }) {
  const { texture, look } = useMemo(() => createPlanetTexture(planet), [planet])
  const tilt = useMemo(() => {
    const rand = mulberry32(hashString(planet.name))
    return rand() * 0.5 - 0.25
  }, [planet.name])
  const spin = useRef()

  useEffect(() => () => texture.dispose(), [texture])

  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.02
  })

  return (
    <group rotation={[0, 0, tilt]}>
      <group ref={spin}>
        <mesh>
          <sphereGeometry args={[1, 96, 96]} />
          <meshStandardMaterial map={texture} roughness={0.9} metalness={0.03} />
        </mesh>
        <SurfaceCrew planet={planet} look={look} earthYears={earthYears} alienYears={alienYears} />
      </group>
      <Atmosphere color={look.atmosphere} />
    </group>
  )
}

function Atmosphere({ color }) {
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
function HostStar({ planet }) {
  const color = useMemo(() => starColor(planet.starTeffK), [planet.starTeffK])
  const angle = starAngularDiameterDeg(planet) ?? 1.5
  const distance = 20
  const radius = THREE.MathUtils.clamp(Math.tan((angle * Math.PI) / 360) * distance, 0.08, 7)
  const position = useMemo(() => {
    const direction = new THREE.Vector3(-0.55, 0.45, -0.7).normalize()
    return direction.multiplyScalar(distance).toArray()
  }, [])

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
      <directionalLight position={[0, 0, 0]} intensity={2.4} color={color} />
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
  return (
    <>
      <ambientLight intensity={0.22} />
      {/* camera-side fill so the visible hemisphere reads; the host star is the key light */}
      <directionalLight position={[2.6, 1.2, 5.5]} intensity={0.95} color="#ffffff" />
      <StarField />
      <HostStar planet={planet} />
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
            <div className="num mt-1 text-[11px] text-ink/70">
              {planet.star ?? planet.name} ·{' '}
              {isEarth ? 'origin' : `${formatNumber(planet.distanceLy, 2)} ly from Earth`}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="rounded-full border border-line/70 bg-void/80 px-2.5 py-1 text-[10px] tracking-[0.16em] text-ink/75 uppercase">
              {look.label}
            </span>
            <span className="num rounded-full border border-line/60 bg-void/80 px-2.5 py-1 text-[10px] text-ink/70">
              {star.name}
              {starAngle != null
                ? ` · ${starAngle < 1 ? starAngle.toFixed(2) : starAngle.toFixed(1)}° wide`
                : ''}
            </span>
            <span className="num rounded-full border border-line/60 bg-void/80 px-2.5 py-1 text-[10px] text-ink/60">
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
              <div className="num mt-0.5 text-[11px] text-ink">{human.label}</div>
            </div>
            {!isEarth && (
              <div className="pointer-events-none absolute right-3 bottom-3 max-w-[46%] rounded-xl border border-line/60 bg-void/85 px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: look.palette[2] }} />
                  <span className="label text-[9px]">Local life</span>
                </div>
                <div className="num mt-0.5 text-[11px] text-ink">{alien.label}</div>
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
