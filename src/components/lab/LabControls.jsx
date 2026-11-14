import { formatNumber, formatYears } from '../../lib/physics'
import { LAB_PLANETS } from '../../lib/labCatalog'
import { accelMsFromG, clockParts, formatPercentC } from '../../lib/labPhysics'

const SPEED_PRESETS = [0.5, 0.8, 0.9, 0.99, 0.999]
const ACCEL_PRESETS = [0.5, 1, 2, 4]

function PlanetSelect({ id, label, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="text-[10px] tracking-[0.14em] text-muted uppercase">
        {label}
      </label>
      <select
        id={id}
        className="field mt-1.5 appearance-none py-2 text-[12px]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {LAB_PLANETS.map((planet) => (
          <option key={planet.id} value={planet.id}>
            {planet.isOrigin
              ? `${planet.name} — Sol, departure station`
              : `${planet.name} — ${formatNumber(planet.distanceLy, 2)} ly from Earth`}
          </option>
        ))}
      </select>
    </div>
  )
}

function SliderRow({ label, value, display, min, max, step, onChange, ariaLabel, hint }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] tracking-[0.14em] text-muted uppercase">{label}</span>
        <span className="num text-[12px] font-semibold text-ink">{display}</span>
      </div>
      <input
        type="range"
        className="slider mt-2"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        style={{ '--pct': `${((value - min) / (max - min)) * 100}%` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint && <div className="mt-1 text-[10px] leading-relaxed text-muted/70">{hint}</div>}
    </div>
  )
}

export default function LabControls({
  startId,
  endId,
  onStartChange,
  onEndChange,
  onSwap,
  beta,
  onBetaChange,
  accelG,
  onAccelChange,
  durationBounds,
  voyage,
  onDurationChange,
  playing,
  missionTime,
  shipClockYears,
  onPlay,
  onPause,
  onResume,
  onReset,
  onExit,
}) {
  const minLog = Math.log10(durationBounds.min)
  const maxLog = Math.log10(Math.max(durationBounds.max, durationBounds.min * 1.2))
  const durationLog = Math.log10(Math.min(maxLog, Math.max(minLog, voyage.duration)))
  const arrived = missionTime >= voyage.duration && voyage.duration > 0
  const status = arrived ? 'Arrived' : playing ? 'Running' : missionTime > 0 ? 'Paused' : 'Ready'
  const progress = Math.min(100, (missionTime / (voyage.duration || 1)) * 100)
  const shipClock = clockParts(shipClockYears)

  return (
    <div className="panel flex h-full min-w-0 flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="label">Simulation controls</div>
          <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight">Flight plan</h2>
        </div>
        <span
          className={`num rounded-full border px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase ${
            arrived
              ? 'border-mint/40 bg-mint/10 text-mint'
              : playing
                ? 'border-ion/40 bg-ion/10 text-ion'
                : 'border-line bg-white/[0.02] text-muted'
          }`}
        >
          {status}
        </span>
      </div>

      <div className="rounded-xl border border-line/70 bg-void/40 px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[9px] tracking-[0.16em] text-muted uppercase">Ship proper clock</div>
            <div className="num mt-1 text-[24px] leading-none font-semibold text-mint">
              {shipClock.years}y {shipClock.days}d
              <span className="ml-1.5 text-[13px] font-normal text-muted">{shipClock.hms}</span>
            </div>
          </div>
          <span className="num text-[10px] text-muted">{Math.round(progress)}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-ion/60 to-mint transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          <button type="button" className="btn btn-primary px-1.5 py-2 text-[11px]" onClick={onPlay} disabled={playing}>
            {arrived ? 'Relaunch' : 'Start'}
          </button>
          <button type="button" className="btn px-1.5 py-2 text-[11px]" onClick={onPause} disabled={!playing}>
            Pause
          </button>
          <button
            type="button"
            className="btn px-1.5 py-2 text-[11px]"
            onClick={onResume}
            disabled={playing || missionTime <= 0 || arrived}
          >
            Resume
          </button>
          <button type="button" className="btn px-1.5 py-2 text-[11px]" onClick={onReset}>
            Reset
          </button>
        </div>
        <p className="mt-2 text-[9px] leading-relaxed text-muted/60">
          Playback compresses the flight into about 26 seconds. Changing any parameter replays it
          from launch with the new solution.
        </p>
      </div>

      <div className="space-y-2.5">
        <PlanetSelect id="lab-start" label="Starting planet" value={startId} onChange={onStartChange} />
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-line/70" />
          <button
            type="button"
            className="chip px-2 py-0.5 text-[10px]"
            onClick={onSwap}
            aria-label="Swap starting and destination planets"
          >
            ⇅ swap
          </button>
          <div className="h-px flex-1 bg-line/70" />
        </div>
        <PlanetSelect id="lab-end" label="Destination planet" value={endId} onChange={onEndChange} />
        <div className="num flex items-center justify-between rounded-lg border border-line/60 bg-void/40 px-3 py-2 text-[10px] text-muted">
          <span>Route · radial separation</span>
          <span className="text-ink">{formatNumber(voyage.distanceLy, 2)} ly</span>
        </div>
        {voyage.distanceLy <= 0.051 && (
          <p className="text-[10px] leading-relaxed text-solar/90">
            These two worlds sit at almost the same catalog distance. Pick a destination with a
            different distance for a meaningful route.
          </p>
        )}
      </div>

      <div className="space-y-4 border-t border-line/70 pt-3.5">
        <SliderRow
          label="Cruise velocity"
          value={beta}
          display={`${beta.toFixed(3)} c`}
          min={0.05}
          max={0.999}
          step={0.001}
          ariaLabel="Cruise velocity as a fraction of the speed of light"
          onChange={onBetaChange}
          hint={`${formatNumber(beta * 299792458, 0)} m/s · ${formatPercentC(beta * 100)}`}
        />
        <div className="flex flex-wrap gap-1.5">
          {SPEED_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`chip ${Math.abs(preset - beta) < 0.0005 ? 'border-ion/60 text-ion' : ''}`}
              onClick={() => onBetaChange(preset)}
            >
              {preset} c
            </button>
          ))}
        </div>

        <SliderRow
          label="Proper acceleration"
          value={accelG}
          display={`${accelG.toFixed(1)} g`}
          min={0.1}
          max={10}
          step={0.1}
          ariaLabel="Proper acceleration in Earth gravities"
          onChange={onAccelChange}
          hint={`${formatNumber(accelMsFromG(accelG), 2)} m/s² · burns last ${formatYears(voyage.tAccel)} each`}
        />
        <div className="flex flex-wrap gap-1.5">
          {ACCEL_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`chip ${Math.abs(preset - accelG) < 0.05 ? 'border-ion/60 text-ion' : ''}`}
              onClick={() => onAccelChange(preset)}
            >
              {preset} g
            </button>
          ))}
        </div>

        <SliderRow
          label="Journey duration"
          value={durationLog}
          display={formatYears(voyage.duration)}
          min={minLog}
          max={maxLog}
          step={0.004}
          ariaLabel="Journey duration in years"
          onChange={(value) => onDurationChange(10 ** value)}
          hint={`Achievable ${formatYears(durationBounds.min)} – ${formatYears(durationBounds.max)} at ${accelG.toFixed(1)} g. Changing it retunes the cruise speed.`}
        />
      </div>

      <div className="mt-auto border-t border-line/70 pt-3">
        <button type="button" className="btn w-full px-3 py-2 text-[11px] text-muted" onClick={onExit}>
          ← Back to the mission flow
        </button>
      </div>
    </div>
  )
}
