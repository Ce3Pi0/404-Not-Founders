import {
  formatDays,
  formatNumber,
  formatYears,
  surfaceClockRate,
  surfaceGravity,
} from '../lib/physics'
import { classifyPlanet } from '../lib/planet'
import { usePhysicsStore } from '../store/physicsStore'
import PhysicsAssumptions from './travel/PhysicsAssumptions'
import CrewLineup from './CrewLineup'

function Stat({ label, value, sub, tone = 'text-ink' }) {
  return (
    <div className="rounded-xl border border-line/70 bg-void/40 px-3.5 py-3">
      <div className="text-[9px] tracking-[0.16em] text-muted uppercase">{label}</div>
      <div className={`mt-1 text-2xl leading-none font-semibold sm:text-[26px] ${tone}`}>{value}</div>
      <div className="mt-1.5 text-[10px] text-muted">{sub}</div>
    </div>
  )
}

const ly = (value) => `${formatNumber(value, Math.abs(value) < 1 ? 4 : 2)} ly`

function Row({ label, value, note }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line/30 py-1 last:border-0">
      <span className="text-[10px] text-muted">{label}</span>
      <span className="num text-right text-[11px] text-ink">
        {value}
        {note && <span className="ml-1 text-[9px] text-muted">{note}</span>}
      </span>
    </div>
  )
}

/** Advanced SR: what actually happened on each leg, from the flown model. */
function AdvancedBreakdown({ mission }) {
  const model = mission.advanced
  if (!model) return null
  return (
    <section className="panel p-5">
      <div className="label">Advanced SR — acceleration + cruise + braking</div>
      <h2 className="mt-1 text-lg font-semibold tracking-tight">The journey stage by stage</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-[9px] tracking-[0.14em] text-ink/45 uppercase">Speed</div>
          <Row label="Requested cruise speed" value={`${model.requestedBeta.toFixed(3)} c`} />
          <Row label="Actual peak velocity" value={`${model.betaPeak.toFixed(3)} c`} />
          <Row label="Peak Lorentz factor" value={model.gammaPeak.toFixed(4)} />
          <Row label="Proper acceleration" value={`${model.accelMs.toFixed(2)} m/s²`} />
          {mission.departureType && (
            <Row
              label="Departure"
              value={mission.departureType === 'surface' ? 'Planetary surface' : 'Orbital'}
            />
          )}
          {mission.feasibility?.gravityMs2 != null && mission.feasibility.surface && (
            <Row
              label="Local surface gravity"
              value={`${mission.feasibility.gravityMs2.toFixed(2)} m/s²`}
            />
          )}
          <Row
            label="Launch feasibility"
            value={mission.feasibility?.ok ? 'passed' : 'not applicable'}
          />
        </div>
        <div>
          <div className="text-[9px] tracking-[0.14em] text-ink/45 uppercase">Burns</div>
          <Row
            label="Acceleration"
            value={formatYears(model.accelYears)}
            note={`· ${ly(model.accelDistanceLy)}`}
          />
          <Row
            label="Cruise"
            value={formatYears(model.cruiseYears)}
            note={`· ${ly(model.cruiseDistanceLy)}`}
          />
          <Row
            label="Braking"
            value={formatYears(model.brakeYears)}
            note={`· ${ly(model.brakeDistanceLy)}`}
          />
          <Row label="Total Earth-reference time" value={formatYears(model.earthYears)} />
          <Row label="Total spacecraft proper time" value={formatYears(model.shipYears)} />
          <Row label="Aging difference" value={formatYears(model.driftYears)} />
        </div>
      </div>
      {!model.reachedTarget && (
        <p className="mt-3 text-[10px] leading-relaxed text-ink/50">
          The target cruise speed was not reachable over {formatNumber(mission.distanceLy, 2)} ly:
          the ship accelerated to {model.betaPeak.toFixed(3)} c and braked immediately, with no cruise
          phase. This is a valid trajectory, not a failed mission.
        </p>
      )}
    </section>
  )
}

/** Completed simple-vs-advanced results for this same route. */
function ModeComparison({ mission }) {
  const saved = usePhysicsStore(
    (state) => state.results[`${mission.origin}→${mission.planet}`] ?? null,
  )
  if (!saved?.simple || !saved?.advanced) return null
  const { simple, advanced } = saved
  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="label">Mode comparison — same route</div>
        <span className="text-[9px] text-ink/40">
          {simple.shipName} · {formatNumber(simple.distanceLy, 2)} ly
        </span>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-[10px]">
        <span className="text-ink/40">Flew with</span>
        <span className="text-right text-ink/40">Simple SR</span>
        <span className="text-right text-ink/40">Advanced SR</span>
        <span className="text-ink/60">Earth time</span>
        <span className="num text-right text-ink">{formatYears(simple.earthYears)}</span>
        <span className="num text-right text-ink">{formatYears(advanced.earthYears)}</span>
        <span className="text-ink/60">Ship time</span>
        <span className="num text-right text-ink">{formatYears(simple.shipYears)}</span>
        <span className="num text-right text-ink">{formatYears(advanced.shipYears)}</span>
        <span className="text-ink/60">Peak speed</span>
        <span className="num text-right text-ink/80">{simple.beta.toFixed(3)} c</span>
        <span className="num text-right text-ink/80">{advanced.beta.toFixed(3)} c</span>
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-ink/40">
        Same route, two physics models. Advanced SR spends real time and distance accelerating and
        braking, so it can produce different elapsed times on both clocks.
      </p>
    </section>
  )
}

function tinyPercent(value) {
  const pct = value * 100
  if (pct >= 0.001) return `${pct.toPrecision(2)}%`
  return `${pct.toExponential(1)}%`
}

function PhysicsCard({ mission, planet }) {
  const gravity = surfaceGravity(planet.massEarth, planet.radiusEarth)
  const clockRate = surfaceClockRate(planet.massEarth, planet.radiusEarth)

  return (
    <section className="panel p-5">
      <div className="label">Stage 4 — Learn</div>
      <h2 className="mt-1 text-lg font-semibold tracking-tight">Why the clocks disagree</h2>

      <div className="mt-3 space-y-1.5 rounded-xl border border-line/70 bg-void/50 px-3.5 py-3 text-[12px] leading-relaxed text-ink/85">
        <div>
          <span className="text-muted">γ = 1/√(1−β²)</span> = {mission.gamma.toFixed(4)}
        </div>
        {mission.mode === 'advanced' ? (
          <div>
            <span className="text-muted">t⊕ = t_acc + t_cruise + t_brake</span> ={' '}
            {formatNumber(mission.earthYears, 3)} yr
          </div>
        ) : (
          <div>
            <span className="text-muted">t⊕ = d/(βc)</span> ={' '}
            {formatNumber(mission.distanceLy, 2)} ly ÷ {mission.beta.toFixed(3)} ={' '}
            {formatNumber(mission.earthYears, 3)} yr
          </div>
        )}
        <div>
          <span className="text-muted">
            {mission.mode === 'advanced' ? 't_ship = ∫ dt/γ(t)' : 't_ship = t⊕/γ'}
          </span>{' '}
          = <span className="text-ink">{formatNumber(mission.shipYears, 3)} yr</span>
        </div>
        <div>
          <span className="text-muted">Δ</span> = {formatNumber(mission.driftYears, 3)} yr of separation
        </div>
      </div>

      <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-muted">
        <p>
          One year aboard {mission.shipName} equals{' '}
          <span className="text-ink">{formatNumber(mission.gamma, 2)} years</span> on Earth at this
          speed. The crew feels nothing unusual: their own clocks, hearts and meals all keep proper
          time.
        </p>
        <p>
          Earth's observers see the ship's clocks tick slowly. The crew instead sees the distance to{' '}
          {planet.name} length-contracted by the same factor, so both frames agree on how much the
          crew ages.
        </p>
        <p>
          {mission.mode === 'advanced'
            ? `This leg used finite acceleration and braking at ${mission.advanced.accelMs.toFixed(2)} m/s² of proper acceleration. The crew's proper time is the integral of √(1 − v(t)²/c²) over the whole voyage, so it cannot be recovered by applying one cruise γ to the trip.`
            : 'This leg is a one-way cruise at constant velocity: acceleration at departure and braking at arrival both have zero simulated duration.'}
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-line/70 bg-white/[0.02] px-3.5 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[10px] tracking-[0.14em] text-muted uppercase">
            Gravity at the surface
          </span>
          <span className="text-[11px] text-ink">
            {gravity != null ? `${formatNumber(gravity, 2)} g` : 'unknown'}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
          {clockRate != null ? (
            <>
              A clock resting on {planet.name} would run{' '}
              <span className="text-ink">{tinyPercent(1 - clockRate)}</span> slower than one in deep
              space (<span className="num">√(1 − rₛ/R) = {clockRate.toFixed(9)}</span>). Real, but
              vanishingly small next to the ship's {tinyPercent(1 - 1 / mission.gamma)} velocity
              effect. This is context only: the journey's clocks include no gravitational
              correction, in either physics mode.
            </>
          ) : (
            <>This world's mass and radius are incomplete in the archive, so its surface clock rate
              can't be estimated.</>
          )}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-ion" />
        <span>
          Earth elapsed {formatDays(mission.earthYears)} vs ship elapsed {formatDays(mission.shipYears)}
        </span>
      </div>
    </section>
  )
}

function MissionLog({ sim, planet, onNext, onReset, onGoHome }) {
  return (
    <section className="panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="label">Mission log</div>
        <span className="text-[10px] text-muted">
          {sim.missions.length} record{sim.missions.length === 1 ? '' : 's'}
        </span>
      </div>

      {sim.missions.length === 0 ? (
        <p className="mt-3 text-[12px] text-muted">No missions logged yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line/60">
          {sim.missions.slice(0, 6).map((entry) => (
            <li key={entry.id} className="flex items-baseline justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-[12px] text-ink">
                  {entry.origin ? `${entry.origin} → ` : ''}
                  {entry.planet}
                </div>
                <div className="text-[10px] text-muted">
                  {entry.beta.toFixed(3)} c · {formatNumber(entry.distanceLy, 2)} ly
                  {entry.mode === 'advanced' ? ' · advanced SR' : ' · simple SR'}
                </div>
              </div>
              <div className="shrink-0 text-right text-[10px]">
                <div className="text-ink">{formatYears(entry.shipYears)} ship</div>
                <div className="text-muted">{formatYears(entry.earthYears)} Earth</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line/70 bg-void/40 px-3 py-2">
        <span className="text-[10px] tracking-[0.14em] text-muted uppercase">Total elapsed</span>
        <span className="text-[11px] text-ink">
          <span className="text-ink">{formatYears(sim.shipYears)}</span>
          <span className="text-muted"> ship · </span>
          {formatYears(sim.earthYears)} Earth
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary flex-1" onClick={onNext}>
          Plan another mission →
        </button>
        {planet.kind !== 'earth' && onGoHome && (
          <button type="button" className="btn" onClick={onGoHome}>
            ← Go home
          </button>
        )}
        <button type="button" className="btn" onClick={onReset}>
          Reset
        </button>
      </div>
    </section>
  )
}

export default function Debrief({ mission, planet, origin, sim, onNext, onReset, onGoHome }) {
  const look = classifyPlanet(planet)
  const ratio = mission.gamma

  return (
    <div className="screen space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Arrival — debrief</div>
          <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            Welcome to {planet.name}
          </h1>
          <p className="mt-1 text-[13px] text-ink/65">
            {mission.origin} <span className="text-ink/45">→</span> {planet.name} ·{' '}
            {formatNumber(mission.distanceLy, 2)} ly · {mission.shipName}{' '}
            {mission.mode === 'advanced'
              ? `peaked at ${mission.beta.toFixed(3)} c`
              : `at ${mission.beta.toFixed(3)} c`}
          </p>
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-ion/50 bg-ion/15 px-2.5 py-1 text-[9px] tracking-[0.14em] text-ink/85 uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-ion" />
            {mission.mode === 'advanced'
              ? 'Advanced SR — finite acceleration'
              : 'Simple SR — constant velocity'}
          </div>
        </div>
        <div className="rounded-xl border border-line/60 bg-panel/40 px-3 py-2 text-right">
          <div className="text-[9px] tracking-[0.16em] text-ink/60 uppercase">
            {mission.mode === 'advanced' ? 'Peak dilation' : 'Time dilation'}
          </div>
          <div className="text-lg font-semibold text-ink">{ratio.toFixed(2)}×</div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Stat
          label="Earth elapsed"
          value={formatYears(mission.earthYears)}
          sub={formatDays(mission.earthYears)}
        />
        <Stat
          label={`${mission.shipName} elapsed`}
          value={formatYears(mission.shipYears)}
          sub={formatDays(mission.shipYears)}
          tone="text-ink"
        />
        <Stat
          label="Crew aged less by"
          value={formatYears(mission.driftYears)}
          sub={`${formatNumber(mission.driftYears * 365.25, 0)} days`}
          tone="text-ink"
        />
      </div>

      {mission.mode === 'advanced' && <AdvancedBreakdown mission={mission} />}
      <ModeComparison mission={mission} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <CrewLineup planet={planet} sim={sim} shipName={mission.shipName} />
        </div>
        <div className="min-w-0 space-y-4">
          <PhysicsCard mission={mission} planet={planet} />
          <PhysicsAssumptions advanced={mission.mode === 'advanced'} departureName={mission.origin} />
          <MissionLog sim={sim} planet={planet} onNext={onNext} onReset={onReset} onGoHome={onGoHome} />
        </div>
      </div>
    </div>
  )
}
