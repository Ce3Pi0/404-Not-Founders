import { formatDays, formatNumber, formatYears } from '../../../lib/physics'
import { LAYOUTS } from '../../../lib/flightViews'
import InfoTip from './InfoTip'

function ly(value) {
  return `${formatNumber(value, value < 1 ? 5 : 2)} ly`
}

function Stat({ label, value, note, tip, tipLabel }) {
  return (
    <div className="rounded-lg border border-line/50 bg-void/50 px-2.5 py-2">
      <div className="flex items-start justify-between gap-1">
        <div className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">{label}</div>
        {tip && <InfoTip label={tipLabel ?? `About ${label.toLowerCase()}`}>{tip}</InfoTip>}
      </div>
      <div className="num mt-0.5 text-[14px] text-ink">{value}</div>
      <div className="mt-0.5 text-[9px] text-ink/40">{note}</div>
    </div>
  )
}

function ClockCard({ label, note, years, accent = false, tip, tipLabel }) {
  return (
    <div
      className={`rounded-xl border px-2.5 py-2 ${accent ? 'border-ion/60 bg-ion/[0.12]' : 'border-line/55 bg-void/60'}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">{label}</div>
        {tip && <InfoTip label={tipLabel ?? `About the ${label.toLowerCase()} clock`}>{tip}</InfoTip>}
      </div>
      <div className="num mt-1 text-[19px] leading-none text-ink">{formatYears(years)}</div>
      <div className="num mt-1 text-[9px] text-ink/50">{formatDays(years)}</div>
      <div className="mt-0.5 text-[8px] text-ink/35">{note}</div>
    </div>
  )
}

const PHASE_LABEL = {
  acceleration: 'Acceleration',
  cruise: 'Cruise',
  braking: 'Braking',
  arrived: 'Arrived',
}

function lyOf(value) {
  return `${formatNumber(value, value !== 0 && Math.abs(value) < 1 ? 4 : 2)} ly`
}

/** Advanced-SR flight state: the phase, the burn geometry and the live speed. */
function AdvancedPanel({ model, clock }) {
  const brakeStartLy = Math.max(0, model.distanceLy - model.brakeDistanceLy)
  return (
    <div className="rounded-xl border border-ion/45 bg-ion/[0.08] px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">Flight phase</span>
        <span className="num text-[11px] text-ink/90">
          {PHASE_LABEL[clock.phase] ?? 'Cruise'}
        </span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px]">
        <span className="text-ink/45">Current speed</span>
        <span className="num text-right text-ink/85">{(clock.beta * 100).toFixed(1)}% c</span>
        <span className="text-ink/45">Peak speed</span>
        <span className="num text-right text-ink/85">{model.betaPeak.toFixed(3)} c</span>
        <span className="text-ink/45">Acceleration distance</span>
        <span className="num text-right text-ink/85">{lyOf(model.accelDistanceLy)}</span>
        <span className="text-ink/45">Braking begins at</span>
        <span className="num text-right text-ink/85">{lyOf(brakeStartLy)}</span>
      </div>
      <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel/70">
        <div
          className="absolute inset-y-0 left-0 bg-ion/40"
          style={{ width: `${model.accelFraction * 100}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-white/25"
          style={{ width: `${(1 - model.brakeStartFraction) * 100}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-ion"
          style={{ width: `${clock.progress * 100}%` }}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[8px] text-ink/35">
        <span>accelerate</span>
        <span>cruise</span>
        <span>brake</span>
      </div>
    </div>
  )
}

function DelayedSignal({ enabled, onChange, delayYears, retardedPercent, shipName }) {
  return (
    <div className="rounded-xl border border-line/50 bg-void/50 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">Delayed signal</span>
          <InfoTip label="How the delayed light is timed">
            The timing is calculated, not illustrative. Light emitted at reference time{' '}
            <em>t_e</em> from distance <em>β·t_e</em> reaches the departure system at{' '}
            <em>t_e + β·t_e</em>; setting that equal to the observer's time gives{' '}
            <em>t_e = t / (1 + β)</em>, so the marker sits at progress <em>p / (1 + β)</em> at
            constant speed. With finite acceleration the same light-travel equation is solved
            numerically on the flown trajectory.
          </InfoTip>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Delayed signal view"
          onClick={() => onChange(!enabled)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition ${
            enabled ? 'border-ion/70 bg-ion/40' : 'border-line/70 bg-panel/40'
          }`}
        >
          <span
            className={`absolute h-3.5 w-3.5 rounded-full transition-all ${
              enabled ? 'left-[19px] bg-ink' : 'left-[3px] bg-ink/60'
            }`}
          />
        </button>
      </div>
      <p className="mt-1.5 text-[9px] leading-relaxed text-ink/50">
        {enabled
          ? `Departed-light marker: the ship's image that left it ${formatYears(delayYears)} ago, at ${retardedPercent.toFixed(1)}% of the route. Light from a ship still leaving is always behind where the simulation has it now.`
          : `The live simulated position is drawn at full detail. Enable this to also show the retarded image of ${shipName} in the departure observer's light.`}
      </p>
    </div>
  )
}

/** Layout selector, bottom-right of the flight HUD. */
function LayoutPicker({ layout, onChange }) {
  const active = LAYOUTS.find((entry) => entry.id === layout) ?? LAYOUTS[0]
  return (
    <div className="flex items-end justify-between gap-2 border-t border-line/50 pt-2">
      <div className="min-w-0">
        <div className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">Camera layout</div>
        <div className="mt-0.5 text-[8px] leading-tight text-ink/35">
          {active.blurb} · the journey keeps running
        </div>
      </div>
      <div role="radiogroup" aria-label="Camera layout" className="flex shrink-0 gap-1">
        {LAYOUTS.map((entry) => {
          const selected = entry.id === layout
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${entry.label} view`}
              onClick={() => onChange(entry.id)}
              className={`rounded-lg border px-2 py-1 text-[10px] leading-none transition ${
                selected
                  ? 'border-ion/70 bg-ion/20 text-ink'
                  : 'border-line/60 bg-void/50 text-ink/60 hover:border-line hover:text-ink'
              }`}
            >
              {entry.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** First-person cockpit glass: forward view, onboard clock and speed. */
export function CockpitOverlay({ clock, shipName, compact = false }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute top-3 left-3 h-7 w-7 border-t border-l border-ink/25" />
      <div className="absolute top-3 right-3 h-7 w-7 border-t border-r border-ink/25" />
      <div className="absolute bottom-3 left-3 h-7 w-7 border-b border-l border-ink/25" />
      <div className="absolute right-3 bottom-3 h-7 w-7 border-r border-b border-ink/25" />

      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ion/30 ${
          compact ? 'h-14 w-14' : 'h-24 w-24'
        }`}
      >
        <div className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/90" />
        <div className="absolute top-1/2 left-1/2 h-px w-10 -translate-x-1/2 -translate-y-1/2 bg-ink/20" />
        <div className="absolute top-1/2 left-1/2 h-10 w-px -translate-x-1/2 -translate-y-1/2 bg-ink/20" />
      </div>

      <div
        className={`absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 rounded-xl border border-line/60 bg-void/85 backdrop-blur ${
          compact ? 'px-2 py-1.5' : 'px-3 py-2'
        }`}
      >
        <div className="min-w-0">
          <div className="text-[7px] tracking-[0.14em] text-ink/45 uppercase">Onboard</div>
          <div className={`num mt-0.5 text-ink ${compact ? 'text-[11px]' : 'text-[15px]'}`}>
            {formatYears(clock.shipYears)}
          </div>
          {!compact && <div className="truncate text-[9px] text-ink/45">{shipName} proper time</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[7px] tracking-[0.14em] text-ink/45 uppercase">Speed</div>
          <div className={`num mt-0.5 text-ink ${compact ? 'text-[11px]' : 'text-[15px]'}`}>
            {clock.beta.toFixed(3)} c
          </div>
          {!compact && (
            <div className="num text-[9px] text-ink/45">{formatNumber(clock.kmS, 0)} km/s</div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Relativity HUD. Every value is a function of the same `progress` fraction:
 * reference clock, proper-time clock, their difference, distance and
 * completion. Mission totals are shown unmodified so the visual playback rate
 * can never be mistaken for the physics.
 */
export default function FlightHud({
  mission,
  clock,
  shipName,
  layout,
  onLayoutChange,
  delayed,
  onDelayedChange,
  delayYears,
  retardedPercent,
  showDelayedSignal,
  simplified,
}) {
  return (
    <section className="panel space-y-2 p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="label">Relativity HUD</div>
        <span className="num rounded-full border border-line/60 px-2 py-0.5 text-[9px] text-ink/60">
          γ {clock.gamma.toFixed(3)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ClockCard
          label="Reference frame"
          note="Departure-system rest frame"
          years={clock.earthYears}
          tip="A reference frame is the clock and grid of one observer. Here it is the departure system at rest: the ship's speed, distance and arrival time are all measured from it."
          tipLabel="What a reference frame is"
        />
        <ClockCard
          label="Spacecraft proper"
          note={`${shipName} frame`}
          years={clock.shipYears}
          accent
          tip="Proper time is what the crew's own clock reads. A clock moving through a frame ticks slower by 1/γ, so at 0.8 c the crew ages about 0.6 years for every year that passes at home."
          tipLabel="Why the spacecraft clock runs slow"
        />
      </div>

      {mission.mode === 'advanced' && mission.advanced && (
        <AdvancedPanel model={mission.advanced} clock={clock} />
      )}

      <div className="rounded-xl border border-line/55 bg-void/60 px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">
              Accumulated age difference
            </span>
            <InfoTip label="Why the two clocks disagree">
              Both clocks start together. The ship's path through spacetime is shorter than the
              departure system's, so it accumulates less time — the classical twin effect. It is a
              real difference between worldlines, not a display error.
            </InfoTip>
          </div>
          <span className="num text-[13px] text-ink/90">{formatYears(clock.driftYears)}</span>
        </div>
        <div className="mt-0.5 text-[9px] text-ink/40">
          reference − spacecraft · {formatDays(clock.driftYears)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Speed"
          value={`${clock.beta.toFixed(3)} c`}
          note={`${formatNumber(clock.kmS, 0)} km/s`}
        />
        <Stat
          label="Lorentz factor"
          value={clock.gamma.toFixed(3)}
          note="1 / √(1 − β²)"
          tip="γ is the factor behind time dilation and length contraction: at higher cruise speeds it grows faster, so the gap between the two clocks widens for the same route."
          tipLabel="Why faster ships age less"
        />
        <Stat
          label="Distance remaining"
          value={ly(clock.remainingLy)}
          note={`${ly(clock.travelledLy)} travelled`}
        />
        <Stat
          label="Journey progress"
          value={`${(clock.progress * 100).toFixed(1)}%`}
          note={`${formatNumber(clock.travelledLy, 2)} of ${formatNumber(mission.distanceLy, 2)} ly`}
        />
      </div>

      <div className="relative h-1.5 overflow-hidden rounded-full bg-panel/70">
        <div
          className="h-full rounded-full bg-ion transition-[width] duration-100"
          style={{ width: `${clock.progress * 100}%` }}
        />
      </div>

      <p className="text-[8px] leading-relaxed text-ink/35">
        Both clocks read the same trajectory: reference {formatYears(mission.earthYears)},
        spacecraft {formatYears(mission.shipYears)} over{' '}
        {formatNumber(mission.distanceLy, 2)} ly.{' '}
        {mission.mode === 'advanced'
          ? `Proper time is integrated through acceleration, cruise and braking at ${mission.advanced.accelMs.toFixed(
              2,
            )} m/s² proper acceleration.`
          : `Constant cruise at ${mission.beta.toFixed(3)} c; the proper-time integral is simply t/γ.`}{' '}
        Playback speed only changes the animation.
      </p>

      {showDelayedSignal && (
        <DelayedSignal
          enabled={delayed}
          onChange={onDelayedChange}
          delayYears={delayYears}
          retardedPercent={retardedPercent}
          shipName={shipName}
        />
      )}

      <LayoutPicker layout={layout} onChange={onLayoutChange} />

      {simplified && (
        <p className="text-[8px] leading-relaxed text-ink/30">
          Simplified graphics on this device: fewer stars, no antialiasing and a capped pixel ratio
          to keep every panel smooth.
        </p>
      )}
    </section>
  )
}
