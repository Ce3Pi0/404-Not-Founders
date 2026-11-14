import { formatNumber } from '../../lib/physics'
import {
  clockParts,
  formatDistanceKm,
  formatGap,
  formatPercentC,
  formatRate,
} from '../../lib/labPhysics'

function DigitalClock({ years, tone = 'text-ink' }) {
  const clock = clockParts(years)
  return (
    <div className="num flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
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

function ClockCard({ label, station, years, tone, ring, sub }) {
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${ring}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="label text-[9px]">{label}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${tone}`} />
      </div>
      <div className="mt-1 text-[11px] text-ink/80">{station}</div>
      <div className="mt-2">
        <DigitalClock years={years} tone={tone.replace('bg-', 'text-')} />
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

function Timeline({ voyage, telemetry }) {
  const total = voyage.duration || 1
  const segments = [
    { key: 'departure', width: (voyage.tAccel / total) * 100, color: 'bg-solar/70' },
    { key: 'cruise', width: (voyage.tCruise / total) * 100, color: 'bg-ion/60' },
    { key: 'arrival', width: (voyage.tDecel / total) * 100, color: 'bg-mint/60' },
  ]
  return (
    <div className="mt-3">
      <div className="relative">
        <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
          {segments.map((segment) => (
            <div key={segment.key} className={`h-full ${segment.color}`} style={{ width: `${segment.width}%` }} />
          ))}
        </div>
        <div
          className="absolute -top-1 h-4 w-[2px] rounded-full bg-ink shadow-[0_0_10px_rgba(233,241,250,0.9)]"
          style={{ left: `calc(${Math.min(100, telemetry.progress * 100)}% - 1px)` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[9px] tracking-[0.14em] text-muted/70 uppercase">
        <span>A · departure burn</span>
        <span>cruise</span>
        <span>arrival burn · B</span>
      </div>
    </div>
  )
}

function Gauge({ label, value, max, tone = 'bg-ion' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] tracking-[0.12em] text-muted uppercase">{label}</span>
        <span className="num text-[12px] text-ink">{formatNumber(value, 2)} g</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className={`h-full rounded-full ${tone} transition-[width] duration-200`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function TelemetryDashboard({ telemetry, voyage, startPlanet, endPlanet, shipName }) {
  const gapLabel = formatGap(telemetry.divergenceYears)
  const stationGap = telemetry.abGapYears

  return (
    <div className="space-y-4">
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="label">Live clocks</div>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight">Coordinate time vs proper time</h2>
          </div>
          <span className="num rounded-full border border-ion/40 bg-ion/10 px-2.5 py-1 text-[10px] tracking-[0.14em] text-ion uppercase">
            {telemetry.phase}
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ClockCard
            label="Point A clock"
            station={`${startPlanet?.name ?? 'Point A'} · observer`}
            years={telemetry.aClockYears}
            tone="bg-ion"
            ring="border-ion/30 bg-ion/[0.05]"
            sub="coordinate frame · at rest"
          />
          <ClockCard
            label="Point B clock"
            station={`${endPlanet?.name ?? 'Point B'} · observer`}
            years={telemetry.bClockYears}
            tone="bg-violet"
            ring="border-violet/30 bg-violet/[0.05]"
            sub="coordinate frame · at rest"
          />
          <ClockCard
            label={`${shipName} clock`}
            station="Aboard the spacecraft"
            years={telemetry.shipClockYears}
            tone="bg-mint"
            ring="border-mint/35 bg-mint/[0.06]"
            sub="proper time along the worldline"
          />
          <div className="rounded-xl border border-solar/30 bg-solar/[0.05] px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="label text-[9px]">Clock divergence</span>
              <span className="h-1.5 w-1.5 rounded-full bg-solar" />
            </div>
            <div className="mt-1 text-[11px] text-ink/80">Point A minus ship</div>
            <div className="num mt-2 text-[26px] leading-none font-semibold text-solar sm:text-[28px]">{gapLabel}</div>
            <div className="num mt-2 text-[10px] text-muted">
              A − B station gap {formatGap(stationGap)}
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Coordinate time T" value={`${formatNumber(telemetry.t, 3)} yr`} sub="station frame" />
          <Metric
            label="Proper time τ"
            value={`${formatNumber(telemetry.shipClockYears, 3)} yr`}
            sub="integrated on the ship"
            tone="text-mint"
          />
          <Metric label="Instantaneous γ" value={formatNumber(telemetry.gamma, 4)} sub="1 / √(1 − β²)" />
          <Metric
            label="Cumulative dilation"
            value={`${formatNumber(telemetry.cumulativeFactor, 4)}×`}
            sub="T / τ measured so far"
            tone="text-ion"
          />
        </div>

        <Timeline voyage={voyage} telemetry={telemetry} />

        <p className="mt-3 text-[10px] leading-relaxed text-muted/80">
          Point A and Point B share a rest frame (their orbital motion relative to one another is
          ignored), so their clocks differ only by the gravitational potential at each surface,
          reported below in parts per billion. The ship&apos;s proper time is integrated along its
          trajectory: ∫ (1/γ)·√(1 − rₛ/r) dt over the departure burn, cruise and arrival burn.
          Acceleration enters that integral only through the velocity and potential it produces.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="panel p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="label">Spacecraft telemetry</div>
            <span className="num text-[10px] text-muted">
              {Math.round(telemetry.progress * 100)}% of route
            </span>
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
              sub={telemetry.gForce > 0 ? (telemetry.signedG > 0 ? 'accelerating' : 'braking') : 'coasting'}
            />
            <Metric
              label="Distance travelled"
              value={`${formatNumber(telemetry.distanceLy, 3)} ly`}
              sub={formatDistanceKm(telemetry.distanceLy)}
            />
            <Metric
              label="Remaining to B"
              value={`${formatNumber(telemetry.remainingLy, 3)} ly`}
              sub={formatDistanceKm(telemetry.remainingLy)}
            />
            <Metric label="Route length" value={`${formatNumber(voyage.distanceLy, 3)} ly`} sub="radial separation" />
            <Metric
              label="Peak cruise speed"
              value={`${(voyage.betaPeak * 100).toFixed(2)}% c`}
              sub={voyage.capped ? 'route-limited (target capped)' : `${formatNumber(voyage.gammaPeak, 4)}× γ`}
            />
          </div>
        </section>

        <section className="panel p-4 sm:p-5">
          <div className="label">G-force</div>
          <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight">
            Proper acceleration ÷ 9.80665 m/s²
          </h2>
          <div className="mt-3 space-y-3">
            <Gauge label="Current" value={telemetry.gForce} max={Math.max(2, voyage.accelG)} tone="bg-ion" />
            <Gauge
              label="Maximum"
              value={voyage.accelG}
              max={Math.max(2, voyage.accelG)}
              tone="bg-solar"
            />
            <Gauge
              label="Average over flight"
              value={voyage.avgG}
              max={Math.max(2, voyage.accelG)}
              tone="bg-mint"
            />
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted/80">
            G-force tracks proper acceleration and does not by itself dilate time. The average is
            weighted over coordinate flight time, so a long coast lowers it.
          </p>
        </section>
      </div>

      <section className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="label">Flight segments</div>
          <span className="num text-[10px] text-muted">T = {formatNumber(voyage.duration, 4)} yr · τ = {formatNumber(voyage.shipProper, 4)} yr</span>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[11px]">
            <thead>
              <tr className="text-[9px] tracking-[0.14em] text-muted/80 uppercase">
                <th className="pb-1.5 font-medium">Segment</th>
                <th className="pb-1.5 font-medium">Coordinate time</th>
                <th className="pb-1.5 font-medium">Ship proper time</th>
                <th className="pb-1.5 font-medium">Proper acceleration</th>
                <th className="pb-1.5 font-medium">Gravitational rate</th>
              </tr>
            </thead>
            <tbody className="num text-ink/85">
              <tr className="border-t border-line/50">
                <td className="py-1.5 pr-3 text-ink">
                  Departure burn <span className="text-muted">· {startPlanet?.name}</span>
                </td>
                <td className="py-1.5 pr-3">{formatNumber(voyage.tAccel, 4)} yr</td>
                <td className="py-1.5 pr-3 text-mint">{formatNumber(voyage.tauAccel, 4)} yr</td>
                <td className="py-1.5 pr-3">{formatNumber(voyage.accelG, 2)} g</td>
                <td className="py-1.5 pr-3 text-muted">{formatRate(voyage.startFrame.clockRate)}</td>
              </tr>
              <tr className="border-t border-line/50">
                <td className="py-1.5 pr-3 text-ink">
                  Cruise <span className="text-muted">· deep space</span>
                </td>
                <td className="py-1.5 pr-3">{formatNumber(voyage.tCruise, 4)} yr</td>
                <td className="py-1.5 pr-3 text-mint">{formatNumber(voyage.cruiseProper, 4)} yr</td>
                <td className="py-1.5 pr-3">0 g</td>
                <td className="py-1.5 pr-3 text-muted">1</td>
              </tr>
              <tr className="border-t border-line/50">
                <td className="py-1.5 pr-3 text-ink">
                  Arrival burn <span className="text-muted">· {endPlanet?.name}</span>
                </td>
                <td className="py-1.5 pr-3">{formatNumber(voyage.tDecel, 4)} yr</td>
                <td className="py-1.5 pr-3 text-mint">{formatNumber(voyage.tauDecel, 4)} yr</td>
                <td className="py-1.5 pr-3">{formatNumber(voyage.accelG, 2)} g</td>
                <td className="py-1.5 pr-3 text-muted">{formatRate(voyage.endFrame.clockRate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
