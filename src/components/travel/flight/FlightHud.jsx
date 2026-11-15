import { formatDays, formatNumber, formatYears } from '../../../lib/physics'

function ly(value) {
  return `${formatNumber(value, value < 1 ? 5 : 2)} ly`
}

function Stat({ label, value, note }) {
  return (
    <div className="rounded-lg border border-line/50 bg-void/50 px-2.5 py-2">
      <div className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">{label}</div>
      <div className="num mt-0.5 text-[14px] text-ink">{value}</div>
      <div className="mt-0.5 text-[9px] text-ink/40">{note}</div>
    </div>
  )
}

function ClockCard({ label, note, years, accent = false }) {
  return (
    <div
      className={`rounded-xl border px-2.5 py-2 ${accent ? 'border-ion/60 bg-ion/[0.12]' : 'border-line/55 bg-void/60'}`}
    >
      <div className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">{label}</div>
      <div className="num mt-1 text-[19px] leading-none text-ink">{formatYears(years)}</div>
      <div className="num mt-1 text-[9px] text-ink/50">{formatDays(years)}</div>
      <div className="mt-0.5 text-[8px] text-ink/35">{note}</div>
    </div>
  )
}

function DelayedSignal({ enabled, onChange, delayYears, retardedPercent, shipName }) {
  return (
    <div className="rounded-xl border border-line/50 bg-void/50 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">Delayed signal</span>
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
          ? `White marker: the ship's image that left it ${formatYears(delayYears)} ago, at ${retardedPercent.toFixed(1)}% of the route. Light from a ship still leaving is always behind where the simulation has it now.`
          : `The live simulated position is drawn at full detail. Enable this to also show the retarded image of ${shipName} as the departure observer's light would deliver it.`}
      </p>
    </div>
  )
}

/** First-person cockpit glass: forward view, onboard clock and speed. */
export function CockpitOverlay({ clock, shipName }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute top-3 left-3 h-7 w-7 border-t border-l border-ink/25" />
      <div className="absolute top-3 right-3 h-7 w-7 border-t border-r border-ink/25" />
      <div className="absolute bottom-3 left-3 h-7 w-7 border-b border-l border-ink/25" />
      <div className="absolute right-3 bottom-3 h-7 w-7 border-r border-b border-ink/25" />

      <div className="absolute top-1/2 left-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ion/30">
        <div className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/90" />
        <div className="absolute top-1/2 left-1/2 h-px w-16 -translate-x-1/2 -translate-y-1/2 bg-ink/20" />
        <div className="absolute top-1/2 left-1/2 h-16 w-px -translate-x-1/2 -translate-y-1/2 bg-ink/20" />
      </div>

      <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 rounded-xl border border-line/60 bg-void/85 px-3 py-2 backdrop-blur">
        <div>
          <div className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">Onboard clock</div>
          <div className="num mt-0.5 text-[15px] text-ink">{formatYears(clock.shipYears)}</div>
          <div className="text-[9px] text-ink/45">{shipName} proper time</div>
        </div>
        <div className="text-right">
          <div className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">Speed</div>
          <div className="num mt-0.5 text-[15px] text-ink">{clock.beta.toFixed(3)} c</div>
          <div className="num text-[9px] text-ink/45">{formatNumber(clock.kmS, 0)} km/s</div>
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
  camera,
  delayed,
  onDelayedChange,
  delayYears,
  retardedPercent,
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
        />
        <ClockCard
          label="Spacecraft proper"
          note={`${shipName} frame`}
          years={clock.shipYears}
          accent
        />
      </div>

      <div className="rounded-xl border border-line/55 bg-void/60 px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">
            Accumulated age difference
          </span>
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
        <Stat label="Lorentz factor" value={clock.gamma.toFixed(3)} note="1 / √(1 − β²)" />
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
        Both clocks use the same simulation progress and the mission's validated durations: reference{' '}
        {formatYears(mission.earthYears)}, spacecraft {formatYears(mission.shipYears)} at{' '}
        {mission.beta.toFixed(3)} c over {formatNumber(mission.distanceLy, 2)} ly. Playback speed only
        changes the animation.
      </p>

      {camera === 'observer' && (
        <DelayedSignal
          enabled={delayed}
          onChange={onDelayedChange}
          delayYears={delayYears}
          retardedPercent={retardedPercent}
          shipName={shipName}
        />
      )}
    </section>
  )
}
