import { formatNumber } from '../../lib/physics'
import { clockParts, formatGap } from '../../lib/labPhysics'
import { LIMITS, PLAYBACK_SPEEDS, engineAccel } from '../../lib/launchPhysics'
import LaunchSlider from './LaunchSlider'
import StageProgress from './StageProgress'

const G0 = 9.80665

function statusTone(state) {
  if (state.phase === 'complete') return 'border-mint/40 bg-mint/10 text-mint'
  if (state.phase === 'holding') return 'border-solar/45 bg-solar/10 text-solar'
  if (state.phase === 'prelaunch') return 'border-line bg-white/[0.02] text-muted'
  return 'border-ion/40 bg-ion/10 text-ion'
}

function statusText(state, playing) {
  switch (state.phase) {
    case 'prelaunch':
      return 'Ready'
    case 'complete':
      return 'Complete'
    case 'holding':
      return 'Blocked'
    case 'arrival':
      return 'Arriving'
    default:
      return playing ? 'Running' : 'Paused'
  }
}

export default function LaunchControls({
  config,
  onChange,
  state,
  telemetry,
  playing,
  speed,
  onSpeedChange,
  onLaunch,
  onPause,
  onResume,
  onRestart,
  onReset,
  launched,
  advisory,
  onDismissAdvisory,
  onEnginesToggle,
}) {
  const clock = clockParts(telemetry.shipClockYears)
  const accel = engineAccel(config)
  const inSpace = state.phase === 'space' || state.phase === 'arrival' || state.phase === 'complete'

  return (
    <div className="panel flex h-full min-w-0 flex-col gap-3.5 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="label">Mission control</div>
          <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight">Launch console</h2>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase ${statusTone(state)}`}>
          {statusText(state, playing)}
        </span>
      </div>

      <div className="rounded-xl border border-line/70 bg-void/40 px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[9px] tracking-[0.16em] text-muted uppercase">Ship proper clock</div>
            <div className="mt-1 text-[24px] leading-none font-semibold text-mint">
              {clock.years}y {clock.days}d
              <span className="ml-1.5 text-[13px] font-normal text-muted">{clock.hms}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] tracking-[0.14em] text-muted uppercase">Stage</div>
            <div className="mt-1 text-[11px] font-medium text-ink">{telemetry.stageLabel}</div>
          </div>
        </div>

        {state.phase === 'countdown' && (
          <div className="mt-2 text-center text-[34px] leading-none font-semibold text-solar">
            T−{state.countdown.toFixed(1)} s
          </div>
        )}

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-ion/60 to-mint transition-[width] duration-100"
            style={{ width: `${Math.min(100, telemetry.progress * 100)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-muted">
          <span>A {formatNumber(telemetry.aClockYears, 3)} yr</span>
          <span>{Math.round(telemetry.progress * 100)}%</span>
          <span>B {formatNumber(telemetry.bClockYears, 3)} yr</span>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <button
            type="button"
            className="btn btn-primary px-2 py-2 text-[11px]"
            onClick={onLaunch}
            disabled={playing}
          >
            {launched ? 'Launch again' : 'Launch simulation'}
          </button>
          <button type="button" className="btn px-2 py-2 text-[11px]" onClick={onPause} disabled={!playing}>
            Pause
          </button>
          <button
            type="button"
            className="btn px-2 py-2 text-[11px]"
            onClick={onResume}
            disabled={playing || !launched || state.phase === 'complete'}
          >
            Resume
          </button>
          <button type="button" className="btn px-2 py-2 text-[11px]" onClick={onRestart} disabled={!launched}>
            Restart
          </button>
          <button type="button" className="btn px-2 py-2 text-[11px]" onClick={onReset} disabled={!launched}>
            Reset
          </button>
        </div>
      </div>

      <StageProgress stage={telemetry.stage} progress={telemetry.progress} />

      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] tracking-[0.14em] text-muted uppercase">Simulation speed</span>
          <span className="text-[10px] text-muted">
            {PLAYBACK_SPEEDS.find((preset) => preset.value === speed)?.blurb ?? 'custom'}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {PLAYBACK_SPEEDS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`chip ${preset.value === speed ? 'border-ion/60 text-ion' : ''}`}
              aria-pressed={preset.value === speed}
              onClick={() => onSpeedChange(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[9px] leading-relaxed text-muted/60">
          Playback compresses the mission timeline; the physics always runs on the simulated clock.
        </p>
      </div>

      <div className="space-y-3.5 border-t border-line/70 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] tracking-[0.14em] text-muted uppercase">Engine</div>
            <div className="mt-0.5 text-[11px] text-ink">
              {(telemetry.thrustN / 1e6).toFixed(2)} MN
              <span className="text-muted"> · {telemetry.accelerationMs.toFixed(1)} m/s²</span>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.engines}
            aria-label="Engines active"
            onClick={() => onEnginesToggle(!state.engines)}
            disabled={!launched || state.phase === 'complete'}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition disabled:opacity-40 ${state.engines ? 'border-mint/70 bg-mint/25' : 'border-line bg-white/[0.05]'
              }`}
          >
            <span
              className={`absolute h-4 w-4 rounded-full transition-all ${state.engines ? 'left-[24px] bg-mint shadow-[0_0_14px_rgba(92,225,166,0.9)]' : 'left-[3px] bg-muted/70'
                }`}
            />
          </button>
        </div>

        <LaunchSlider
          label="Thrust"
          live={launched}
          value={config.thrustN}
          display={`${(config.thrustN / 1e6).toFixed(2)} MN`}
          min={LIMITS.thrustN.min}
          max={LIMITS.thrustN.max}
          step={LIMITS.thrustN.step}
          onChange={(value) => onChange({ thrustN: value })}
          hint={`Delivers ${(config.thrustN / config.massKg).toFixed(1)} m/s² to this craft.`}
        />
        <LaunchSlider
          label="Acceleration set-point"
          live={launched}
          value={config.accelMs}
          display={`${config.accelMs.toFixed(1)} m/s²`}
          min={LIMITS.accelMs.min}
          max={LIMITS.accelMs.max}
          step={LIMITS.accelMs.step}
          onChange={(value) => onChange({ accelMs: value })}
          hint={`${accel.toFixed(1)} m/s² = ${(accel / G0).toFixed(2)} g is achievable within the thrust limit.`}
        />
        <LaunchSlider
          label="Target velocity"
          live={launched}
          value={config.maxVelocityC}
          display={`${(config.maxVelocityC * 100).toFixed(1)}% c`}
          min={LIMITS.maxVelocityC.min}
          max={LIMITS.maxVelocityC.max}
          step={LIMITS.maxVelocityC.step}
          onChange={(value) => onChange({ maxVelocityC: value })}
          hint={
            telemetry.beta > config.maxVelocityC
              ? 'The ship is already faster than this: it coasts, because nothing slows it without a braking burn.'
              : 'Engines cut out when the ship reaches this speed.'
          }
        />
        <LaunchSlider
          label="Flight direction"
          live={launched && !inSpace}
          value={config.launchAngleDeg}
          display={`${config.launchAngleDeg}° above horizon`}
          min={LIMITS.launchAngleDeg.min}
          max={LIMITS.launchAngleDeg.max}
          step={LIMITS.launchAngleDeg.step}
          onChange={(value) => onChange({ launchAngleDeg: value })}
          disabled={inSpace}
          hint={
            inSpace
              ? 'In space the heading follows the route; steering needs thrust vectoring, so the climb angle only applies during the ascent.'
              : 'Gimballing the climb changes how quickly the ship leaves the atmosphere.'
          }
        />
        <LaunchSlider
          label="Direction (azimuth)"
          value={config.azimuthDeg}
          display={`${config.azimuthDeg}°`}
          min={LIMITS.azimuthDeg.min}
          max={LIMITS.azimuthDeg.max}
          step={LIMITS.azimuthDeg.step}
          onChange={(value) => onChange({ azimuthDeg: value })}
          hint="Moves the launch site and the flight path."
        />
      </div>

      {(advisory || telemetry.notice) && (
        <div className="space-y-1.5">
          {advisory && (
            <div className="rounded-xl border border-solar/40 bg-solar/[0.08] px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] leading-relaxed text-solar/95">{advisory}</p>
                <button
                  type="button"
                  className="shrink-0 text-[10px] text-solar/70 hover:text-solar"
                  onClick={onDismissAdvisory}
                  aria-label="Dismiss note"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          {telemetry.notice && (
            <div className="rounded-xl border border-violet/35 bg-violet/[0.08] px-3 py-2">
              <p className="text-[10px] leading-relaxed text-violet/95">{telemetry.notice}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto grid grid-cols-2 gap-1.5 border-t border-line/70 pt-3 text-[10px]">
        <div className="flex items-center justify-between rounded-lg border border-line/60 bg-void/40 px-2.5 py-1.5">
          <span className="text-muted">A − ship</span>
          <span className="text-solar">{formatGap(telemetry.divergenceYears)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-line/60 bg-void/40 px-2.5 py-1.5">
          <span className="text-muted">Peak G</span>
          <span className="text-ink">{telemetry.maxG.toFixed(2)} g</span>
        </div>
      </div>
    </div>
  )
}
