import { useState } from 'react'
import { formatNumber } from '../../lib/physics'
import { LAB_PLANETS } from '../../lib/labCatalog'
import { LIMITS, engineAccel } from '../../lib/launchPhysics'
import LaunchSlider from './LaunchSlider'

const G0 = 9.80665

function PlanetSelect({ id, label, value, onChange, disabled }) {
  return (
    <div className={disabled ? 'opacity-55' : ''}>
      <label htmlFor={id} className="text-[10px] tracking-[0.14em] text-muted uppercase">
        {label}
      </label>
      <select
        id={id}
        className="field mt-1.5 appearance-none py-2 text-[12px]"
        value={value}
        disabled={disabled}
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

function Check({ label, checked, onChange, hint, disabled }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2 ${disabled ? 'cursor-not-allowed opacity-55' : ''}`}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#5ee7ff]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-[11px] leading-snug font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[10px] leading-relaxed text-muted/70">{hint}</span>}
      </span>
    </label>
  )
}

function SummaryCell({ label, value }) {
  return (
    <div className="rounded-lg border border-line/60 bg-void/40 px-2.5 py-1.5">
      <div className="text-[8px] tracking-[0.14em] text-muted uppercase">{label}</div>
      <div className="num mt-0.5 text-[11px] text-ink">{value}</div>
    </div>
  )
}

export default function LaunchConfigPanel({ config, onChange, route, plan, launched }) {
  const [open, setOpen] = useState(true)
  const accel = engineAccel(config)
  const noLiftoff = accel <= plan.surfaceGravity

  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="label">Configure launch</div>
          <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight">Mission parameters</h2>
          <p className="mt-1 max-w-xl text-[10px] leading-relaxed text-muted/80">
            Every control is wired to the integrator: the craft really accelerates at the thrust it can
            deliver, burns propellant, and its clocks follow the resulting trajectory.
          </p>
        </div>
        <button type="button" className="btn px-3 py-1.5 text-[11px]" onClick={() => setOpen((value) => !value)}>
          {open ? 'Hide parameters' : 'Show parameters'}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCell label="Route" value={`${formatNumber(route.distanceLy, 2)} ly`} />
        <SummaryCell label="Craft mass" value={`${(config.massKg / 1000).toFixed(0)} t`} />
        <SummaryCell label="Propellant" value={`${(config.fuelKg / 1000).toFixed(0)} t`} />
        <SummaryCell label="Engine thrust" value={`${(config.thrustN / 1e6).toFixed(2)} MN`} />
        <SummaryCell label="Acceleration" value={`${accel.toFixed(1)} m/s² · ${(accel / G0).toFixed(2)} g`} />
        <SummaryCell label="Target speed" value={`${(config.maxVelocityC * 100).toFixed(1)}% c`} />
        <SummaryCell label="Launch angle" value={`${config.launchAngleDeg}° · ${config.azimuthDeg}° az`} />
        <SummaryCell label="Countdown" value={`${config.countdownSeconds} s`} />
      </div>

      {open && (
        <div className="mt-4 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <PlanetSelect
              id="launch-planet"
              label="Launch planet"
              value={config.startId}
              onChange={(value) => onChange({ startId: value })}
              disabled={launched}
            />
            <div className="space-y-2">
              <PlanetSelect
                id="launch-destination"
                label="Destination"
                value={config.endId}
                onChange={(value) => onChange({ endId: value, customDestination: false })}
                disabled={config.customDestination}
              />
              <Check
                label="Custom destination distance"
                checked={config.customDestination}
                onChange={(value) => onChange({ customDestination: value })}
                hint="Fly to a free-standing waypoint instead of a catalog world."
              />
            </div>
          </div>

          {config.customDestination && (
            <LaunchSlider
              label="Waypoint distance"
              value={config.customDistanceLy}
              display={`${config.customDistanceLy.toFixed(1)} ly`}
              min={LIMITS.customDistanceLy.min}
              max={LIMITS.customDistanceLy.max}
              step={LIMITS.customDistanceLy.step}
              onChange={(value) => onChange({ customDistanceLy: value })}
              hint="Route length from the launch planet."
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <LaunchSlider
              label="Spacecraft mass"
              value={config.massKg}
              display={`${(config.massKg / 1000).toFixed(0)} t`}
              min={LIMITS.massKg.min}
              max={LIMITS.massKg.max}
              step={LIMITS.massKg.step}
              onChange={(value) => onChange({ massKg: value })}
              disabled={launched}
              hint={launched ? 'Mass is fixed once the ship is fuelled and flying.' : 'Heavier craft accelerate less for the same thrust.'}
            />
            <LaunchSlider
              label="Engine thrust"
              value={config.thrustN}
              display={`${(config.thrustN / 1e6).toFixed(2)} MN`}
              min={LIMITS.thrustN.min}
              max={LIMITS.thrustN.max}
              step={LIMITS.thrustN.step}
              onChange={(value) => onChange({ thrustN: value })}
              live={launched}
              hint={`Thrust can deliver at most ${(config.thrustN / config.massKg).toFixed(1)} m/s².`}
            />
            <LaunchSlider
              label="Acceleration"
              value={config.accelMs}
              display={`${config.accelMs.toFixed(1)} m/s²`}
              min={LIMITS.accelMs.min}
              max={LIMITS.accelMs.max}
              step={LIMITS.accelMs.step}
              onChange={(value) => onChange({ accelMs: value })}
              live={launched}
              hint={`${(accel / G0).toFixed(2)} g of thrust acceleration is actually achievable.`}
            />
            <LaunchSlider
              label="Fuel load"
              value={config.fuelKg}
              display={`${(config.fuelKg / 1000).toFixed(0)} t`}
              min={LIMITS.fuelKg.min}
              max={LIMITS.fuelKg.max}
              step={LIMITS.fuelKg.step}
              onChange={(value) => onChange({ fuelKg: value })}
              disabled={launched}
              hint={`${plan.burnYears.toFixed(2)} yr of full-thrust burn at this setting.`}
            />
            <LaunchSlider
              label="Initial velocity"
              value={config.initialVelocityMs}
              display={`${(config.initialVelocityMs / 1000).toFixed(1)} km/s`}
              min={LIMITS.initialVelocityMs.min}
              max={LIMITS.initialVelocityMs.max}
              step={LIMITS.initialVelocityMs.step}
              onChange={(value) => onChange({ initialVelocityMs: value })}
              disabled={launched}
              hint="Speed the craft already has at liftoff (for example from an orbital launch)."
            />
            <LaunchSlider
              label="Target velocity"
              value={config.maxVelocityC}
              display={`${(config.maxVelocityC * 100).toFixed(1)}% c`}
              min={LIMITS.maxVelocityC.min}
              max={LIMITS.maxVelocityC.max}
              step={LIMITS.maxVelocityC.step}
              onChange={(value) => onChange({ maxVelocityC: value })}
              live={launched}
              hint="The engines cut out once this speed is reached."
            />
            <LaunchSlider
              label="Launch angle"
              value={config.launchAngleDeg}
              display={`${config.launchAngleDeg}° above horizon`}
              min={LIMITS.launchAngleDeg.min}
              max={LIMITS.launchAngleDeg.max}
              step={LIMITS.launchAngleDeg.step}
              onChange={(value) => onChange({ launchAngleDeg: value })}
              hint="Steeper climbs leave the atmosphere faster and lose less to gravity."
            />
            <LaunchSlider
              label="Direction (azimuth)"
              value={config.azimuthDeg}
              display={`${config.azimuthDeg}°`}
              min={LIMITS.azimuthDeg.min}
              max={LIMITS.azimuthDeg.max}
              step={LIMITS.azimuthDeg.step}
              onChange={(value) => onChange({ azimuthDeg: value })}
              hint="Moves the launch site around the planet and turns the flight path."
            />
            <LaunchSlider
              label="Mission duration"
              value={config.missionYears}
              display={`${config.missionYears.toFixed(1)} yr`}
              min={LIMITS.missionYears.min}
              max={LIMITS.missionYears.max}
              step={LIMITS.missionYears.step}
              onChange={(value) => onChange({ missionYears: value })}
              hint="Coordinate-time budget: the run ends if the ship has not arrived by then."
            />
            <LaunchSlider
              label="Countdown"
              value={config.countdownSeconds}
              display={`${config.countdownSeconds} s`}
              min={LIMITS.countdownSeconds.min}
              max={LIMITS.countdownSeconds.max}
              step={LIMITS.countdownSeconds.step}
              onChange={(value) => onChange({ countdownSeconds: value })}
              disabled={launched}
              hint="Playback seconds of pre-launch countdown (scaled by the speed control)."
            />
          </div>

          <Check
            label="Automatic arrival burn"
            checked={config.autoBrake}
            onChange={(value) => onChange({ autoBrake: value })}
            hint="When the remaining distance equals the stopping distance, the ship flips and decelerates instead of flying past."
          />

          <p className={`text-[10px] leading-relaxed ${noLiftoff ? 'text-solar' : 'text-muted/70'}`}>
            {noLiftoff
              ? `Thrust acceleration (${accel.toFixed(1)} m/s²) does not clear ${route.startPlanet.name}'s surface gravity (${plan.surfaceGravity.toFixed(1)} m/s²) — the craft cannot lift off at these settings.`
              : `Liftoff margin: thrust acceleration is ${plan.liftoffMargin.toFixed(2)}× the launch planet's surface gravity.`}
          </p>
        </div>
      )}
    </section>
  )
}
