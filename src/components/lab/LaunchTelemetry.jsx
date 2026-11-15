import { formatNumber } from '../../lib/physics'
import { LY_M, clockParts, formatDistanceKm, formatGap, formatPercentC } from '../../lib/labPhysics'

const G0 = 9.80665

function formatAltitude(metres) {
  if (!Number.isFinite(metres)) return '—'
  if (metres < 1000) return `${Math.round(metres)} m`
  if (metres < 1e7) return `${(metres / 1000).toPrecision(4)} km`
  return `${formatDistanceKm(metres / LY_M)}`
}

function DigitalClock({ years, tone = 'text-ink' }) {
  const clock = clockParts(years)
  return (
    <div className="num flex flex-wrap items-baseline gap-x-1.5">
      <span className={`text-[26px] leading-none font-semibold tabular-nums sm:text-[30px] ${tone}`}>
        {clock.years}
        <span className="ml-0.5 text-[11px] font-normal text-muted">y</span>
      </span>
      <span className="text-[26px] leading-none font-semibold tabular-nums sm:text-[30px]">
        {clock.days}
        <span className="ml-0.5 text-[11px] font-normal text-muted">d</span>
      </span>
      <span className="text-base leading-none tabular-nums text-muted/90">{clock.hms}</span>
    </div>
  )
}

function ClockCard({ label, station, years, dot, ring, tone, sub }) {
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${ring}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="label text-[9px]">{label}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      </div>
      <div className="mt-1 text-[11px] text-ink/80">{station}</div>
      <div className="mt-2">
        <DigitalClock years={years} tone={tone} />
      </div>
      <div className="num mt-2 text-[10px] text-muted">{sub}</div>
    </div>
  )
}

function Metric({ label, value, sub, tone = 'text-ink' }) {
  return (
    <div className="rounded-lg border border-line/60 bg-void/40 px-3 py-2">
      <div className="text-[9px] tracking-[0.14em] text-muted uppercase">{label}</div>
      <div className={`num mt-1 text-[15px] leading-tight font-semibold ${tone}`}>{value}</div>
      {sub && <div className="num mt-0.5 text-[10px] text-muted">{sub}</div>}
    </div>
  )
}

function Gauge({ label, value, display, max, tone = 'bg-ion' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] tracking-[0.12em] text-muted uppercase">{label}</span>
        <span className="num text-[12px] text-ink">{display}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className={`h-full rounded-full ${tone} transition-[width] duration-200`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Equation({ children, value }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-line/50 bg-void/30 px-2.5 py-1.5">
      <span className="num text-[10px] text-muted">{children}</span>
      <span className="num text-[11px] text-ink">{value}</span>
    </div>
  )
}

export default function LaunchTelemetry({ telemetry, route, config, shipName }) {
  const shipLabel = shipName || 'Odyssey'
  const gravitationalRate = telemetry.clockRate * telemetry.gamma
  const accelState =
    telemetry.thrustN > 0
      ? telemetry.braking
        ? 'braking burn'
        : 'under thrust'
      : telemetry.phase === 'prelaunch' || telemetry.phase === 'countdown'
        ? 'on the pad'
        : 'coasting · weightless'

  return (
    <div className="space-y-4">
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="label">Live clocks</div>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight">Three clocks, one flight</h2>
          </div>
          <span className="num rounded-full border border-ion/40 bg-ion/10 px-2.5 py-1 text-[10px] tracking-[0.14em] text-ion uppercase">
            {telemetry.stageLabel}
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ClockCard
            label="Launch planet"
            station={`${route.startPlanet?.name ?? 'Point A'} · surface`}
            years={telemetry.aClockYears}
            dot="bg-ion"
            ring="border-ion/30 bg-ion/[0.05]"
            tone="text-ion"
            sub={`coordinate time · rate ${route.startFrame.clockRate.toFixed(6)}`}
          />
          <ClockCard
            label="Destination"
            station={`${route.endPlanet?.name ?? 'Point B'} · surface`}
            years={telemetry.bClockYears}
            dot="bg-violet"
            ring="border-violet/30 bg-violet/[0.05]"
            tone="text-violet"
            sub={`coordinate time · rate ${route.endFrame.clockRate.toFixed(6)}`}
          />
          <ClockCard
            label={`${shipLabel} clock`}
            station="Aboard the spacecraft"
            years={telemetry.shipClockYears}
            dot="bg-mint"
            ring="border-mint/35 bg-mint/[0.06]"
            tone="text-mint"
            sub="proper time integrated along the path"
          />
          <div className="rounded-xl border border-solar/30 bg-solar/[0.05] px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="label text-[9px]">Clock difference</span>
              <span className="h-1.5 w-1.5 rounded-full bg-solar" />
            </div>
            <div className="mt-1 text-[11px] text-ink/80">launch planet − ship</div>
            <div className="num mt-2 text-[26px] leading-none font-semibold text-solar sm:text-[28px]">
              {formatGap(telemetry.divergenceYears)}
            </div>
            <div className="num mt-2 text-[10px] text-muted">
              planet − destination {formatGap(telemetry.stationGapYears)}
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Coordinate time T" value={`${formatNumber(telemetry.tYears, 3)} yr`} sub="launch-planet frame" />
          <Metric
            label="Proper time τ"
            value={`${formatNumber(telemetry.shipClockYears, 3)} yr`}
            sub="integrated on the ship"
            tone="text-mint"
          />
          <Metric label="Dilation factor T/τ" value={`${formatNumber(telemetry.dilationFactor, 4)}×`} sub="measured so far" tone="text-ion" />
          <Metric label="Instantaneous rate" value={formatNumber(telemetry.clockRate, 6)} sub="dτ/dt right now" />
        </div>

        <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
          <Equation value={`${formatNumber(telemetry.gamma, 4)}`}>γ = 1/√(1 − v²/c²)</Equation>
          <Equation value={`${formatNumber(1 / telemetry.gamma, 6)}`}>√(1 − v²/c²)</Equation>
          <Equation value={`${formatNumber(gravitationalRate, 8)}`}>√(1 − rₛ/r)</Equation>
        </div>

        <p className="mt-3 text-[10px] leading-relaxed text-muted/80">
          The ship&apos;s proper time is integrated step by step along the path it actually flies:
          dτ = dt · √(1 − v²/c²) · √(1 − rₛ/r), with the gravitational factor taken from the launch
          planet&apos;s potential while the ship climbs out of it and 1 in deep space. Changing thrust
          changes v(t), and the clocks follow. The destination&apos;s gravity well, orbital motion and
          the ship&apos;s own changing mass are not modelled.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="panel p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="label">Spacecraft telemetry</div>
            <span className="num text-[10px] text-muted">{Math.round(telemetry.fraction * 100)}% of route</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Metric
              label="Velocity"
              value={`${formatNumber(telemetry.velocityMs, 0)} m/s`}
              sub={formatPercentC(telemetry.percentC)}
              tone="text-ion"
            />
            <Metric
              label="Acceleration"
              value={`${telemetry.accelerationMs >= 0 ? '+' : '−'}${formatNumber(Math.abs(telemetry.accelerationMs), 2)} m/s²`}
              sub={accelState}
            />
            <Metric label="G-force" value={`${telemetry.gForce.toFixed(2)} g`} sub={`proper acceleration ÷ ${G0}`} tone="text-solar" />
            <Metric label="Maximum G" value={`${telemetry.maxG.toFixed(2)} g`} sub="highest so far this flight" />
            <Metric
              label="Distance travelled"
              value={`${formatNumber(telemetry.travelledLy, 3)} ly`}
              sub={formatDistanceKm(telemetry.travelledLy)}
            />
            <Metric
              label="Remaining to destination"
              value={`${formatNumber(telemetry.remainingLy, 3)} ly`}
              sub={formatDistanceKm(telemetry.remainingLy)}
            />
            <Metric label="Altitude" value={formatAltitude(telemetry.altitudeM)} sub={`above ${route.startPlanet?.name ?? 'launch site'}`} />
            <Metric
              label="Engine thrust"
              value={`${(telemetry.thrustN / 1e6).toFixed(2)} MN`}
              sub={telemetry.engines ? 'engines active' : 'engines off'}
              tone={telemetry.thrustN > 0 ? 'text-mint' : 'text-muted'}
            />
          </div>
        </section>

        <section className="panel p-4 sm:p-5">
          <div className="label">Load and stress</div>
          <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight">Fuel, thrust and G</h2>
          <div className="mt-3 space-y-3">
            <Gauge
              label="G-force now"
              value={telemetry.gForce}
              display={`${telemetry.gForce.toFixed(2)} g`}
              max={Math.max(2, config.accelMs / G0 + 1)}
              tone="bg-solar"
            />
            <Gauge
              label="Peak G"
              value={telemetry.maxG}
              display={`${telemetry.maxG.toFixed(2)} g`}
              max={Math.max(2, config.accelMs / G0 + 1)}
              tone="bg-ion"
            />
            <Gauge
              label="Propellant"
              value={telemetry.fuelFraction}
              display={`${Math.round(telemetry.fuelFraction * 100)}% · ${(telemetry.fuelKg / 1000).toFixed(0)} t`}
              max={1}
              tone="bg-mint"
            />
            <Gauge
              label="Thrust"
              value={telemetry.thrustN}
              display={`${(telemetry.thrustN / 1e6).toFixed(2)} MN`}
              max={config.thrustN || 1}
              tone="bg-violet"
            />
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted/80">
            G-force is proper acceleration ÷ 9.80665 m/s² and is reported separately from time
            dilation: a ship coasting at 0.9 c still reads 0 g while its clock runs slow. At rest on the
            pad it reads 1 g from the planet&apos;s gravity alone.
          </p>
        </section>
      </div>
    </div>
  )
}
