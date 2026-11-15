import { formatNumber, formatYears } from '../../lib/physics'
import {
  G0,
  LIMITS,
  defaultDepartureType,
  recommendLaunch,
  resolveDepartureType,
  surfaceGravityMs2,
} from '../../lib/advancedSR'

function Rail({ value, min, max, step, onChange, label }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="relative mt-1.5 h-[18px]">
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line/60" />
      <div
        className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-ion"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
      <input
        type="range"
        className="slider relative"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

function NumField({ id, label, value, min, max, step, suffix, onChange, hint }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[8px] tracking-[0.14em] text-ink/45 uppercase"
      >
        {label}
      </label>
      <div className="mt-1 flex items-center gap-1.5">
        <input
          id={id}
          type="number"
          className="field px-2.5 py-1.5 text-[12px]"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (!Number.isFinite(next)) return
            onChange(Math.min(max, Math.max(min, next)))
          }}
        />
        <span className="shrink-0 text-[9px] text-ink/50">{suffix}</span>
      </div>
      {hint && <div className="mt-0.5 text-[8px] leading-tight text-ink/35">{hint}</div>}
    </div>
  )
}

function Value({ label, value, note, strong = false }) {
  return (
    <div className="rounded-lg border border-line/40 bg-void/50 px-2.5 py-2">
      <div className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">{label}</div>
      <div className={`num mt-0.5 ${strong ? 'text-[14px] text-ink' : 'text-[12px] text-ink/90'}`}>
        {value}
      </div>
      {note && <div className="mt-0.5 text-[8px] text-ink/35">{note}</div>}
    </div>
  )
}

const ly = (value) =>
  `${formatNumber(value, value !== 0 && Math.abs(value) < 1 ? 4 : 2)} ly`

/**
 * The advanced parameters and their predictions. Everything here is derived
 * from the same `planMission` result the launch uses.
 */
export default function AdvancedParameters({
  beta,
  onBetaChange,
  config,
  onChange,
  plan,
  origin,
  distanceLy,
}) {
  const { model, feasibility, simple } = plan
  const departureType = resolveDepartureType(origin, config.departureType)
  const gravity = surfaceGravityMs2(origin)
  const totalT = (Number(config.dryMassT) || 0) + (Number(config.propellantT) || 0)
  const blocked = feasibility && !feasibility.ok
  // Never leave an unflyable plan without a way out: one click fixes it.
  const recommendation = blocked ? recommendLaunch(config, origin) : null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[9px] tracking-[0.16em] text-ink/45 uppercase">
          Advanced flight parameters
        </div>
        <span className="text-[9px] text-ink/40">
          Constant proper acceleration · automatic arrival braking
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-line/45 bg-void/40 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">
              Target cruise velocity
            </span>
            <span className="num text-[14px] text-ink">{beta.toFixed(3)} c</span>
          </div>
          <Rail
            value={beta}
            min={0.1}
            max={0.99}
            step={0.005}
            onChange={onBetaChange}
            label="Target cruise velocity as a fraction of the speed of light"
          />
          <div className="mt-0.5 flex justify-between text-[8px] text-ink/40">
            <span className="num">0.10 c</span>
            <span className="num">{formatNumber(beta * 299792.458, 0)} km/s</span>
            <span className="num">0.99 c</span>
          </div>
          <p className="mt-1 text-[8.5px] leading-relaxed text-ink/35">
            The maximum desired speed — not a guarantee the ship can reach it over a short
            journey.
          </p>
        </div>

        <div className="rounded-xl border border-line/45 bg-void/40 px-3 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">
              Proper acceleration
            </span>
            <span className="num text-[14px] text-ink">
              {Number(config.accelMs).toFixed(2)} m/s²
            </span>
          </div>
          <Rail
            value={config.accelMs}
            min={LIMITS.accelMs.min}
            max={LIMITS.accelMs.max}
            step={LIMITS.accelMs.step}
            onChange={(accelMs) => onChange({ accelMs })}
            label="Proper acceleration in metres per second squared"
          />
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              className="field px-2 py-1 text-[11px]"
              aria-label="Proper acceleration, precise value"
              value={config.accelMs}
              min={LIMITS.accelMs.min}
              max={LIMITS.accelMs.max}
              step="0.01"
              onChange={(event) => {
                const next = Number(event.target.value)
                if (!Number.isFinite(next)) return
                onChange({
                  accelMs: Math.min(LIMITS.accelMs.max, Math.max(LIMITS.accelMs.min, next)),
                })
              }}
            />
            <span className="num shrink-0 text-[10px] text-ink/60">
              = {(config.accelMs / G0).toFixed(2)} g
            </span>
            <span className="text-[8px] text-ink/35">what the crew’s accelerometer reads</span>
          </div>
          <div className="mt-1 flex gap-1.5">
            {[1, 1.5, 2, 3].map((g) => (
              <button
                key={g}
                type="button"
                className="chip px-2 py-0.5 text-[9px]"
                onClick={() => onChange({ accelMs: Number((g * G0).toFixed(2)) })}
              >
                {g} g
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <NumField
          id="adv-dry-mass"
          label="Spacecraft dry mass"
          value={config.dryMassT}
          min={LIMITS.dryMassT.min}
          max={LIMITS.dryMassT.max}
          step={LIMITS.dryMassT.step}
          suffix="t"
          onChange={(dryMassT) => onChange({ dryMassT })}
        />
        <NumField
          id="adv-propellant"
          label="Carried propellant mass — mass check only"
          value={config.propellantT}
          min={LIMITS.propellantT.min}
          max={LIMITS.propellantT.max}
          step={LIMITS.propellantT.step}
          suffix="t"
          onChange={(propellantT) => onChange({ propellantT })}
          hint="Counted in launch mass. Fuel burn is not modelled."
        />
        <NumField
          id="adv-thrust"
          label="Maximum engine thrust"
          value={config.thrustMN}
          min={LIMITS.thrustMN.min}
          max={LIMITS.thrustMN.max}
          step={LIMITS.thrustMN.step}
          suffix="MN"
          onChange={(thrustMN) => onChange({ thrustMN })}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/45 bg-void/40 px-3 py-2">
        <div>
          <div className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">Departure type</div>
          <div className="mt-0.5 text-[9px] text-ink/35">
            {defaultDepartureType(origin) === 'surface'
              ? 'Defaults to a surface launch for this measured world.'
              : 'No measured mass and radius — orbital departure by default.'}
          </div>
        </div>
        <div role="radiogroup" aria-label="Departure type" className="flex gap-1">
          {[
            { id: 'surface', label: 'Planetary surface' },
            { id: 'orbital', label: 'Orbital departure' },
          ].map((option) => {
            const active = departureType === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ departureType: option.id })}
                className={`rounded-lg border px-2.5 py-1 text-[10px] transition ${
                  active
                    ? 'border-ion/70 bg-ion/20 text-ink'
                    : 'border-line/60 bg-void/50 text-ink/60 hover:border-line hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-x-3 gap-y-0.5 rounded-xl border border-line/45 bg-void/40 px-3 py-2 text-[9.5px] sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <span className="text-ink/45">Total initial mass</span>
          <span className="num text-ink/85">{formatNumber(feasibility?.totalMassT ?? totalT, 0)} t</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-ink/45">Max initial thrust acceleration</span>
          <span className="num text-ink/85">
            {formatNumber(feasibility?.maxAccelMs2 ?? 0, 2)} m/s²
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-ink/45">
            {departureType === 'surface' ? `${origin?.name ?? 'World'} surface gravity` : 'Local gravity'}
          </span>
          <span className="num text-ink/85">
            {departureType === 'surface'
              ? gravity != null
                ? `${gravity.toFixed(2)} m/s²`
                : 'not measured'
              : 'not applied'}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-ink/45">Engine capacity</span>
          <span className={`num ${feasibility?.thrustOk ? 'text-ink/85' : 'text-[#ffb9a0]'}`}>
            {feasibility?.thrustOk ? 'sufficient' : 'below the set-point'}
          </span>
        </div>
      </div>

      {blocked && (
        <div
          className="space-y-2 rounded-xl border border-[#ff7a45]/60 bg-[#ff7a45]/10 px-3 py-2.5"
          role="alert"
          data-testid="advanced-warnings"
        >
          {feasibility.issues.map((issue) => (
            <div key={issue.id}>
              <div className="text-[9.5px] font-semibold tracking-[0.14em] text-[#ffb9a0] uppercase">
                {issue.title}
              </div>
              {issue.lines.map((line) => (
                <p key={line} className="mt-0.5 text-[9.5px] leading-relaxed text-[#ffd8c9]">
                  {line}
                </p>
              ))}
            </div>
          ))}
          <p className="text-[8.5px] leading-relaxed text-[#ffb9a0]/80">
            This is a launch-configuration problem, not a resource-budget failure. The flight
            cannot start until it is corrected.
          </p>
        </div>
      )}

      {recommendation && (
        <div
          className="rounded-xl border border-[#7cf0a8]/50 bg-[#7cf0a8]/10 px-3 py-2.5"
          data-testid="recommended-launch"
        >
          <div className="text-[9px] font-semibold tracking-[0.14em] text-[#b8ffd4] uppercase">
            Recommended launch settings
          </div>
          <p className="mt-0.5 text-[9.5px] leading-relaxed text-[#d9ffe8]">
            {formatNumber(recommendation.accelMs, 1)} m/s² with{' '}
            {formatNumber(recommendation.thrustMN, 1)} MN of thrust clears lift-off at{' '}
            {formatNumber(feasibility.totalMassT, 0)} t and holds the set-point.
          </p>
          <button
            type="button"
            className="btn mt-1.5 px-2.5 py-1 text-[10px]"
            data-testid="apply-recommended"
            onClick={() =>
              onChange({
                accelMs: recommendation.accelMs,
                thrustMN: recommendation.thrustMN,
              })
            }
          >
            Use these settings
          </button>
        </div>
      )}

      {model ? (
        <div className="space-y-2">
          {!model.reachedTarget && (
            <div className="rounded-xl border border-[#5ee7ff]/50 bg-[#5ee7ff]/10 px-3 py-2 text-[9.5px] leading-relaxed text-[#c9f7ff]">
              Requested cruise speed cannot be reached over this distance. The spacecraft will
              accelerate to{' '}
              <span className="num">{model.betaPeak.toFixed(3)} c</span> and then begin braking.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Value label="Target velocity" value={`${model.requestedBeta.toFixed(3)} c`} />
            <Value
              label="Actual peak velocity"
              value={`${model.betaPeak.toFixed(3)} c`}
              note={`γ ${model.gammaPeak.toFixed(3)}`}
            />
            <Value
              label="Proper acceleration"
              value={`${model.accelMs.toFixed(2)} m/s²`}
              note={`${(model.accelMs / G0).toFixed(2)} g`}
            />
            <Value label="Acceleration distance" value={ly(model.accelDistanceLy)} />
            <Value label="Braking distance" value={ly(model.brakeDistanceLy)} />
            <Value
              label="Cruise distance"
              value={ly(model.cruiseDistanceLy)}
              note={model.reachedTarget ? 'constant speed' : 'none — peak-limited leg'}
            />
            <Value label="Time accelerating" value={formatYears(model.accelYears)} note="Earth frame" />
            <Value label="Time cruising" value={formatYears(model.cruiseYears)} note="Earth frame" />
            <Value label="Time braking" value={formatYears(model.brakeYears)} note="Earth frame" />
            <Value
              label="Acceleration ship time"
              value={formatYears(model.shipAccelYears)}
              note="proper time"
            />
            <Value
              label="Cruise ship time"
              value={formatYears(model.shipCruiseYears)}
              note="proper time"
            />
            <Value
              label="Braking ship time"
              value={formatYears(model.shipBrakeYears)}
              note="proper time"
            />
            <Value
              label="Total Earth-reference time"
              value={formatYears(model.earthYears)}
              strong
            />
            <Value
              label="Total spacecraft proper time"
              value={formatYears(model.shipYears)}
              strong
            />
            <Value
              label="Aging difference"
              value={formatYears(model.driftYears)}
              note="Earth − ship"
            />
          </div>

          <p className="text-[8.5px] leading-relaxed text-ink/35">
            Distances add up exactly: {ly(model.accelDistanceLy)} + {ly(model.cruiseDistanceLy)} +{' '}
            {ly(model.brakeDistanceLy)} = {ly(distanceLy)}. Braking begins at{' '}
            {formatNumber(model.brakeStartFraction * 100, 1)}% of the route.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-line/45 bg-void/40 px-3 py-2">
              <div className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">
                Simple SR · constant velocity
              </div>
              <div className="mt-1 flex justify-between text-[10px]">
                <span className="text-ink/45">Earth time</span>
                <span className="num text-ink/85">{formatYears(simple.earthYears)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-ink/45">Ship time</span>
                <span className="num text-ink/85">{formatYears(simple.shipYears)}</span>
              </div>
            </div>
            <div className="rounded-xl border border-ion/50 bg-ion/10 px-3 py-2">
              <div className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">
                Advanced SR · finite acceleration
              </div>
              <div className="mt-1 flex justify-between text-[10px]">
                <span className="text-ink/45">Earth time</span>
                <span className="num text-ink/85">{formatYears(model.earthYears)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-ink/45">Ship time</span>
                <span className="num text-ink/85">{formatYears(model.shipYears)}</span>
              </div>
            </div>
          </div>
          <p className="text-[8.5px] leading-relaxed text-ink/35">
            Advanced SR spends real time and distance accelerating and braking, so the same route
            can take longer on both clocks even though the peak speed is lower.
          </p>
        </div>
      ) : (
        <p className="text-[10px] text-ink/45">
          Choose two different host systems to calculate an advanced trajectory.
        </p>
      )}
    </div>
  )
}
