import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { HAS_WEBGL } from '../../lib/webgl'
import { createGlowTexture } from '../../lib/glowTexture'
import { createPlanetTexture, mulberry32 } from '../../lib/planet'
import { niceAu } from '../../lib/planetSystem'

/** Cyan is the app's signature accent for the inspected object. */
const CYAN = '#5ee7ff'

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** Subtle background stars on a far shell — atmosphere, not catalogue data. */
function StarField({ extent, glow }) {
  const geometry = useMemo(() => {
    const rand = mulberry32(90210)
    const count = 900
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const u = rand() * 2 - 1
      const theta = rand() * Math.PI * 2
      const radius = extent * (25 + rand() * 20)
      const ring = Math.sqrt(1 - u * u)
      positions[i * 3] = Math.cos(theta) * ring * radius
      positions[i * 3 + 1] = u * radius
      positions[i * 3 + 2] = Math.sin(theta) * ring * radius
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return buffer
  }, [extent])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={glow}
        size={1.7}
        sizeAttenuation={false}
        color="#ffffff"
        transparent
        opacity={0.32}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

/** Circular orbit at the archive's semi-major axis, in AU. */
function OrbitRing({ radius, active }) {
  const geometry = useMemo(() => {
    const segments = 200
    const points = []
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [radius])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial
        color={active ? CYAN : '#9a0680'}
        transparent
        opacity={active ? 0.8 : 0.28}
        depthWrite={false}
      />
    </lineLoop>
  )
}

function PlanetBody({ body, selected, glow }) {
  const surface = useMemo(() => createPlanetTexture(body.planet), [body.planet])
  const spin = useRef()
  const radius = body.radiusUnits

  useEffect(() => () => surface.texture.dispose(), [surface])

  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.08
  })

  return (
    <group>
      <mesh ref={spin}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial map={surface.texture} roughness={0.92} metalness={0.03} />
      </mesh>
      {selected && (
        <sprite scale={[radius * 7, radius * 7, 1]}>
          <spriteMaterial
            map={glow}
            color={CYAN}
            transparent
            opacity={0.5}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      )}
    </group>
  )
}

/** Host star at the centre: coloured by the derived effective temperature. */
function HostStar({ star, glow }) {
  const radius = star.units
  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshBasicMaterial color={star.color} toneMapped={false} />
      </mesh>
      <sprite scale={[radius * 11, radius * 11, 1]}>
        <spriteMaterial
          map={glow}
          color={star.color}
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      {/* decay 0: an AU-scale scene must keep outer worlds lit. */}
      <pointLight intensity={2.4} decay={0} color={star.color} />
      <ambientLight intensity={0.3} />
    </group>
  )
}

function SceneRig({
  system,
  framing,
  selectedId,
  focus,
  orbitsOn,
  labelsOn,
  timeScale,
  paused,
  labelsRef,
  scaleBarRef,
  scaleTextRef,
  cameraQuaternionRef,
  resetSignal,
  onSelect,
}) {
  const { camera, gl, size } = useThree()
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl])
  const glow = useMemo(createGlowTexture, [])
  const pivotRefs = useRef([])
  const planetRefs = useRef([])
  const elapsedDays = useRef(0)
  const tween = useRef(null)
  const firstReset = useRef(true)
  const projection = useMemo(() => new THREE.Vector3(), [])
  const world = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.rotateSpeed = 0.7
    controls.zoomSpeed = 0.9
    controls.panSpeed = 0.8
    controls.minDistance = framing.minDistance
    controls.maxDistance = framing.maxDistance
    return () => controls.dispose()
  }, [controls, framing])

  /** Frame the whole system: the local scale is AU, so each system is fitted. */
  useEffect(() => {
    camera.near = framing.near
    camera.far = framing.far
    camera.updateProjectionMatrix()
    camera.position.set(...framing.home)
    controls.target.set(...framing.target)
    controls.minDistance = framing.minDistance
    controls.maxDistance = framing.maxDistance
    controls.update()
    tween.current = null
    elapsedDays.current = 0
  }, [camera, controls, framing])

  /** Reset glides home instead of snapping. */
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false
      return
    }
    tween.current = {
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos: new THREE.Vector3(...framing.home),
      toTarget: new THREE.Vector3(...framing.target),
      elapsed: 0,
      duration: 1.05,
    }
  }, [camera, controls, framing, resetSignal])

  /** Smoothly fly to a selected planet, holding its current position as target. */
  useEffect(() => {
    if (!focus?.id) return
    const index = system.bodies.findIndex((body) => body.planet.id === focus.id)
    const node = planetRefs.current[index]
    if (!node) return
    node.getWorldPosition(world)
    const body = system.bodies[index]
    const outward = world.clone()
    if (outward.lengthSq() < 1e-12) outward.set(1, 0.2, 0)
    outward.normalize()
    const distance = Math.max(body.radiusUnits * 5.5, system.extentAu * 0.02)
    tween.current = {
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos: world
        .clone()
        .add(outward.multiplyScalar(distance))
        .add(new THREE.Vector3(0, body.radiusUnits * 2.4, 0)),
      toTarget: world.clone(),
      elapsed: 0,
      duration: 1.1,
    }
  }, [camera, controls, focus, system, world])

  /** Any manual camera input interrupts the flight — never fight the user. */
  useEffect(() => {
    const element = gl.domElement
    const interrupt = () => {
      tween.current = null
    }
    element.addEventListener('pointerdown', interrupt)
    element.addEventListener('wheel', interrupt, { passive: true })
    element.addEventListener('touchstart', interrupt, { passive: true })
    return () => {
      element.removeEventListener('pointerdown', interrupt)
      element.removeEventListener('wheel', interrupt)
      element.removeEventListener('touchstart', interrupt)
    }
  }, [gl])

  /** Screen-space picking keeps clicks on the drawn world, not a wire sphere. */
  const pick = useCallback(
    (clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      let best = null
      let bestScore = Infinity
      system.bodies.forEach((body, index) => {
        const node = planetRefs.current[index]
        if (!node) return
        node.getWorldPosition(world)
        projection.copy(world).project(camera)
        if (projection.z < -1 || projection.z > 1) return
        const screenX = (projection.x * 0.5 + 0.5) * rect.width
        const screenY = (-projection.y * 0.5 + 0.5) * rect.height
        const distance = Math.hypot(screenX - x, screenY - y)
        const depth = Math.max(1e-9, camera.position.distanceTo(world))
        const pixels = (body.radiusUnits / depth) * (rect.height / (2 * Math.tan((camera.fov * Math.PI) / 360)))
        const reach = Math.max(12, pixels + 6)
        if (distance <= reach && distance < bestScore) {
          bestScore = distance
          best = body
        }
      })
      return best
    },
    [camera, gl, projection, system, world],
  )

  useEffect(() => {
    const element = gl.domElement
    let downAt = null

    const handleDown = (event) => {
      downAt = { x: event.clientX, y: event.clientY }
    }

    const handleMove = (event) => {
      if (downAt) return
      element.style.cursor = pick(event.clientX, event.clientY) ? 'pointer' : 'grab'
    }

    const handleUp = (event) => {
      if (!downAt) return
      const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y)
      downAt = null
      if (moved > 5) return
      const hit = pick(event.clientX, event.clientY)
      onSelect(hit ? hit.planet : null)
    }

    element.style.cursor = 'grab'
    element.addEventListener('pointerdown', handleDown)
    element.addEventListener('pointermove', handleMove)
    element.addEventListener('pointerup', handleUp)
    return () => {
      element.removeEventListener('pointerdown', handleDown)
      element.removeEventListener('pointermove', handleMove)
      element.removeEventListener('pointerup', handleUp)
    }
  }, [gl, onSelect, pick])

  useFrame((_, delta) => {
    if (!paused) elapsedDays.current += delta * timeScale

    for (let i = 0; i < system.bodies.length; i += 1) {
      const pivot = pivotRefs.current[i]
      if (!pivot) continue
      const body = system.bodies[i]
      pivot.rotation.y = body.phase + body.angularSpeed * elapsedDays.current
    }

    const flight = tween.current
    if (flight) {
      flight.elapsed = Math.min(flight.duration, flight.elapsed + delta)
      const k = easeInOutCubic(flight.elapsed / flight.duration)
      camera.position.lerpVectors(flight.fromPos, flight.toPos, k)
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k)
      if (flight.elapsed >= flight.duration) tween.current = null
    }
    controls.update()

    // Projected HTML labels follow the live orbital positions.
    const layer = labelsRef.current
    if (layer) {
      const children = layer.children
      for (let i = 0; i < children.length; i += 1) {
        const element = children[i]
        const node = planetRefs.current[i]
        if (!node || !labelsOn) {
          element.style.visibility = 'hidden'
          continue
        }
        node.getWorldPosition(world)
        projection.copy(world).project(camera)
        if (projection.z < -1 || projection.z > 1) {
          element.style.visibility = 'hidden'
          continue
        }
        const x = (projection.x * 0.5 + 0.5) * size.width
        const y = (-projection.y * 0.5 + 0.5) * size.height
        if (x < -80 || x > size.width + 80 || y < -30 || y > size.height + 30) {
          element.style.visibility = 'hidden'
          continue
        }
        element.style.visibility = 'visible'
        element.style.transform = `translate3d(${x}px, ${y}px, 0)`
      }
    }

    // Live scale bar in AU — the local scene's own unit.
    if (scaleBarRef.current && scaleTextRef.current) {
      const distance = camera.position.distanceTo(controls.target)
      const worldPerPixel =
        (2 * distance * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, size.height)
      const au = niceAu(worldPerPixel * 120)
      scaleBarRef.current.style.width = `${au / worldPerPixel}px`
      scaleTextRef.current.textContent = au >= 1 ? `${au} AU` : `${au.toFixed(3)} AU`
    }

    if (cameraQuaternionRef.current) {
      cameraQuaternionRef.current.copy(camera.quaternion).invert()
    }
  })

  return (
    <>
      <color attach="background" args={['#160040']} />
      <StarField extent={system.extentAu} glow={glow} />
      <HostStar star={system.star} glow={glow} />
      {orbitsOn &&
        system.bodies.map((body) => (
          <OrbitRing
            key={`orbit-${body.planet.id}`}
            radius={body.orbitUnits}
            active={body.planet.id === selectedId}
          />
        ))}
      {system.bodies.map((body, index) => (
        <group
          key={body.planet.id}
          ref={(node) => {
            pivotRefs.current[index] = node
          }}
        >
          <group
            position={[body.orbitUnits, 0, 0]}
            ref={(node) => {
              planetRefs.current[index] = node
            }}
          >
            <PlanetBody body={body} selected={body.planet.id === selectedId} glow={glow} />
          </group>
        </group>
      ))}
    </>
  )
}

/** `/system/:id` — the local, AU-scaled planetary system around one host star. */
export default function PlanetaryScene(props) {
  if (!HAS_WEBGL) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-void p-6 text-center">
        <div className="text-[11px] tracking-[0.18em] text-ink/45 uppercase">System view</div>
        <p className="max-w-[300px] text-[12px] leading-relaxed text-ink/70">
          This browser could not start WebGL, so the 3D system cannot draw. Enable hardware
          acceleration and reload to see the planets orbit.
        </p>
      </div>
    )
  }

  return (
    <Canvas
      camera={{ position: props.framing.home, fov: 50, near: props.framing.near, far: props.framing.far }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <SceneRig {...props} />
    </Canvas>
  )
}
