import LabScene from './LabScene'
import { formatNumber } from '../../lib/physics'
import { clockParts, formatGap, formatPercentC } from '../../lib/labPhysics'

const VIEW_LABEL = {
  first: 'First-person',
  second: 'Second-person',
  third: 'Third-person',
  bird: "Bird's-eye",
}

const VIEW_DETAIL = {
  first: 'Cockpit · forward view',
  second: 'Nearby tracking observer',
  third: 'Chase camera behind the ship',
  bird: 'Top-down system map',
}

function StatusDot({ playing, arrived }) {
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full ${arrived ? 'bg-mint' : playing ? 'pulse-soft bg-ion' : 'bg-muted/60'}`}
    />
  )
}

function Clock({ years, tone = 'text-ink', size = 'text-lg' }) {
  const parts = clockParts(years)
  return (
    <span className={`num tabular-nums ${size} ${tone}`}>
      {parts.years}y {parts.days}d <span className="text-muted/90">{parts.hms}</span>
    </span>
  )
}

function splitOverlayData(side, telemetry, startPlanet, endPlanet) {
  if (side === 'A') {
    return {
      title: 'Point A',
      station: startPlanet?.name ?? 'Departure',
      frame: 'Rest frame of Point A',
      clockYears: telemetry.aClockYears,
      clockLabel: "Observer's local clock",
      distanceLabel: 'Distance travelled',
      distance: `${formatNumber(telemetry.distanceLy, 3)} ly`,
      doppler: telemetry.dopplerA,
      dopplerLabel: telemetry.dopplerA <= 1 ? 'redshift' : 'blueshift',
      lightLag: telemetry.lightLagA,
      accent: 'border-ion/40 bg-ion/[0.07] text-ion',
      dot: 'bg-ion',
    }
  }
  return {
    title: 'Point B',
    station: endPlanet?.name ?? 'Destination',
    frame: 'Rest frame of Point B',
    clockYears: telemetry.bClockYears,
    clockLabel: "Observer's local clock",
    distanceLabel: 'Distance to Point B',
    distance: `${formatNumber(telemetry.remainingLy, 3)} ly`,
    doppler: telemetry.dopplerB,
    dopplerLabel: telemetry.dopplerB >= 1 ? 'blueshift' : 'redshift',
    lightLag: telemetry.lightLagB,
    accent: 'border-violet/40 bg-violet/[0.07] text-violet',
    dot: 'bg-violet',
  }
}

function SplitPanel({ side, telemetry, startPlanet, endPlanet }) {
  const data = splitOverlayData(side, telemetry, startPlanet, endPlanet)
  return (
    <div className="panel relative overflow-hidden">
      <div className="relative h-[300px] sm:h-[360px] xl:h-[400px]">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_35%,#071019,#03050a_72%)]" />
        <div className="absolute inset-0">
          <LabScene
            side={side}
            telemetry={telemetry}
            startPlanet={startPlanet}
            endPlanet={endPlanet}
          />
        </div>

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${data.dot}`} />
              <span className="label text-[9px]">{data.title}</span>
            </div>
            <div className="mt-0.5 text-[15px] leading-tight font-semibold tracking-tight">{data.station}</div>
            <div className="num mt-0.5 text-[9px] tracking-[0.08em] text-muted uppercase">{data.frame}</div>
          </div>
          <div className={`rounded-lg border px-2.5 py-1.5 text-right ${data.accent}`}>
            <div className="text-[8px] tracking-[0.14em] uppercase opacity-80">{data.clockLabel}</div>
            <div className="mt-0.5">
              <Clock years={data.clockYears} size="text-[15px]" tone="" />
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-3 grid grid-cols-3 gap-2 rounded-xl border border-line/70 bg-void/80 px-3 py-2 backdrop-blur">
          <div>
            <div className="text-[8px] tracking-[0.14em] text-muted uppercase">Velocity</div>
            <div className="num text-[11px] text-ink">{formatPercentC(telemetry.percentC)} c</div>
            <div className="num text-[9px] text-muted">{formatNumber(telemetry.velocityMs, 0)} m/s</div>
          </div>
          <div>
            <div className="text-[8px] tracking-[0.14em] text-muted uppercase">{data.distanceLabel}</div>
            <div className="num text-[11px] text-ink">{data.distance}</div>
            <div className="num text-[9px] text-muted">light lag {formatGap(data.lightLag)}</div>
          </div>
          <div className="text-right">
            <div className="text-[8px] tracking-[0.14em] text-muted uppercase">Doppler</div>
            <div className="num text-[11px] text-ink">×{data.doppler.toFixed(3)}</div>
            <div className="num text-[9px] text-muted">{data.dopplerLabel}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CockpitOverlay({ telemetry, endPlanet }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(75%_75%_at_50%_50%,transparent_50%,rgba(3,5,9,0.55)_100%)]" />
      <div className="absolute top-1/2 left-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ion/20">
        <div className="absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ion/90 shadow-[0_0_12px_rgba(94,231,255,0.9)]" />
        <div className="absolute top-1/2 left-1/2 h-px w-20 -translate-x-1/2 -translate-y-1/2 bg-ion/25" />
        <div className="absolute top-1/2 left-1/2 h-20 w-px -translate-x-1/2 -translate-y-1/2 bg-ion/25" />
      </div>
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-center">
        <div className="num text-[9px] tracking-[0.18em] text-ion/70 uppercase">Forward · target {endPlanet?.name}</div>
        <div className="num mt-1 text-[11px] text-ink">
          {formatNumber(telemetry.remainingLy, 3)} ly to go · closing at {formatPercentC(telemetry.percentC)} c
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-void/80 to-transparent" />
    </div>
  )
}

function BirdOverlay({ telemetry, startPlanet, endPlanet }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute top-1/2 left-3 -translate-y-1/2 rounded-lg border border-ion/30 bg-void/75 px-2.5 py-2 backdrop-blur">
        <div className="text-[8px] tracking-[0.16em] text-ion/80 uppercase">A · start</div>
        <div className="text-[11px] font-medium text-ink">{startPlanet?.name}</div>
      </div>
      <div className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg border border-violet/30 bg-void/75 px-2.5 py-2 text-right backdrop-blur">
        <div className="text-[8px] tracking-[0.16em] text-violet/80 uppercase">B · destination</div>
        <div className="text-[11px] font-medium text-ink">{endPlanet?.name}</div>
      </div>
      <div className="absolute inset-x-6 bottom-4">
        <div className="flex items-center justify-between text-[8px] tracking-[0.16em] text-muted uppercase">
          <span>departure</span>
          <span className="num text-ion">{Math.round(telemetry.progress * 100)}% of route</span>
          <span>arrival</span>
        </div>
        <div className="relative mt-1.5 h-1 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-ion/70" style={{ width: `${telemetry.progress * 100}%` }} />
          <div
            className="absolute -top-1 h-3 w-3 -translate-x-1/2 rounded-full border border-void bg-ion shadow-[0_0_10px_rgba(94,231,255,0.9)]"
            style={{ left: `${telemetry.progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function LabViewer({
  split,
  view,
  telemetry,
  voyage,
  startPlanet,
  endPlanet,
  chaseDistance,
  playing,
  shipName,
}) {
  const arrived = telemetry.progress >= 1
  const statusText = arrived ? 'Arrived' : playing ? 'In flight' : telemetry.progress > 0 ? 'Paused' : 'On the pad'

  if (split) {
    return (
      <div className="space-y-2">
        <div className="grid gap-2 md:grid-cols-2">
          <SplitPanel side="A" telemetry={telemetry} startPlanet={startPlanet} endPlanet={endPlanet} />
          <SplitPanel side="B" telemetry={telemetry} startPlanet={startPlanet} endPlanet={endPlanet} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet/25 bg-violet/[0.05] px-3 py-2">
          <span className="flex items-center gap-2 text-[10px] tracking-[0.12em] text-muted uppercase">
            <span className="pulse-soft h-1.5 w-1.5 rounded-full bg-violet" />
            Synchronized · one simulation, two rest frames
          </span>
          <span className="num text-[10px] text-muted">
            T = {formatNumber(telemetry.t, 4)} yr · τ<sub>ship</sub> = {formatNumber(telemetry.shipClockYears, 4)} yr
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="panel relative overflow-hidden">
      <div className="relative h-[380px] sm:h-[460px] xl:h-[500px]">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_40%,#071019,#03050a_72%)]" />
        <div key={view} className="screen absolute inset-0">
          <LabScene
            view={view}
            telemetry={telemetry}
            startPlanet={startPlanet}
            endPlanet={endPlanet}
            chaseDistance={chaseDistance}
          />
        </div>

        {view === 'first' && <CockpitOverlay telemetry={telemetry} endPlanet={endPlanet} />}
        {view === 'bird' && (
          <BirdOverlay telemetry={telemetry} startPlanet={startPlanet} endPlanet={endPlanet} />
        )}

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <StatusDot playing={playing} arrived={arrived} />
              <span className="label text-[9px]">{VIEW_LABEL[view]}</span>
              <span className="rounded-full border border-line/70 bg-void/60 px-2 py-0.5 text-[9px] tracking-[0.1em] text-muted uppercase backdrop-blur">
                {statusText}
              </span>
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              {shipName} <span className="text-muted/70">→</span> {endPlanet?.name}
            </h2>
            <div className="num mt-0.5 text-[10px] text-muted">
              {startPlanet?.name} · {VIEW_DETAIL[view]}
            </div>
          </div>

          <div className="rounded-xl border border-line/70 bg-void/75 px-3 py-2 text-right backdrop-blur">
            <div className="text-[8px] tracking-[0.16em] text-muted uppercase">Ship proper clock</div>
            <div className="mt-1">
              <Clock years={telemetry.shipClockYears} tone="text-mint" size="text-[15px]" />
            </div>
            <div className="num mt-1 text-[9px] text-muted">
              γ {formatNumber(telemetry.gamma, 3)} · β {telemetry.beta.toFixed(4)}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="num rounded-full border border-line/70 bg-void/75 px-2.5 py-1 text-[10px] text-ink backdrop-blur">
              {formatPercentC(telemetry.percentC)} c
            </span>
            <span className="num rounded-full border border-line/70 bg-void/75 px-2.5 py-1 text-[10px] text-muted backdrop-blur">
              {formatNumber(telemetry.velocityMs, 0)} m/s
            </span>
            <span className="num rounded-full border border-line/70 bg-void/75 px-2.5 py-1 text-[10px] text-muted backdrop-blur">
              {(telemetry.gForce).toFixed(2)} g
            </span>
            <span className="num rounded-full border border-line/70 bg-void/75 px-2.5 py-1 text-[10px] text-muted backdrop-blur">
              {formatNumber(telemetry.distanceLy, 3)} / {formatNumber(voyage.distanceLy, 2)} ly
            </span>
          </div>
          <div className="num rounded-full border border-line/70 bg-void/75 px-2.5 py-1 text-[10px] text-muted backdrop-blur">
            {telemetry.phase}
          </div>
        </div>
      </div>
    </div>
  )
}
