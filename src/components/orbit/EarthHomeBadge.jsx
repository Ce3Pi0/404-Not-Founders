import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { HAS_WEBGL } from '../../lib/webgl'
import EarthSphere from '../EarthSphere'

/**
 * Earth, always in view.
 *
 * The Solar System scene draws Earth at catalogue-proportioned (and therefore
 * pinhead) size — at orbit scale a real globe is a few pixels wide, so the home
 * world stops being recognisable exactly where the journey is supposed to start.
 * This badge is the real thing instead: the same NASA Blue Marble surface (day
 * colour, relief, ocean gloss, clouds) on a small turning globe, so the home
 * world is visibly real on the opening screen without inventing a scale the
 * Solar System view would have to lie about.
 */
function TurningGlobe() {
  const group = useRef(null)
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.055
  })
  // Starts on the Americas, then turns slowly.
  return (
    <group ref={group} rotation={[0.32, 1.72, 0.1]}>
      <EarthSphere radius={1} segments={64} cloudOpacity={0.9} />
    </group>
  )
}

export default function EarthHomeBadge() {
  return (
    <div
      className="flex items-center gap-2.5 rounded-full border border-line/60 bg-[#04010c]/70 py-1.5 pr-3.5 pl-1.5 backdrop-blur"
      data-testid="earth-home-badge"
    >
      <div className="relative h-14 w-14 overflow-hidden rounded-full ring-1 ring-[#8fd8ff]/30 sm:h-16 sm:w-16">
        {HAS_WEBGL && (
          <Canvas
            dpr={[1, 2]}
            camera={{ position: [0, 0, 3.15], fov: 42 }}
            gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
          >
            <ambientLight intensity={0.45} />
            {/* Key light from the upper left, the way the real Blue Marble is lit. */}
            <directionalLight position={[-2.2, 1.8, 2.6]} intensity={2.6} />
            <TurningGlobe />
          </Canvas>
        )}
      </div>
      <div className="leading-tight">
        <div className="text-[9px] tracking-[0.2em] text-white/45 uppercase">Earth</div>
        <div className="text-[10px] text-white/75">1 AU · home</div>
      </div>
    </div>
  )
}
