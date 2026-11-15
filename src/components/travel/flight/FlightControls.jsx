import { formatYears } from '../../../lib/physics'
import { FLIGHT_TIMELINE_SECONDS, PLAYBACK_RATES } from '../../../lib/flight'

const CAMERAS = [
  {
    id: 'external',
    label: 'External',
    blurb: "Bird's-eye follow",
    detail: 'Follow the spacecraft from outside: the route, both systems and its place on the line.',
  },
  {
    id: 'observer',
    label: 'Departure Observer',
    blurb: 'Watch it leave',
    detail: 'A fixed vantage near the departure system, with the reference-frame clock and an optional delayed-signal view.',
  },
  {
    id: 'cockpit',
    label: 'Cockpit',
    blurb: 'Forward view',
    detail: 'First-person view from the spacecraft, looking down the route with the onboard clock and speed.',
  },
]

function ControlButton({ children, onClick, disabled, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn px-3 py-1.5 text-[11px] ${primary ? 'btn-primary' : ''}`}
    >
      {children}
    </button>
  )
}

export default function FlightControls({
  camera,
  onCameraChange,
  started,
  playing,
  progress,
  arrived,
  rate,
  onRateChange,
  onStart,
  onPause,
  onResume,
  onRestart,
  delayed,
  onDelayedChange,
  yearsPerSecond,
  originName,
  destinationName,
}) {
  const complete = progress >= 1

  return (
    <div className="space-y-2.5 border-t border-line/50 px-3 py-3 sm:px-4">
      <div>
        <div className="flex items-center justify-between text-[9px] tracking-[0.12em] text-ink/50 uppercase">
          <span className="truncate">{originName}</span>
          <span className="num shrink-0 px-2 text-ink/80">{(progress * 100).toFixed(1)}%</span>
          <span className="truncate text-right">{destinationName}</span>
        </div>
        <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-panel/70">
          <div
            className="h-full rounded-full bg-ion transition-[width] duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ControlButton onClick={onStart} disabled={started || complete} primary>
          Start
        </ControlButton>
        <ControlButton onClick={onPause} disabled={!playing}>
          Pause
        </ControlButton>
        <ControlButton onClick={onResume} disabled={!started || playing || complete}>
          Resume
        </ControlButton>
        <ControlButton onClick={onRestart} disabled={arrived || complete}>
          Restart
        </ControlButton>

        <label
          htmlFor="flight-playback"
          className="ml-auto flex items-center gap-1.5 text-[9px] tracking-[0.12em] text-ink/45 uppercase"
        >
          Playback
          <select
            id="flight-playback"
            aria-label="Playback speed"
            value={rate}
            onChange={(event) => onRateChange(Number(event.target.value))}
            className="rounded-md border border-line/70 bg-void/80 px-1.5 py-0.5 text-[10px] tracking-normal text-ink normal-case"
          >
            {PLAYBACK_RATES.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-stretch gap-2">
        <div
          role="radiogroup"
          aria-label="Camera perspective"
          className="grid min-w-[240px] flex-1 grid-cols-3 gap-1.5"
        >
          {CAMERAS.map((entry) => {
            const active = entry.id === camera
            return (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={active}
                title={entry.detail}
                onClick={() => onCameraChange(entry.id)}
                className={`rounded-lg border px-2 py-1.5 text-left transition ${
                  active
                    ? 'border-ion/70 bg-ion/15 text-ink'
                    : 'border-line/60 bg-void/40 text-ink/65 hover:border-line hover:text-ink'
                }`}
              >
                <span className="block text-[10px] leading-tight font-semibold">{entry.label}</span>
                <span className="mt-0.5 block text-[8px] tracking-[0.06em] text-ink/45 uppercase">
                  {entry.blurb}
                </span>
              </button>
            )
          })}
        </div>

        {camera === 'observer' && (
          <div className="flex items-center gap-2 rounded-lg border border-line/60 bg-void/40 px-2.5">
            <span className="text-[9px] leading-tight tracking-[0.1em] text-ink/45 uppercase">
              Delayed
              <br />
              signal
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={delayed}
              aria-label="Delayed signal view"
              onClick={() => onDelayedChange(!delayed)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition ${
                delayed ? 'border-ion/70 bg-ion/40' : 'border-line/70 bg-panel/40'
              }`}
            >
              <span
                className={`absolute h-3.5 w-3.5 rounded-full transition-all ${
                  delayed ? 'left-[19px] bg-ink' : 'left-[3px] bg-ink/60'
                }`}
              />
            </button>
          </div>
        )}
      </div>

      <p className="text-[9px] leading-relaxed text-ink/40">
        Visual timeline: {FLIGHT_TIMELINE_SECONDS} s per journey at 1×, so 1 s ≈{' '}
        {formatYears(yearsPerSecond)} of reference-frame time. The mission's calculated distance and
        travel time never change with playback speed.
      </p>
    </div>
  )
}
