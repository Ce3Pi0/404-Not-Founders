import { Canvas } from '@react-three/fiber'
import BobbleFigure from './BobbleFigure'
import { describeAge } from '../lib/aging'
import { classifyPlanet } from '../lib/planet'
import { formatYears } from '../lib/physics'

function Caption({ name, tone, described, note }) {
  return (
    <div className="rounded-lg border border-line/50 bg-void/50 px-2.5 py-2 text-center">
      <div className="truncate text-[11px] font-medium text-ink">{name}</div>
      <div className="mt-0.5 text-[10px] text-ink/85">{described.age.toFixed(1)} yr</div>
      <div className="text-[10px] text-ink/55">{described.stage.label}</div>
      <div className="mt-0.5 text-[9px] text-ink/40">{note}</div>
      <span className="sr-only">{tone}</span>
    </div>
  )
}

export default function CrewLineup({ planet, sim, shipName }) {
  const look = classifyPlanet(planet)
  const astronaut = describeAge(sim.shipYears)
  const twin = describeAge(sim.earthYears)
  const alien = describeAge(sim.earthYears)
  const showAlien = planet.kind !== 'earth'

  return (
    <section className="panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="label">Crew{showAlien ? ' & locals' : ''}</div>
        <div className="text-[10px] text-ink/50">everyone starts at 25</div>
      </div>

      <div className="mt-1 h-[240px]">
        <Canvas dpr={[1, 2]} camera={{ fov: 34, position: [0, 0.05, 4.9] }} gl={{ alpha: true }}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[3, 5, 4]} intensity={1.7} color="#ffffff" />
          <directionalLight position={[-4, 2, 3]} intensity={0.7} color="#79018c" />
          <group position={[0, -0.66, 0]}>
            <BobbleFigure
              stage={astronaut.stage.id}
              species="human"
              accent="#9a0680"
              position={showAlien ? [-1.75, 0, 0] : [-1, 0, 0]}
              scale={0.95}
              seed={1}
            />
            <BobbleFigure
              stage={twin.stage.id}
              species="human"
              accent="#79018c"
              position={showAlien ? [0, 0, 0] : [1, 0, 0]}
              scale={0.95}
              seed={2}
            />
            {showAlien && (
              <BobbleFigure
                stage={alien.stage.id}
                species="alien"
                skin={look.palette[2]}
                accent={look.palette[2]}
                position={[1.75, 0, 0]}
                scale={0.95}
                seed={3}
              />
            )}
          </group>
        </Canvas>
      </div>

      <div className={`grid gap-2 ${showAlien ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Caption
          name={shipName}
          tone="#9a0680"
          described={astronaut}
          note={`${formatYears(sim.shipYears)} ship time`}
        />
        <Caption
          name={showAlien ? 'Stayed on Earth' : 'You, on Earth'}
          tone="#79018c"
          described={twin}
          note={`${formatYears(sim.earthYears)} Earth time`}
        />
        {showAlien && (
          <Caption
            name={`Life on ${planet.name}`}
            tone={look.palette[2]}
            described={alien}
            note="local years, Earth rate"
          />
        )}
      </div>
    </section>
  )
}
