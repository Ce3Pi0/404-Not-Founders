import { formatNumber } from '../../lib/physics'
import { formatGap } from '../../lib/labPhysics'
import { ATMOSPHERE_M } from '../../lib/launchPhysics'

const G0 = 9.80665

function Item({ question, answer, equation, value }) {
  return (
    <div className="rounded-xl border border-line/70 bg-void/40 px-3.5 py-3">
      <h3 className="text-[12px] font-semibold tracking-tight text-ink">{question}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{answer}</p>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-line/50 bg-void/30 px-2.5 py-1.5">
        <span className="text-[10px] text-muted">{equation}</span>
        <span className="text-[11px] text-ion">{value}</span>
      </div>
    </div>
  )
}

export default function EducationPanel({ telemetry, route, config, open, onToggle }) {
  const gravitationalRate = telemetry.clockRate * telemetry.gamma
  const rMetres = (route.startFrame?.radiusM ?? 0) + telemetry.altitudeM
  const schwarzschild = route.startFrame?.rsM ?? 0

  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="label">Educational overlay</div>
          <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight">What the simulation is showing</h2>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={open}
            onChange={(event) => onToggle(event.target.checked)}
            className="h-4 w-4 accent-[#5ee7ff]"
          />
          Show explanations
        </label>
      </div>

      {open && (
        <>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <Item
              question="Why does the spacecraft feel G-forces during acceleration?"
              answer="G-force is the push of the engines and the local gravity you feel, measured as proper acceleration ÷ 9.80665 m/s². It is not what makes clocks differ: a ship coasting at 0.9 c feels 0 g yet still ages slower."
              equation="g = a_proper / 9.80665 m/s²"
              value={`${telemetry.gForce.toFixed(2)} g now · peak ${telemetry.maxG.toFixed(2)} g`}
            />
            <Item
              question="Why does velocity affect the passage of time?"
              answer="Two observers in relative motion disagree about simultaneity, so a moving clock ticks fewer seconds for each second of coordinate time. The effect grows sharply as speed approaches c."
              equation="dτ/dt = √(1 − v²/c²)"
              value={`${formatNumber(telemetry.beta, 5)} c → ${formatNumber(1 / telemetry.gamma, 8)}`}
            />
            <Item
              question="Why does the ship's clock read a different time?"
              answer="Its proper time is the integral of that rate over the path it actually flew, including the slow climbs and the fast cruise. The gap against the launch planet's clock is the twin effect, accumulated live."
              equation="τ = ∫ √(1 − v²/c²)·√(1 − rₛ/r) dt"
              value={`T ${formatNumber(telemetry.aClockYears, 3)} yr − τ ${formatNumber(telemetry.shipClockYears, 3)} yr = ${formatGap(telemetry.divergenceYears)}`}
            />
            <Item
              question="How does gravity affect time?"
              answer="A clock deeper in a gravity well runs slower than one further out. Near the launch planet the factor is tiny but real; the sim applies it while the ship climbs out of the well and drops it in deep space."
              equation="dτ/dt = √(1 − rₛ/r)"
              value={`r ${formatNumber((rMetres / 1000) || 0, 0)} km · rₛ ${formatNumber(schwarzschild, 3)} m → ${formatNumber(gravitationalRate, 9)}`}
            />
            <Item
              question="What happens as the ship approaches the speed of light?"
              answer="γ grows without bound, so the same thrust buys less and less speed and the ship's clock slows towards a standstill relative to the stations. Reaching 0.995 c here still leaves light permanently ahead of the ship."
              equation="γ = 1/√(1 − v²/c²)"
              value={`${formatNumber(telemetry.gamma, 4)} → rate ${formatNumber(1 / telemetry.gamma, 6)} at ${telemetry.percentC.toFixed(2)}% c`}
            />
            <Item
              question="What is simplified?"
              answer={`The atmosphere is a 100 km shell climbed at the launch angle; the engine is treated as a photon drive (Isp = c/g₀) with a fixed ship mass; the destination's gravity well, orbital motion and tidal effects are ignored. Playback compresses the mission timeline (${config.missionYears.toFixed(1)} yr of coordinate time) without changing the physics.`}
              equation="thrust acceleration = min(set-point, thrust / mass)"
              value={`${(Math.min(config.accelMs, config.thrustN / config.massKg) / G0).toFixed(2)} g in ${telemetry.altitudeM < ATMOSPHERE_M ? 'atmosphere' : 'space'}`}
            />
          </div>
        </>
      )}
    </section>
  )
}
