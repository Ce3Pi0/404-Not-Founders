import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Spacecraft from '../../lab/Spacecraft'
import FlightViewport from './FlightViewport'
import { placeCamera } from './cameraMath'
import { HAS_WEBGL, SIMPLIFIED_GRAPHICS } from '../../../lib/webgl'
import { createGlowTexture } from '../../../lib/glowTexture'
import { mulberry32 } from '../../../lib/planet'
import { retardedProgress } from '../../../lib/flight'

/* The four palette colours, plus white for star cores and readouts. */
const VOID = '#160040'
const ION = '#9a0680'
const VIOLET = '#79018c'
const INK = '#ffffff'

const ROUTE_SEGMENTS = SIMPLIFIED_GRAPHICS ? 120 : 240
const STAR_COUNT = SIMPLIFIED_GRAPHICS ? 420 : 1100

const GRID_CLASS = {
  single: 'grid-cols-1 grid-rows-1',
  split: 'grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1',
  triple: 'grid-cols-1 grid-rows-3 sm:grid-cols-3 sm:grid-rows-1',
}

/* ------------------------------------------------------------- route frame -- */

/**
 * Real NASA coordinates for both ends, in light-years. The scene keeps that
 * physical scale (1 unit = 1 ly); every camera distance and marker size is
 * derived from the route span so a 4-ly hop and a 900-ly haul both read well.
 */
export function routeGeometry(origin, destination) {
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
    const random = mulberry32(73013)
    const positions = new Float32Array(STAR_COUNT * 3)
    for (let i = 0; i < STAR_COUNT; i += 1) {
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
      {!SIMPLIFIED_GRAPHICS && (
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
      )}
      {solar && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 3.4, radius * 3.8, 64]} />
          <meshBasicMaterial
            color={INK}
            transparent
            opacity={0.45}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
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
      const point = route.from
        .clone()
        .addScaledVector(route.dir, route.span * (i / ROUTE_SEGMENTS))
      positions.set([point.x, point.y, point.z], i * 3)
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array((ROUTE_SEGMENTS + 1) * 3), 3),
    )
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
    group.current.position.copy(route.from).addScaledVector(route.dir, route.span * progressRef.current)
  })

  return (
    <group ref={group} quaternion={quaternion}>
      <Spacecraft
        glow={ION}
        engine={1}
        scale={route.span * 0.0055}
        detail={!SIMPLIFIED_GRAPHICS}
      />
    </group>
  )
}

/**
 * Departure Observer's optional delayed view: the retarded image of the ship,
 * placed where the light arriving at the origin now was emitted. The parent's
 * renderer decides which panels draw it.
 */
function DelayedGhost({ route, progressRef, beta, glow, groupRef }) {
  const spriteRef = useRef()
  const scratch = useMemo(() => new THREE.Vector3(), [])
  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints([route.from.clone(), route.from.clone()]),
    [route],
  )

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    const progress = retardedProgress(progressRef.current, beta)
    scratch.copy(route.from).addScaledVector(route.dir, route.span * progress)
    if (spriteRef.current) spriteRef.current.position.copy(scratch)
    const position = geometry.attributes.position
    position.setXYZ(0, route.from.x, route.from.y, route.from.z)
    position.setXYZ(1, scratch.x, scratch.y, scratch.z)
    position.needsUpdate = true
  })

  return (
    <group ref={groupRef}>
      <line geometry={geometry} frustumCulled={false}>
        <lineBasicMaterial color={ION} transparent opacity={0.4} toneMapped={false} />
      </line>
      <group ref={spriteRef}>
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
    </group>
  )
}

/* --------------------------------------------------------------- world ----- */

function FlightWorld({
  route,
  glow,
  progressRef,
  beta,
  shipRef,
  ghostRef,
  solarOrigin,
  solarDestination,
}) {
  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight
        position={route.mid.clone().addScaledVector(route.up, route.span * 0.4).toArray()}
        intensity={1.2}
      />

      <StarField mid={route.mid} span={route.span} />
      <RouteLine route={route} progressRef={progressRef} />
      <StarMarker position={route.from} span={route.span} glow={glow} solar={solarOrigin} />
      <StarMarker position={route.to} span={route.span} glow={glow} solar={solarDestination} />

      <group ref={shipRef}>
        <FlightShip route={route} progressRef={progressRef} />
      </group>
      <DelayedGhost
        route={route}
        progressRef={progressRef}
        beta={beta}
        glow={glow}
        groupRef={ghostRef}
      />
    </>
  )
}

/* ------------------------------------------------------------- renderer ---- */

/**
 * One WebGL context, one scene, one set of geometries and textures. Each panel
 * is drawn by rendering that same scene into a scissored region of the canvas
 * with its own camera, so the panels share every resource and differ only by
 * viewpoint. A positive frame priority takes over R3F's own render pass.
 */
function MultiViewRenderer({
  route,
  viewsRef,
  rectsRef,
  orbitRef,
  progressRef,
  shipRef,
  ghostRef,
  delayedRef,
}) {
  const { gl, scene, size } = useThree()
  const cameras = useMemo(
    () => ({
      external: new THREE.PerspectiveCamera(50, 1, 1e-6, 1e6),
      observer: new THREE.PerspectiveCamera(55, 1, 1e-6, 1e6),
      cockpit: new THREE.PerspectiveCamera(72, 1, 1e-6, 1e6),
    }),
    [],
  )

  useFrame(() => {
    const views = viewsRef.current
    const rects = rectsRef.current
    const height = size.height

    // Wipe the whole canvas so no stale pixels survive a layout change; each
    // panel below then clears and draws only inside its own scissor rectangle.
    gl.setScissorTest(false)
    gl.setViewport(0, 0, size.width, height)
    gl.setClearColor(VOID, 1)
    gl.clear(true, true, true)
    gl.setScissorTest(true)

    views.forEach((view) => {
      const rect = rects[view.key]
      const camera = cameras[view.perspective]
      if (!camera || !rect || rect.width < 8 || rect.height < 8) return

      camera.aspect = rect.width / rect.height
      placeCamera(camera, view.perspective, route, progressRef.current, orbitRef.current[view.perspective])

      if (shipRef.current) shipRef.current.visible = view.perspective !== 'cockpit'
      if (ghostRef.current) {
        ghostRef.current.visible =
          view.perspective === 'observer' && delayedRef.current && progressRef.current > 0.0005
      }

      const bottom = height - rect.top - rect.height
      gl.setViewport(rect.left, bottom, rect.width, rect.height)
      gl.setScissor(rect.left, bottom, rect.width, rect.height)
      gl.render(scene, camera)
    })

    gl.setScissorTest(false)
    gl.setViewport(0, 0, size.width, height)
  }, 1)

  return null
}

/* ---------------------------------------------------------------- stage ---- */

/**
 * Live Flight's 3D stage. `progressRef` is the page's single mutable clock, so
 * every panel, the ship and both clocks move from the same fraction at display
 * refresh rate while the HUD only re-renders a few times per second.
 */
export default function FlightStage({
  views,
  layout,
  origin,
  destination,
  beta = 0.8,
  progressRef,
  delayed = false,
  clock,
  shipName,
  onAssignPerspective,
}) {
  const glow = useMemo(createGlowTexture, [])
  const route = useMemo(() => routeGeometry(origin, destination), [origin, destination])

  const orbitRef = useRef(null)
  if (!orbitRef.current) {
    orbitRef.current = {
      external: { yaw: -0.43, pitch: 0.58, zoom: 1 },
      observer: { yaw: 0.29, pitch: 0.62, zoom: 1 },
      cockpit: { yaw: 0, pitch: 0, zoom: 1 },
    }
  }

  const containerRef = useRef(null)
  const panelRefs = useRef({})
  const rectsRef = useRef({})
  const shipRef = useRef(null)
  const ghostRef = useRef(null)

  const viewsRef = useRef(views)
  viewsRef.current = views
  const delayedRef = useRef(delayed)
  delayedRef.current = delayed

  const registerPanel = useCallback((key, element) => {
    if (element) panelRefs.current[key] = element
    else delete panelRefs.current[key]
  }, [])

  const viewsKey = views.map((view) => `${view.key}:${view.perspective}`).join('|')

  // Panel rectangles drive the renderer's viewports, so a layout change (or a
  // window resize) re-measures instead of stretching the previous render.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const measure = () => {
      const base = container.getBoundingClientRect()
      const next = {}
      for (const view of views) {
        const panel = panelRefs.current[view.key]
        if (!panel) continue
        const rect = panel.getBoundingClientRect()
        next[view.key] = {
          left: rect.left - base.left,
          top: rect.top - base.top,
          width: rect.width,
          height: rect.height,
        }
      }
      rectsRef.current = next
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    for (const view of views) {
      const panel = panelRefs.current[view.key]
      if (panel) observer.observe(panel)
    }
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
    // `viewsKey` covers both the panel set and each panel's camera.
  }, [views, viewsKey])

  if (!HAS_WEBGL) {
    return (
      <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-2 bg-void p-6 text-center">
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
      <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-2 bg-void p-6 text-center">
        <div className="text-[10px] tracking-[0.18em] text-ink/45 uppercase">Live flight</div>
        <p className="max-w-[320px] text-[12px] leading-relaxed text-ink/70">
          This route has no measured distance at one end, so the spacecraft has no coordinates to
          fly between. Go back to the Travel Planner and choose two charted systems.
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      <div className="pointer-events-none absolute inset-0">
        <Canvas
          dpr={SIMPLIFIED_GRAPHICS ? [1, 1.25] : [1, 2]}
          gl={{ antialias: !SIMPLIFIED_GRAPHICS, alpha: false, powerPreference: 'high-performance' }}
          camera={{ fov: 55, near: Math.max(route.span * 1e-6, 1e-6), far: route.span * 220 }}
        >
          <FlightWorld
            route={route}
            glow={glow}
            progressRef={progressRef}
            beta={beta}
            shipRef={shipRef}
            ghostRef={ghostRef}
            solarOrigin={origin?.name === 'Solar System'}
            solarDestination={destination?.name === 'Solar System'}
          />
          <MultiViewRenderer
            route={route}
            viewsRef={viewsRef}
            rectsRef={rectsRef}
            orbitRef={orbitRef}
            progressRef={progressRef}
            shipRef={shipRef}
            ghostRef={ghostRef}
            delayedRef={delayedRef}
          />
        </Canvas>
      </div>

      <div className={`absolute inset-0 grid gap-1.5 ${GRID_CLASS[layout] ?? GRID_CLASS.single}`}>
        {views.map((view, index) => (
          <FlightViewport
            key={view.key}
            view={view}
            index={index}
            layout={layout}
            views={views}
            clock={clock}
            shipName={shipName}
            delayed={delayed}
            orbitRef={orbitRef}
            registerPanel={registerPanel}
            onAssignPerspective={onAssignPerspective}
          />
        ))}
      </div>
    </div>
  )
}
