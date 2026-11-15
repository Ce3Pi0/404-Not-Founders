import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { mulberry32 } from '../../lib/planet'
import { SOLAR_SYSTEM } from '../../lib/starMap'

const HOME_CAMERA = [18, 12, 26]
const HOME_TARGET = [0, 0, 0]

/** A blank panel is worse than a message: check once whether a 3D view is possible. */
const HAS_WEBGL = (() => {
  try {
    const probe = document.createElement('canvas')
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl')
    if (!context) return false
    // Release the probe context so it never counts against the browser's limit.
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
})()

/* --------------------------------------------------------------- textures -- */

/** Soft radial sprite so every host star reads as a glowing point. */
function useGlowTexture() {
  return useMemo(() => {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    )
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.22, 'rgba(255,255,255,0.85)')
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.18)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }, [])
}

/* ---------------------------------------------------------------- geometry -- */

/** One glow point per unique host-star system, in linear light-year space. */
function HostStars({ systems, glow }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(systems.length * 3)
    const colors = new Float32Array(systems.length * 3)
    const color = new THREE.Color()
    systems.forEach((system, index) => {
      positions.set(system.renderPosition, index * 3)
      // Palette only: multi-planet systems glow brighter than single-planet ones.
      color.set(system.planets.length > 1 ? '#9a0680' : '#79018c')
      colors.set([color.r, color.g, color.b], index * 3)
    })
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    buffer.computeBoundingSphere()
    return buffer
  }, [systems])

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={glow}
        size={7}
        sizeAttenuation={false}
        vertexColors
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function MarkerPoints({ entries, glow, color, size, opacity = 0.95 }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(Math.max(1, entries.length) * 3)
    entries.forEach((entry, index) => positions.set(entry.renderPosition, index * 3))
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.computeBoundingSphere()
    return buffer
  }, [entries])

  if (entries.length === 0) return null

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={glow}
        size={size}
        sizeAttenuation={false}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

/** Solar System: a distinct glowing origin with a mapped reference ring. */
function SolarOrigin({ glow }) {
  const [x, y, z] = SOLAR_SYSTEM.renderPosition
  return (
    <group position={[x, y, z]}>
      <sprite scale={[3.4, 3.4, 1]}>
        <spriteMaterial
          map={glow}
          color="#ffffff"
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.6, 72]} />
        <meshBasicMaterial
          color="#9a0680"
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.6, 2.64, 72]} />
        <meshBasicMaterial
          color="#79018c"
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

/** Subtle background stars on a far shell — atmosphere, not catalogue data. */
function StarField({ glow }) {
  const geometry = useMemo(() => {
    const random = mulberry32(20261115)
    const count = 1600
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const u = random() * 2 - 1
      const theta = random() * Math.PI * 2
      const radius = 620 + random() * 320
      const ring = Math.sqrt(1 - u * u)
      positions[i * 3] = Math.cos(theta) * ring * radius
      positions[i * 3 + 1] = u * radius
      positions[i * 3 + 2] = Math.sin(theta) * ring * radius
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return buffer
  }, [])

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={glow}
        size={2.2}
        sizeAttenuation={false}
        color="#ffffff"
        transparent
        opacity={0.3}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function RouteLine({ from, to }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
    ])
    return new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    )
  }, [from, to])

  useEffect(() => () => {
    line.geometry.dispose()
    line.material.dispose()
  }, [line])

  return <primitive object={line} />
}

/* ------------------------------------------------------------- interaction -- */

function niceLightYears(value) {
  const exponent = Math.floor(Math.log10(value))
  const base = 10 ** exponent
  const step = [1, 2, 5, 10].find((candidate) => candidate * base >= value) ?? 10
  return step * base
}

function SceneRig({
  glow,
  systems,
  pickTargets,
  labels,
  labelsRef,
  scaleBarRef,
  scaleTextRef,
  cameraQuaternionRef,
  route,
  selected,
  hovered,
  resetSignal,
  onSelect,
  onHover,
}) {
  const { camera, gl, size } = useThree()
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl])
  const projection = useMemo(() => new THREE.Vector3(), [])
  const hoverAt = useRef(0)

  useEffect(() => {
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.rotateSpeed = 0.65
    controls.zoomSpeed = 0.9
    controls.panSpeed = 0.8
    controls.minDistance = 2
    controls.maxDistance = 700
    return () => controls.dispose()
  }, [controls])

  useEffect(() => {
    camera.position.set(...HOME_CAMERA)
    controls.target.set(...HOME_TARGET)
    controls.update()
  }, [camera, controls, resetSignal])

  /** Screen-space picking keeps clicks on the drawing, not on a wire sphere. */
  const pick = useCallback(
    (clientX, clientY, threshold) => {
      const rect = gl.domElement.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      let best = null
      let bestDistance = threshold
      for (const system of pickTargets) {
        projection
          .set(system.renderPosition[0], system.renderPosition[1], system.renderPosition[2])
          .project(camera)
        if (projection.z < -1 || projection.z > 1) continue
        const screenX = (projection.x * 0.5 + 0.5) * rect.width
        const screenY = (-projection.y * 0.5 + 0.5) * rect.height
        const distance = Math.hypot(screenX - x, screenY - y)
        if (distance < bestDistance) {
          bestDistance = distance
          best = system
        }
      }
      return best
    },
    [camera, gl, pickTargets, projection],
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
      const now = performance.now()
      if (now - hoverAt.current < 60) return
      hoverAt.current = now
      const hit = pick(event.clientX, event.clientY, 10)
      if ((hit?.name ?? null) !== hoveredName) {
        hoveredName = hit?.name ?? null
        element.style.cursor = hit ? 'pointer' : 'grab'
        onHover(hit ?? null)
      }
    }

    const handleUp = (event) => {
      if (!downAt) return
      const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y)
      downAt = null
      if (moved > 5) return
      onSelect(pick(event.clientX, event.clientY, 14))
    }

    const handleLeave = () => {
      downAt = null
      if (hoveredName) {
        hoveredName = null
        onHover(null)
      }
      element.style.cursor = 'grab'
    }

    element.style.cursor = 'grab'
    element.addEventListener('pointerdown', handleDown)
    element.addEventListener('pointermove', handleMove)
    element.addEventListener('pointerup', handleUp)
    element.addEventListener('pointerleave', handleLeave)
    return () => {
      element.removeEventListener('pointerdown', handleDown)
      element.removeEventListener('pointermove', handleMove)
      element.removeEventListener('pointerup', handleUp)
      element.removeEventListener('pointerleave', handleLeave)
    }
  }, [gl, onHover, onSelect, pick])

  useFrame(() => {
    controls.update()

    const layer = labelsRef.current
    if (layer) {
      const children = layer.children
      for (let i = 0; i < children.length; i += 1) {
        const element = children[i]
        const entry = labels[i]
        if (!entry) {
          element.style.visibility = 'hidden'
          continue
        }
        projection
          .set(entry.renderPosition[0], entry.renderPosition[1], entry.renderPosition[2])
          .project(camera)
        if (projection.z < -1 || projection.z > 1) {
          element.style.visibility = 'hidden'
          continue
        }
        const x = (projection.x * 0.5 + 0.5) * size.width
        const y = (-projection.y * 0.5 + 0.5) * size.height
        if (x < -60 || x > size.width + 60 || y < -20 || y > size.height + 20) {
          element.style.visibility = 'hidden'
          continue
        }
        element.style.visibility = 'visible'
        element.style.transform = `translate3d(${x}px, ${y}px, 0)`
      }
    }

    if (scaleBarRef.current && scaleTextRef.current) {
      const distance = camera.position.distanceTo(controls.target)
      const worldPerPixel =
        (2 * distance * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, size.height)
      const lightYears = niceLightYears(worldPerPixel * 120)
      scaleBarRef.current.style.width = `${lightYears / worldPerPixel}px`
      scaleTextRef.current.textContent = `${lightYears} ly`
    }

    if (cameraQuaternionRef.current) {
      cameraQuaternionRef.current.copy(camera.quaternion).invert()
    }
  })

  const selectedEntries = useMemo(() => (selected ? [selected] : []), [selected])
  const hoveredEntries = useMemo(
    () => (hovered && hovered.name !== selected?.name ? [hovered] : []),
    [hovered, selected],
  )

  return (
    <>
      <color attach="background" args={['#160040']} />
      <ambientLight intensity={0.8} />
      <StarField glow={glow} />
      <HostStars systems={systems} glow={glow} />
      <MarkerPoints entries={hoveredEntries} glow={glow} color="#9a0680" size={12} />
      <MarkerPoints entries={selectedEntries} glow={glow} color="#ffffff" size={14} />
      <SolarOrigin glow={glow} />
      {route && <RouteLine from={route.from} to={route.to} />}
    </>
  )
}

/* --------------------------------------------------------------- the canvas -- */

export default function UniverseScene({
  systems,
  pickTargets,
  labels,
  labelsRef,
  scaleBarRef,
  scaleTextRef,
  cameraQuaternionRef,
  route,
  selected,
  hovered,
  resetSignal,
  onSelect,
  onHover,
}) {
  const glow = useGlowTexture()

  if (!HAS_WEBGL) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-void p-6 text-center">
        <div className="text-[11px] tracking-[0.18em] text-ink/45 uppercase">Universe map</div>
        <p className="max-w-[280px] text-[12px] leading-relaxed text-ink/70">
          This browser could not start WebGL, so the 3D map cannot draw. Enable hardware
          acceleration and reload to fly the region.
        </p>
      </div>
    )
  }

  return (
    <Canvas
      camera={{ position: HOME_CAMERA, fov: 55, near: 0.1, far: 4000 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <SceneRig
        glow={glow}
        systems={systems}
        pickTargets={pickTargets}
        labels={labels}
        labelsRef={labelsRef}
        scaleBarRef={scaleBarRef}
        scaleTextRef={scaleTextRef}
        cameraQuaternionRef={cameraQuaternionRef}
        route={route}
        selected={selected}
        hovered={hovered}
        resetSignal={resetSignal}
        onSelect={onSelect}
        onHover={onHover}
      />
    </Canvas>
  )
}
