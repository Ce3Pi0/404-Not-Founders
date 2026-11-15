import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { mulberry32, starColor } from '../../lib/planet'
import { SOLAR_SYSTEM } from '../../lib/starMap'
import { HAS_WEBGL } from '../../lib/webgl'
import {
  createGlowTexture,
  createHaloTexture,
  createRingTexture,
  createTextTexture,
} from '../../lib/glowTexture'
import { createZoomOutLatch, wheelPixels } from '../../lib/zoomTransition'
import { labelExtent, pickVisibleLabels } from '../../lib/mapLabels'
import {
  HOME_CAMERA,
  HOME_TARGET,
  EARTH_RETURN_DISTANCE,
  GRID_RINGS_LY,
} from '../../lib/mapCamera'

/** Cyan is the map's signature accent for the inspected system and its route. */
const CYAN = '#5ee7ff'
/** The Sun's own colour: the Solar marker must never read as a white blob. */
const SUN = '#ffcf7a'

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/**
 * Plan a camera flight to a system: keep the current viewing direction, pull
 * the distance in so the star grows, and never end up inside the point.
 * `closeness` is the fraction of the current camera-to-star distance the flight
 * ends at — 0.6 is a gentle approach, 0.3 dives in.
 */
function flightPlan(position, camera, controls, { duration = 1.35, closeness = 0.6 } = {}) {
  const goal = new THREE.Vector3(...position)
  const fromTarget = controls.target.clone()
  const fromPos = camera.position.clone()
  const offset = fromPos.clone().sub(fromTarget)
  const currentDistance = offset.length()
  const direction =
    currentDistance > 0.001
      ? offset.divideScalar(currentDistance)
      : new THREE.Vector3(0.45, 0.35, 1).normalize()
  const distance = THREE.MathUtils.clamp(currentDistance * closeness, 3.2, 150)
  return {
    fromPos,
    fromTarget,
    toPos: goal.add(direction.multiplyScalar(distance)),
    toTarget: new THREE.Vector3(...position),
    elapsed: 0,
    duration,
  }
}

/** World units per CSS pixel at a given camera distance. */
function worldPerPixel(camera, height, distance) {
  return (2 * distance * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, height)
}

/* ---------------------------------------------------------------- geometry -- */

/**
 * One point per unique host-star system, coloured by the host star's blackbody
 * temperature and sized by its distance from the camera: near systems swell a
 * little, far ones shrink toward a point. That perspective is what makes the
 * cloud read as a volume rather than a flat picture of dots.
 */
function HostStars({ systems, glow }) {
  const { gl } = useThree()

  const geometry = useMemo(() => {
    const positions = new Float32Array(systems.length * 3)
    const colors = new Float32Array(systems.length * 3)
    const sizes = new Float32Array(systems.length)
    const color = new THREE.Color()
    systems.forEach((system, index) => {
      positions.set(system.renderPosition, index * 3)
      color.set(starColor(system.planets[0]?.starTeffK))
      const brightness = system.planets.length > 1 ? 1 : 0.8
      colors.set([color.r * brightness, color.g * brightness, color.b * brightness], index * 3)
      sizes[index] = system.planets.length > 1 ? 1.15 : 0.9
    })
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    buffer.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1))
    buffer.computeBoundingSphere()
    return buffer
  }, [systems])

  const shader = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          map: { value: glow },
          pixelRatio: { value: 1 },
        },
        vertexShader: `
          attribute vec3 color;
          attribute float pointSize;
          uniform float pixelRatio;
          varying vec3 vColor;
          varying float vFade;
          void main() {
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float depth = max(1.0, -mv.z);
            gl_PointSize = clamp(
              pointSize * pixelRatio * (110.0 / depth),
              2.2 * pixelRatio,
              8.5 * pixelRatio
            );
            vFade = clamp(1.35 - depth / 420.0, 0.68, 1.0);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform sampler2D map;
          varying vec3 vColor;
          varying float vFade;
          void main() {
            vec4 tex = texture2D(map, gl_PointCoord);
            if (tex.a < 0.01) discard;
            gl_FragColor = vec4(vColor, 1.0) * tex * vFade;
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [glow],
  )

  useEffect(() => () => shader.dispose(), [shader])

  useFrame(() => {
    shader.uniforms.pixelRatio.value = gl.getPixelRatio()
  })

  return <points geometry={geometry} material={shader} frustumCulled={false} />
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

/**
 * Expedition Challenge itinerary: one glowing tube per interstellar leg with a
 * direction arrow, coloured by leg state. Positions are exact catalogue
 * coordinates in light-years, so the drawn length is the flown distance.
 */
const PATH_COLORS = {
  planned: '#5ee7ff',
  current: '#c084fc',
  done: '#eafdff',
  failed: '#ff7a45',
  remaining: '#6a5a8f',
}

function ExpeditionPath({ segments }) {
  const objects = useMemo(() => {
    return segments
      .map((segment) => {
        const a = new THREE.Vector3(...segment.from)
        const b = new THREE.Vector3(...segment.to)
        const length = a.distanceTo(b)
        if (!Number.isFinite(length) || length <= 0) return null
        const color = PATH_COLORS[segment.status] ?? PATH_COLORS.planned
        const radius = Math.min(0.5, Math.max(0.06, length * 0.0025))
        const tube = new THREE.TubeGeometry(
          new THREE.LineCurve3(a, b),
          1,
          radius,
          8,
          false,
        )
        const material = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: segment.status === 'remaining' ? 0.45 : 0.62,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const mesh = new THREE.Mesh(tube, material)

        const direction = b.clone().sub(a).normalize()
        const arrowSize = Math.min(1.1, Math.max(0.16, length * 0.02))
        const arrow = new THREE.Mesh(
          new THREE.ConeGeometry(arrowSize * 0.34, arrowSize, 12),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        )
        arrow.position.copy(a).lerp(b, 0.55)
        arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
        return { mesh, arrow }
      })
      .filter(Boolean)
  }, [segments])

  useEffect(
    () => () => {
      for (const { mesh, arrow } of objects) {
        mesh.geometry.dispose()
        mesh.material.dispose()
        arrow.geometry.dispose()
        arrow.material.dispose()
      }
    },
    [objects],
  )

  return (
    <>
      {objects.map(({ mesh, arrow }, index) => (
        <group key={index}>
          <primitive object={mesh} />
          <primitive object={arrow} />
        </group>
      ))}
    </>
  )
}

/* -----------------------------------------------------------------* solar -- */

/**
 * The Solar System at light-year scale: a small Sun-coloured star at the origin
 * with a thin warm outline marking home. Its on-screen size is fixed by the
 * camera (star core about the size of a catalogue marker), so it can never be
 * read as an astronomical sphere several light-years across.
 */
function SunMarker({ glow, ring }) {
  const bloom = useRef(null)
  const core = useRef(null)
  const halo = useRef(null)
  const outline = useRef(null)

  useFrame(({ camera, size }) => {
    const distance = Math.max(0.6, camera.position.length())
    const perPixel = worldPerPixel(camera, size.height, distance)
    if (bloom.current) bloom.current.scale.setScalar(38 * perPixel)
    if (core.current) core.current.scale.setScalar(9 * perPixel)
    if (halo.current) halo.current.scale.setScalar(18 * perPixel)
    if (outline.current) outline.current.scale.setScalar(23 * perPixel)
  })

  return (
    <group position={SOLAR_SYSTEM.renderPosition}>
      {/* restrained bloom — proportional to the other star markers */}
      <sprite ref={bloom}>
        <spriteMaterial
          map={glow}
          color={SUN}
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite ref={halo}>
        <spriteMaterial
          map={glow}
          color="#fff1cf"
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite ref={core}>
        <spriteMaterial
          map={glow}
          color="#fffaf0"
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      {/* crisp home outline, always on top of the bloom */}
      <sprite ref={outline}>
        <spriteMaterial
          map={ring}
          color={SUN}
          transparent
          opacity={0.8}
          depthWrite={false}
          depthTest={false}
        />
      </sprite>
    </group>
  )
}

/* ------------------------------------------------------- reference plane -- */

/**
 * Astronomical scale indicators: thin rings at whole light-year radii on the
 * map's reference plane, with a few radial spokes. They are the depth cue that
 * turns the star cloud into a measured three-dimensional volume.
 */
function ReferenceGrid({ glow }) {
  const rings = useMemo(
    () =>
      GRID_RINGS_LY.map((radius, index) => {
        const points = []
        const segments = 160
        for (let i = 0; i <= segments; i += 1) {
          const angle = (i / segments) * Math.PI * 2
          points.push(
            new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
          )
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const material = new THREE.LineBasicMaterial({
          color: CYAN,
          transparent: true,
          opacity: index === 0 ? 0.2 : 0.09,
          depthWrite: false,
        })
        return new THREE.Line(geometry, material)
      }),
    [],
  )

  const spokes = useMemo(() => {
    const furthest = GRID_RINGS_LY[GRID_RINGS_LY.length - 1] ?? 100
    const points = []
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2
      points.push(
        new THREE.Vector3(Math.cos(angle) * 2, 0, Math.sin(angle) * 2),
        new THREE.Vector3(Math.cos(angle) * furthest, 0, Math.sin(angle) * furthest),
      )
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [])

  const labels = useMemo(
    () =>
      GRID_RINGS_LY.map((radius) => ({
        radius,
        texture: createTextTexture(`${radius} ly`),
      })),
    [],
  )

  useEffect(
    () => () => {
      for (const ring of rings) {
        ring.geometry.dispose()
        ring.material.dispose()
      }
    },
    [rings],
  )

  useEffect(() => () => labels.forEach((label) => label.texture.dispose()), [labels])

  return (
    <group>
      {rings.map((ring, index) => (
        <primitive key={`ring-${index}`} object={ring} />
      ))}
      <lineSegments geometry={spokes}>
        <lineBasicMaterial color={CYAN} transparent opacity={0.07} depthWrite={false} />
      </lineSegments>
      {labels.map(({ radius, texture }) => (
        <GridLabel
          key={`grid-${radius}`}
          texture={texture}
          position={[
            Math.cos(-Math.PI / 5) * radius,
            0.001,
            Math.sin(-Math.PI / 5) * radius,
          ]}
        />
      ))}
    </group>
  )
}

/** A ring caption that keeps a constant, small on-screen size at any zoom. */
function GridLabel({ texture, position }) {
  const sprite = useRef(null)
  useFrame(({ camera, size }) => {
    if (!sprite.current) return
    const distance = camera.position.distanceTo(sprite.current.position)
    const perPixel = worldPerPixel(camera, size.height, distance)
    sprite.current.scale.set(52 * perPixel, 13 * perPixel, 1)
  })
  return (
    <sprite ref={sprite} position={position}>
      <spriteMaterial map={texture} transparent opacity={0.45} depthWrite={false} />
    </sprite>
  )
}

/** Faint vertical stems from nearby systems down to the reference plane. */
function DepthStems({ systems }) {
  const geometry = useMemo(() => {
    const points = []
    for (const system of systems) {
      const [x, y, z] = system.renderPosition
      if (Math.hypot(x, y, z) > 34 || Math.abs(y) < 1.4) continue
      points.push(new THREE.Vector3(x, y, z), new THREE.Vector3(x, 0, z))
    }
    const buffer = new THREE.BufferGeometry().setFromPoints(points)
    return buffer
  }, [systems])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#8fd8ff" transparent opacity={0.14} depthWrite={false} />
    </lineSegments>
  )
}

/** Subtle background stars on a far shell — atmosphere, not catalogue data. */
function StarField({ glow }) {
  const geometry = useMemo(() => {
    const random = mulberry32(20261115)
    const count = 2600
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const palette = ['#ffffff', '#dbe9ff', '#b9d0ff', '#ffe8c2', '#ffc79a', '#ff9f7e']
    const tint = new THREE.Color()
    for (let i = 0; i < count; i += 1) {
      const u = random() * 2 - 1
      const theta = random() * Math.PI * 2
      const radius = 620 + random() * 420
      const ring = Math.sqrt(1 - u * u)
      positions[i * 3] = Math.cos(theta) * ring * radius
      positions[i * 3 + 1] = u * radius
      positions[i * 3 + 2] = Math.sin(theta) * ring * radius
      tint.set(palette[Math.floor(random() * palette.length)])
      const brightness = 0.35 + random() * 0.5
      colors.set([tint.r * brightness, tint.g * brightness, tint.b * brightness], i * 3)
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return buffer
  }, [])

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={glow}
        size={1.9}
        sizeAttenuation={false}
        vertexColors
        transparent
        opacity={0.42}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

/* ----------------------------------------------------------------- route -- */

/** A crisp ring at one route end so the path is visibly attached to a system. */
function EndpointRing({ position, ring, glow, color, size = 22 }) {
  const frame = useRef(null)
  const core = useRef(null)
  useFrame(({ camera, size: viewport }) => {
    if (!frame.current) return
    const distance = camera.position.distanceTo(frame.current.position)
    const perPixel = worldPerPixel(camera, viewport.height, distance)
    frame.current.scale.setScalar(size * perPixel)
    if (core.current) core.current.scale.setScalar(size * 0.5 * perPixel)
  })
  return (
    <>
      <sprite ref={frame} position={position}>
        <spriteMaterial
          map={ring}
          color={color}
          transparent
          opacity={0.85}
          depthWrite={false}
          depthTest={false}
        />
      </sprite>
      <sprite ref={core} position={position}>
        <spriteMaterial
          map={glow}
          color={color}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </>
  )
}

function RouteLine({ from, to, ring, glow, luminous = false }) {
  const a = useMemo(() => new THREE.Vector3(...from), [from])
  const b = useMemo(() => new THREE.Vector3(...to), [to])
  const length = a.distanceTo(b)

  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([a, b])
    return new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: CYAN,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    )
  }, [a, b])

  /** A soft additive tube so the path reads as a luminous route, not a wire. */
  const halo = useMemo(() => {
    if (!(length > 0)) return null
    const geometry = new THREE.TubeGeometry(
      new THREE.LineCurve3(a, b),
      1,
      Math.max(0.05, length * 0.0018),
      8,
      false,
    )
    return new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: CYAN,
        transparent: true,
        opacity: luminous ? 0.32 : 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
  }, [a, b, length, luminous])

  useEffect(
    () => () => {
      line.geometry.dispose()
      line.material.dispose()
    },
    [line],
  )

  useEffect(
    () => () => {
      if (!halo) return
      halo.geometry.dispose()
      halo.material.dispose()
    },
    [halo],
  )

  if (!(length > 0.0001)) return null

  return (
    <>
      <primitive object={line} />
      {halo && <primitive object={halo} />}
      <EndpointRing position={from} ring={ring} glow={glow} color="#dff8ff" size={17} />
      <EndpointRing position={to} ring={ring} glow={glow} color={CYAN} size={24} />
    </>
  )
}

/**
 * The planner's spacecraft, parked at the departure star. It keeps a constant
 * on-screen size and points along the route.
 */
function ShipMarker({ ship, glow }) {
  const scaleRef = useRef(null)
  const origin = useMemo(() => new THREE.Vector3(...ship.position), [ship.position])
  const quaternion = useMemo(() => {
    const direction = new THREE.Vector3(...ship.to).sub(origin)
    if (direction.lengthSq() < 1e-9) return new THREE.Quaternion()
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      direction.normalize(),
    )
  }, [origin, ship.to])

  useFrame(({ camera }) => {
    if (!scaleRef.current) return
    const size = Math.max(0.5, camera.position.distanceTo(origin) * 0.035)
    scaleRef.current.scale.setScalar(size)
  })

  return (
    <group position={ship.position} quaternion={quaternion}>
      <group ref={scaleRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.16, 0.55, 14]} />
          <meshStandardMaterial color="#ffffff" metalness={0.35} roughness={0.42} />
        </mesh>
        <mesh position={[0, 0, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.12, 0.3, 14]} />
          <meshStandardMaterial color="#ffffff" metalness={0.3} roughness={0.35} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.16, 0, -0.12]}>
            <boxGeometry args={[0.26, 0.03, 0.1]} />
            <meshStandardMaterial color="#4c0070" roughness={0.6} />
          </mesh>
        ))}
        <sprite position={[0, 0, -0.42]} scale={[1.1, 1.1, 1]}>
          <spriteMaterial
            map={glow}
            color="#5ee7ff"
            transparent
            opacity={0.9}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      </group>
    </group>
  )
}

/**
 * Pulsing cyan marker around the inspected star. Its size follows the camera
 * distance so the marker keeps an elegant, constant on-screen size at any zoom.
 */
function SelectedHalo({ entry, haloTexture, glow }) {
  const halo = useRef(null)
  const core = useRef(null)
  const centre = useMemo(() => new THREE.Vector3(...entry.renderPosition), [entry])

  useFrame(({ camera, clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * 1.9) + 1) / 2
    const base = Math.max(0.4, camera.position.distanceTo(centre) * 0.1)
    if (halo.current) {
      const scale = base * (1 + pulse * 0.05)
      halo.current.scale.set(scale, scale, 1)
      halo.current.material.opacity = 0.6 + pulse * 0.2
    }
    if (core.current) {
      const scale = base * 0.26
      core.current.scale.set(scale, scale, 1)
    }
  })

  return (
    <group position={entry.renderPosition}>
      <sprite ref={halo}>
        <spriteMaterial
          map={haloTexture}
          color={CYAN}
          transparent
          opacity={0.8}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite ref={core}>
        <spriteMaterial
          map={glow}
          color="#eafdff"
          transparent
          opacity={0.85}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  )
}

/** Subtle dashed link between the current location and the inspected star. */
function DistanceLine({ from, to }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
    ])
    const material = new THREE.LineDashedMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0.26,
      dashSize: 1.2,
      gapSize: 1.6,
      depthWrite: false,
    })
    const object = new THREE.Line(geometry, material)
    object.computeLineDistances()
    return object
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
  ring,
  systems,
  pickTargets,
  labels,
  labelsRef,
  scaleBarRef,
  scaleTextRef,
  cameraQuaternionRef,
  route,
  routeLabel,
  routeLabelRef,
  distanceTo,
  selected,
  hovered,
  resetSignal,
  cameraState,
  focus,
  frame = null,
  onSelect,
  onHover,
  onApproachOrigin = null,
  onExploreEntry = null,
  routeGlow = false,
  routePath = null,
  ship = null,
  shipAnchorRef = null,
  view = null,
  maxDistance = 700,
  far = 4000,
}) {
  const { camera, gl, size } = useThree()
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl])
  const projection = useMemo(() => new THREE.Vector3(), [])
  const approachArmed = useRef(false)
  const approachHandler = useRef(onApproachOrigin)
  approachHandler.current = onApproachOrigin
  const exploreHandler = useRef(onExploreEntry)
  exploreHandler.current = onExploreEntry
  const hoverAt = useRef(0)
  const tween = useRef(null)
  const firstReset = useRef(true)
  const firstView = useRef(true)
  const haloTexture = useMemo(createHaloTexture, [])
  const viewDirection = useMemo(() => new THREE.Vector3(), [])
  const originDirection = useMemo(() => new THREE.Vector3(), [])

  /** True while the camera sits close to, and looks straight at, the Solar origin. */
  const aimedAtOrigin = useCallback(
    (toleranceDeg) => {
      if (camera.position.lengthSq() < 1e-6) return true
      camera.getWorldDirection(viewDirection)
      originDirection.copy(camera.position).multiplyScalar(-1).normalize()
      return viewDirection.angleTo(originDirection) < THREE.MathUtils.degToRad(toleranceDeg)
    },
    [camera, originDirection, viewDirection],
  )

  useEffect(() => {
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.rotateSpeed = 0.62
    controls.zoomSpeed = 0.85
    controls.panSpeed = 0.75
    // Zoom dollies toward the orbit target, not the cursor: zooming near the
    // Solar marker must not teleport the camera inside the Earth handoff radius.
    controls.zoomToCursor = false
    // Close enough to dive into the Solar origin and return to Earth orbit.
    controls.minDistance = 1.2
    controls.maxDistance = maxDistance
    return () => controls.dispose()
  }, [controls])

  /** A long route needs a deeper zoom-out limit; keep the live controls. */
  useEffect(() => {
    controls.maxDistance = maxDistance
  }, [controls, maxDistance])

  /** Keep the far plane past the most distant destination the planner frames. */
  useEffect(() => {
    camera.far = far
    camera.updateProjectionMatrix()
  }, [camera, far])

  /**
   * Restore the framing the map was left with (the system page's Back control
   * depends on it), or start at home on a first visit.
   */
  useEffect(() => {
    if (cameraState?.position && cameraState?.target) {
      camera.position.set(...cameraState.position)
      controls.target.set(...cameraState.target)
    } else {
      camera.position.set(...HOME_CAMERA)
      controls.target.set(...HOME_TARGET)
    }
    controls.update()
  }, [camera, controls, cameraState])

  /** Frame a whole route: the planner hands in a camera position and target. */
  useEffect(() => {
    if (!view?.position || !view?.target) return
    if (firstView.current) {
      firstView.current = false
      camera.position.set(...view.position)
      controls.target.set(...view.target)
      controls.update()
      return
    }
    tween.current = {
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos: new THREE.Vector3(...view.position),
      toTarget: new THREE.Vector3(...view.target),
      elapsed: 0,
      duration: 1.05,
    }
  }, [camera, controls, view])

  /** Frame an explicit position/target (the route fit) with a calm glide. */
  useEffect(() => {
    if (!frame?.position || !frame?.target) return
    tween.current = {
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos: new THREE.Vector3(...frame.position),
      toTarget: new THREE.Vector3(...frame.target),
      elapsed: 0,
      duration: 1.2,
    }
  }, [camera, controls, frame])

  /** Reset glides home instead of snapping, and forgets the saved framing. */
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false
      return
    }
    if (cameraState) {
      cameraState.position = null
      cameraState.target = null
    }
    tween.current = {
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos: new THREE.Vector3(...HOME_CAMERA),
      toTarget: new THREE.Vector3(...HOME_TARGET),
      elapsed: 0,
      duration: 1.1,
    }
  }, [camera, controls, cameraState, resetSignal])

  /** Fly to a system picked from search, the drawer or "Center on location". */
  useEffect(() => {
    if (!focus?.entry?.renderPosition) return
    tween.current = flightPlan(focus.entry.renderPosition, camera, controls, {
      duration: focus.duration ?? 1.35,
      closeness: focus.closeness ?? 0.6,
    })
  }, [camera, controls, focus])

  /**
   * Any manual camera input interrupts the flight — never fight the user.
   * Wheeling further in once the Solar System fills the view is also the
   * gesture that enters Earth orbit, which makes the handoff reliable even
   * when the orbit target stopped slightly short of the exact origin.
   */
  useEffect(() => {
    const element = gl.domElement
    const interrupt = () => {
      tween.current = null
    }
    // Inward wheel travel, normalised across wheel units, earns the handoff
    // once the Solar origin fills the view (lib/zoomTransition.js).
    const latch = createZoomOutLatch()
    const handleWheel = (event) => {
      tween.current = null
      const handler = approachHandler.current
      if (!handler || !approachArmed.current) {
        latch.reset()
        return
      }
      const distance = camera.position.length()
      const ready = distance <= EARTH_RETURN_DISTANCE * 4 && aimedAtOrigin(14)
      if (latch.push(-wheelPixels(event), ready)) {
        approachArmed.current = false
        handler()
      }
    }
    element.addEventListener('pointerdown', interrupt)
    element.addEventListener('touchstart', interrupt, { passive: true })
    element.addEventListener('wheel', handleWheel, { passive: true })
    return () => {
      element.removeEventListener('pointerdown', interrupt)
      element.removeEventListener('touchstart', interrupt)
      element.removeEventListener('wheel', handleWheel)
    }
  }, [aimedAtOrigin, camera, gl])

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

    /** Double-click is the dive gesture: Earth orbit or the local system explorer. */
    const handleDoubleClick = (event) => {
      const handler = exploreHandler.current
      if (!handler) return
      const hit = pick(event.clientX, event.clientY, 16)
      if (hit) {
        tween.current = null
        handler(hit)
      }
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
    element.addEventListener('dblclick', handleDoubleClick)
    element.addEventListener('pointerleave', handleLeave)
    return () => {
      element.removeEventListener('pointerdown', handleDown)
      element.removeEventListener('pointermove', handleMove)
      element.removeEventListener('pointerup', handleUp)
      element.removeEventListener('dblclick', handleDoubleClick)
      element.removeEventListener('pointerleave', handleLeave)
    }
  }, [gl, onHover, onSelect, pick])

  useFrame((_, delta) => {
    const flight = tween.current
    if (flight) {
      flight.elapsed = Math.min(flight.duration, flight.elapsed + delta)
      const k = easeInOutCubic(flight.elapsed / flight.duration)
      camera.position.lerpVectors(flight.fromPos, flight.toPos, k)
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k)
      if (flight.elapsed >= flight.duration) tween.current = null
    }
    controls.update()

    /**
     * Diving into the Solar origin is the reverse of leaving Earth: once the
     * camera is back inside the Solar System, hand the view back to the orbit
     * scene. Arming at a real distance keeps the arrival flight from firing it.
     */
    const approach = approachHandler.current
    if (approach) {
      const distance = camera.position.length()
      if (distance > 8) approachArmed.current = true
      if (
        approachArmed.current &&
        distance < EARTH_RETURN_DISTANCE &&
        aimedAtOrigin(20)
      ) {
        approachArmed.current = false
        approach()
      }
    }

    if (cameraState) {
      cameraState.position = camera.position.toArray()
      cameraState.target = controls.target.toArray()
    }

    const layer = labelsRef?.current
    if (layer) {
      const children = layer.children
      const candidates = []
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
        candidates.push({
          element,
          x,
          y,
          box: {
            x,
            y: y - 14,
            width: labelExtent(entry.name, entry.name === SOLAR_SYSTEM.name),
            height: 16,
          },
        })
      }
      // Keep the highest-priority labels and drop ones that would stack on them.
      const keep = pickVisibleLabels(candidates.map((candidate) => candidate.box))
      candidates.forEach((candidate, index) => {
        if (!keep[index]) {
          candidate.element.style.visibility = 'hidden'
          return
        }
        candidate.element.style.visibility = 'visible'
        candidate.element.style.transform = `translate3d(${candidate.x}px, ${candidate.y}px, 0)`
      })
    }

    // The planner's speed panel rides on the spacecraft itself.
    const anchor = shipAnchorRef?.current
    if (anchor) {
      if (!ship?.position) {
        anchor.style.visibility = 'hidden'
      } else {
        projection.set(...ship.position).project(camera)
        const x = (projection.x * 0.5 + 0.5) * size.width
        const y = (-projection.y * 0.5 + 0.5) * size.height
        if (
          projection.z < -1 ||
          projection.z > 1 ||
          x < -40 ||
          x > size.width + 40 ||
          y < -40 ||
          y > size.height + 40
        ) {
          anchor.style.visibility = 'hidden'
        } else {
          anchor.style.visibility = 'visible'
          anchor.style.transform = `translate3d(${x}px, ${y}px, 0)`
        }
      }
    }

    // The route's distance caption rides the midpoint of the drawn line.
    const routeCaption = routeLabelRef?.current
    if (routeCaption) {
      if (!routeLabel?.from || !routeLabel?.to) {
        routeCaption.style.visibility = 'hidden'
      } else {
        projection
          .set(
            (routeLabel.from[0] + routeLabel.to[0]) / 2,
            (routeLabel.from[1] + routeLabel.to[1]) / 2,
            (routeLabel.from[2] + routeLabel.to[2]) / 2,
          )
          .project(camera)
        const x = (projection.x * 0.5 + 0.5) * size.width
        const y = (-projection.y * 0.5 + 0.5) * size.height
        if (projection.z < -1 || projection.z > 1) {
          routeCaption.style.visibility = 'hidden'
        } else {
          routeCaption.style.visibility = 'visible'
          routeCaption.style.transform = `translate3d(${x}px, ${y}px, 0)`
        }
      }
    }

    if (scaleBarRef?.current && scaleTextRef?.current) {
      const distance = camera.position.distanceTo(controls.target)
      const perPixel = worldPerPixel(camera, size.height, distance)
      const lightYears = niceLightYears(perPixel * 120)
      scaleBarRef.current.style.width = `${lightYears / perPixel}px`
      scaleTextRef.current.textContent = `${lightYears} ly`
    }

    if (cameraQuaternionRef?.current) {
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
      <color attach="background" args={['#000206']} />
      <ambientLight intensity={0.8} />
      <StarField glow={glow} />
      <ReferenceGrid glow={glow} />
      <DepthStems systems={systems} />
      <HostStars systems={systems} glow={glow} />
      <MarkerPoints entries={hoveredEntries} glow={glow} color="#ffd27a" size={14} />
      <MarkerPoints entries={selectedEntries} glow={glow} color={CYAN} size={16} />
      {selected && <SelectedHalo entry={selected} haloTexture={haloTexture} glow={glow} />}
      <SunMarker glow={glow} ring={ring} />
      {route && (
        <RouteLine from={route.from} to={route.to} ring={ring} glow={glow} luminous={routeGlow} />
      )}
      {routePath && routePath.length > 0 && <ExpeditionPath segments={routePath} />}
      {ship && <ShipMarker ship={ship} glow={glow} />}
      {distanceTo && <DistanceLine from={distanceTo.from} to={distanceTo.to} />}
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
  routeLabel = null,
  routeLabelRef = null,
  distanceTo,
  selected,
  hovered,
  resetSignal,
  cameraState,
  focus,
  frame = null,
  onSelect,
  onHover,
  onApproachOrigin,
  onExploreEntry = null,
  routeGlow,
  routePath,
  ship,
  shipAnchorRef,
  view,
  maxDistance,
  far = 4000,
}) {
  const glow = useMemo(createGlowTexture, [])
  const ring = useMemo(createRingTexture, [])

  useEffect(
    () => () => {
      glow.dispose()
      ring.dispose()
    },
    [glow, ring],
  )

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
      camera={{ position: HOME_CAMERA, fov: 55, near: 0.1, far }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <SceneRig
        glow={glow}
        ring={ring}
        systems={systems}
        pickTargets={pickTargets}
        labels={labels}
        labelsRef={labelsRef}
        scaleBarRef={scaleBarRef}
        scaleTextRef={scaleTextRef}
        cameraQuaternionRef={cameraQuaternionRef}
        route={route}
        routeLabel={routeLabel}
        routeLabelRef={routeLabelRef}
        distanceTo={distanceTo}
        selected={selected}
        hovered={hovered}
        resetSignal={resetSignal}
        cameraState={cameraState}
        focus={focus}
        frame={frame}
        onSelect={onSelect}
        onHover={onHover}
        onApproachOrigin={onApproachOrigin}
        onExploreEntry={onExploreEntry}
        routeGlow={routeGlow}
        routePath={routePath}
        ship={ship}
        shipAnchorRef={shipAnchorRef}
        view={view}
        maxDistance={maxDistance}
        far={far}
      />
    </Canvas>
  )
}
