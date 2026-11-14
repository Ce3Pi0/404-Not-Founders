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

function PlanetMesh({ planet }) {
  const { texture, look } = useMemo(() => createPlanetTexture(planet), [planet])
  const tilt = useMemo(() => {
    const rand = mulberry32(hashString(planet.name))
    return rand() * 0.5 - 0.25
  }, [planet.name])
  const spin = useRef()

  useEffect(() => () => texture.dispose(), [texture])

  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.05
  })

  return (
    <group rotation={[0, 0, tilt]}>
      <mesh ref={spin}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshStandardMaterial map={texture} roughness={0.9} metalness={0.03} />
      </mesh>
      <Atmosphere color={look.atmosphere} />
    </group>
  )
}

function Atmosphere({ color }) {
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(color) } }), [color])
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

function HostStar({ planet }) {
  const color = useMemo(() => starColor(planet.starTeffK), [planet.starTeffK])
  const position = useMemo(() => [2.0, 1.7, -2.8], [])
  const angle = starAngularDiameterDeg(planet) ?? 1.5
  const distance = Math.hypot(position[0], position[1], position[2])
  // A small visual floor keeps a genuinely tiny host star visible on screen.
  const radius = THREE.MathUtils.clamp(Math.tan((angle * Math.PI) / 360) * distance, 0.22, 2.4)

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 40, 40]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh scale={1.5}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.26}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={2.6}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <directionalLight position={[0, 0, 0]} intensity={2.6} color={color} />
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
        color="#d6ecff"
        sizeAttenuation
        transparent
        opacity={0.8}
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
    instance.minDistance = 2.15
    instance.maxDistance = 4.4
    instance.minPolarAngle = Math.PI * 0.16
    instance.maxPolarAngle = Math.PI * 0.84
    instance.target.set(0, 0, 0)
    controls.current = instance
    return () => instance.dispose()
  }, [camera, gl])

  useFrame(() => controls.current?.update())
  return null
}

function Crew({ planet, earthYears, alienYears }) {
  const { viewport } = useThree()
  const spread = Math.min(1.42, viewport.width * 0.35)
  const baseY = -Math.min(1.02, Math.max(0.72, viewport.height * 0.34))
  const figureScale = THREE.MathUtils.clamp(viewport.width * 0.17, 0.36, 0.6)
  const look = classifyPlanet(planet)
  const alienStage = describeAge(alienYears).stage
  const humanStage = describeAge(earthYears).stage

  return (
    <>
      <BobbleFigure
        stage={humanStage.id}
        species="human"
        accent="#5ee7ff"
        position={[-spread, baseY, 0.62]}
        scale={figureScale}
        seed={1}
      />
      <BobbleFigure
        stage={alienStage.id}
        species="alien"
        skin={look.palette[2]}
        accent={look.palette[2]}
        position={[spread, baseY, 0.62]}
        scale={figureScale}
        seed={3}
      />
    </>
  )
}

function Scene({ planet, earthYears, alienYears }) {
  return (
    <>
      <ambientLight intensity={0.26} />
      {/* Camera-side fill so the visible hemisphere reads; the host star is the key light. */}
      <directionalLight position={[2.6, 1.2, 5.5]} intensity={1.05} color="#a9cfff" />
      <StarField />
      <HostStar planet={planet} />
      <PlanetMesh planet={planet} />
      <Crew planet={planet} earthYears={earthYears} alienYears={alienYears} />
      <OrbitRig />
    </>
  )
}

function PlanetStage({ planet, earthYears, alienYears, compact = false }) {
  const look = classifyPlanet(planet)
  const star = describeStar(planet)
  const starAngle = starAngularDiameterDeg(planet)
  const human = describeAge(earthYears)
  const alien = describeAge(alienYears)

  return (
    <div className="panel relative overflow-hidden">
      <div className="relative h-[400px] sm:h-[460px] lg:h-[560px]">
        <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_70%_10%,rgba(94,231,255,0.12),transparent_55%),radial-gradient(90%_80%_at_20%_90%,rgba(167,139,250,0.14),transparent_60%),linear-gradient(180deg,#060a12,#04060b)]" />
        <Canvas
          dpr={[1, 2]}
          camera={{ fov: 40, position: [0, 0.55, 3.9], near: 0.1, far: 300 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Scene planet={planet} earthYears={earthYears} alienYears={alienYears} />
        </Canvas>

        <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
          <div>
            <div className="label">Destination world</div>
            <h2 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
              {planet.name}
            </h2>
            <div className="num mt-1 text-[11px] text-muted">
              {planet.star ?? planet.name} · {formatNumber(planet.distanceLy, 2)} ly
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="rounded-full border border-line/80 bg-void/60 px-2.5 py-1 text-[10px] tracking-[0.16em] text-muted uppercase backdrop-blur">
              {look.label}
            </span>
            <span className="num rounded-full border border-line/70 bg-void/60 px-2.5 py-1 text-[10px] text-muted backdrop-blur">
              {star.name}
              {starAngle != null ? ` · ${starAngle < 1 ? starAngle.toFixed(2) : Math.round(starAngle)}° wide` : ''}
            </span>
            {look.source !== 'inferred' && (
              <span className="rounded-full border border-solar/40 bg-solar/10 px-2.5 py-1 text-[10px] text-solar">
                colour {look.source === 'random' ? 'randomized' : 'estimated'} *
              </span>
            )}
          </div>
        </div>

        {!compact && (
          <>
            <div className="pointer-events-none absolute bottom-3 left-3 max-w-[42%] rounded-xl border border-line/70 bg-void/70 px-3 py-2 backdrop-blur">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-ion" />
                <span className="label text-[9px]">Earth twin</span>
              </div>
              <div className="num mt-0.5 text-[11px] text-ink">{human.label}</div>
            </div>
            <div className="pointer-events-none absolute right-3 bottom-3 max-w-[42%] rounded-xl border border-line/70 bg-void/70 px-3 py-2 text-right backdrop-blur">
              <div className="flex items-center justify-end gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: look.palette[2] }} />
                <span className="label text-[9px]">Local life</span>
              </div>
              <div className="num mt-0.5 text-[11px] text-ink">{alien.label}</div>
            </div>
          </>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center">
          <span className="text-[10px] tracking-[0.18em] text-muted/70 uppercase">
            drag to orbit · scroll to zoom
          </span>
        </div>
      </div>
    </div>
  )
}

export default memo(PlanetStage)
