import { Canvas } from '@react-three/fiber'
import BobbleFigure from './BobbleFigure'
import { describeAge } from '../lib/aging'
import { classifyPlanet } from '../lib/planet'
import { formatYears } from '../lib/physics'

function Caption({ name, tone, described, note }) {
  return (
    <div className="rounded-lg border border-line/70 bg-void/40 px-2.5 py-2 text-center">
      <div className="truncate text-[11px] font-medium" style={{ color: tone }}>
        {name}
      </div>
      <div className="num mt-0.5 text-[10px] text-ink/85">
        {described.age.toFixed(1)} yr
      </div>
      <div className="text-[10px] text-muted">{described.stage.label}</div>
      <div className="num mt-0.5 text-[9px] text-muted/70">{note}</div>
    </div>
  )
}

export default function CrewLineup({ planet, sim, shipName }) {
  const look = classifyPlanet(planet)
  const astronaut = describeAge(sim.shipYears)
  const twin = describeAge(sim.earthYears)
  const alien = describeAge(sim.earthYears)

  return (
    <section className="panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="label">Crew & locals</div>
        <div className="text-[10px] text-muted">everyone starts at 25</div>
      </div>

      <div className="mt-1 h-[240px]">
        <Canvas dpr={[1, 2]} camera={{ fov: 34, position: [0, 0.05, 4.9] }} gl={{ alpha: true }}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[3, 5, 4]} intensity={1.7} />
          <directionalLight position={[-4, 2, 3]} intensity={0.7} color="#7fd6ff" />
          <group position={[0, -0.66, 0]}>
            <BobbleFigure
              stage={astronaut.stage.id}
              species="human"
              accent="#5ee7ff"
              position={[-1.75, 0, 0]}
              scale={0.95}
              seed={1}
            />
            <BobbleFigure
              stage={twin.stage.id}
              species="human"
              accent="#ffb35c"
              position={[0, 0, 0]}
              scale={0.95}
              seed={2}
            />
            <BobbleFigure
              stage={alien.stage.id}
              species="alien"
              skin={look.palette[2]}
              accent={look.palette[2]}
              position={[1.75, 0, 0]}
              scale={0.95}
              seed={3}
            />
          </group>
        </Canvas>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Caption
          name={shipName}
          tone="#5ee7ff"
          described={astronaut}
          note={`${formatYears(sim.shipYears)} ship time`}
        />
        <Caption
          name="Earth twin"
          tone="#ffb35c"
          described={twin}
          note={`${formatYears(sim.earthYears)} Earth time`}
        />
        <Caption
          name={`Life on ${planet.name}`}
          tone={look.palette[2]}
          described={alien}
          note="local years, Earth rate"
        />
      </div>
    </section>
  )
}
