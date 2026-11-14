import { useEffect, useRef, useState } from 'react'
import { C_KM_S, formatNumber, clamp } from '../lib/physics'
import { classifyPlanet, starSpectralClass } from '../lib/planet'

const PRESETS = [0.5, 0.8, 0.9, 0.99, 0.999]

function SpeedField({ beta, onChange }) {
  const [text, setText] = useState((beta * 100).toFixed(1))
  const inputRef = useRef(null)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setText((beta * 100).toFixed(1))
  }, [beta])

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="number"
        min="5"
        max="99.9"
        step="0.1"
        inputMode="decimal"
        aria-label="Cruise speed as a percentage of the speed of light"
        className="field num w-24 text-center"
        value={text}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          const parsed = Number(next)
          if (Number.isFinite(parsed) && parsed >= 5 && parsed <= 99.9) onChange(parsed / 100)
        }}
        onBlur={() => {
          const parsed = Number(text)
          if (!Number.isFinite(parsed) || parsed < 5 || parsed > 99.9) {
            setText((beta * 100).toFixed(1))
          } else {
            onChange(parsed / 100)
            setText((clamp(parsed, 5, 99.9)).toFixed(1))
          }
        }}
      />
      <span className="text-[12px] text-muted">% of c</span>
    </div>
  )
}

export default function FlightPlan({
  planet,
  beta,
  onBetaChange,
  shipName,
  onShipNameChange,
  prediction,
  onPredictionChange,
  onLaunch,
  onBack,
}) {
  const look = classifyPlanet(planet)
  const pct = ((beta - 0.05) / (0.999 - 0.05)) * 100

  return (
    <div className="screen space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Stage 2 — Prepare</div>
          <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            Configure the spacecraft
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            Target <span className="text-ink">{planet.name}</span> · {formatNumber(planet.distanceLy, 2)} ly
            out · host star {planet.star ?? planet.name} ({starSpectralClass(planet)})
          </p>
        </div>
        <button type="button" className="btn text-xs" onClick={onBack}>
          ← Change destination
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="panel min-w-0 space-y-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="label">Cruise speed</div>
              <div className="num mt-1 text-4xl font-semibold tracking-tight text-ion">
                {beta.toFixed(3)}<span className="ml-1 text-lg text-ion/70">c</span>
              </div>
              <div className="num mt-1 text-[11px] text-muted">
                {formatNumber(beta * C_KM_S, 0)} km/s
              </div>
            </div>
            <div className="rounded-lg border border-line/70 bg-white/[0.02] px-2.5 py-1.5 text-right">
              <div className="text-[9px] tracking-[0.14em] text-muted uppercase">Lorentz factor</div>
              <div className="num text-[11px] text-muted/80">γ hidden until arrival</div>
            </div>
          </div>

          <div>
            <input
              type="range"
              className="slider"
              min="0.05"
              max="0.999"
              step="0.001"
              value={beta}
              aria-label="Max velocity as a fraction of the speed of light"
              style={{ '--pct': `${pct}%` }}
              onChange={(event) => onBetaChange(Number(event.target.value))}
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted/70">
              <span className="num">0.05 c</span>
              <span className="num">0.999 c</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SpeedField beta={beta} onChange={onBetaChange} />
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
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
          </div>

          <div className="rounded-xl border border-line/70 bg-void/40 px-3.5 py-3">
            <div className="label text-[9px]">Spacecraft</div>
            <input
              className="field mt-2"
              value={shipName}
              maxLength={28}
              aria-label="Spacecraft name"
              onChange={(event) => onShipNameChange(event.target.value)}
            />
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Constant velocity for this draft. Acceleration and deceleration phases are the next
              iteration — at 1 g you could cross the galaxy in a human lifetime.
            </p>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="panel p-5 sm:p-6">
            <div className="label">Stage 3 — Predict</div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Two clocks, one trip</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              A clock on Earth and a clock in the crew cabin run at different rates. Guess both
              durations — the answer is revealed on arrival.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="predict-earth" className="mb-1 block text-[10px] tracking-[0.14em] text-muted uppercase">
                  Earth years
                </label>
                <input
                  id="predict-earth"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 4.7"
                  className="field num"
                  value={prediction.earth}
                  onChange={(event) => onPredictionChange({ ...prediction, earth: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor="predict-ship" className="mb-1 block text-[10px] tracking-[0.14em] text-muted uppercase">
                  Ship years
                </label>
                <input
                  id="predict-ship"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 2.0"
                  className="field num"
                  value={prediction.ship}
                  onChange={(event) => onPredictionChange({ ...prediction, ship: event.target.value })}
                />
              </div>
            </div>

            <p className="mt-3 text-[10px] text-muted/80">
              Optional — launch without a prediction and the debrief still shows the physics.
            </p>
          </div>

          <div className="panel p-5 sm:p-6">
            <dl className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Destination</dt>
                <dd className="text-right text-ink">{planet.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Distance</dt>
                <dd className="num text-right text-ink">{formatNumber(planet.distanceLy, 2)} ly</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Cruise speed</dt>
                <dd className="num text-right text-ink">{beta.toFixed(3)} c</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">World type</dt>
                <dd className="text-right text-ink/85">{look.label}</dd>
              </div>
            </dl>

            <button type="button" className="btn btn-primary mt-4 w-full" onClick={onLaunch}>
              Launch {shipName.trim() || 'mission'} →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
