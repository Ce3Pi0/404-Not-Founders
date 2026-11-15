import LaunchScene from './LaunchScene'
import { cameraLabel } from './CameraMenu'
import { formatNumber } from '../../lib/physics'
import {
  clockParts,
  formatDistanceKm,
  formatGap,
  formatPercentC,
  LY_M,
} from '../../lib/labPhysics'
import { ATMOSPHERE_M } from '../../lib/launchPhysics'

const VIEW_DETAIL = {
  first: 'Cockpit · forward view',
  second: 'Nearby tracking observer',
  third: 'Chase camera behind the ship',
  bird: "Top-down system map · drag to orbit, scroll to zoom",
}

function formatAltitude(metres) {
  if (!Number.isFinite(metres)) return '—'
  if (metres < 1000) return `${Math.round(metres)} m`
  if (metres < 1e7) return `${(metres / 1000).toPrecision(4)} km`
  return `${(metres / LY_M).toPrecision(3)} ly`
}

function formatThrust(newtons) {
  if (newtons <= 0) return '0 MN'
  return `${(newtons / 1e6).toFixed(2)} MN`
}

function Clock({ years, tone = 'text-ink', size = 'text-lg' }) {
  const parts = clockParts(years)
  return (
    <span className={`tabular-nums ${size} ${tone}`}>
      {parts.years}y {parts.days}d <span className="text-muted/90">{parts.hms}</span>
    </span>
  )
}

function StatusDot({ playing, arrived }) {
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full ${arrived ? 'bg-mint' : playing ? 'pulse-soft bg-ion' : 'bg-muted/60'}`}
    />
  )
}

function ProgressBar({ progress }) {
  return (
    <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-ion/60 to-mint"
        style={{ width: `${Math.min(100, progress * 100)}%` }}
      />
    </div>
  )
}

/* ----------------------------------------------------------------- overlays -- */

function CockpitOverlay({ telemetry }) {
  const speedPct = Math.min(100, telemetry.percentC)
  const gPct = Math.min(100, (telemetry.gForce / 6) * 100)
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(80%_80%_at_50%_50%,transparent_55%,rgba(3,5,9,0.6)_100%)]" />
      <div className="absolute top-1/2 left-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ion/20">
        <div className="absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ion/90 shadow-[0_0_12px_rgba(94,231,255,0.9)]" />
        <div className="absolute top-1/2 left-1/2 h-px w-20 -translate-x-1/2 -translate-y-1/2 bg-ion/25" />
        <div className="absolute top-1/2 left-1/2 h-20 w-px -translate-x-1/2 -translate-y-1/2 bg-ion/25" />
      </div>

      <div className="absolute inset-x-3 bottom-3 grid grid-cols-3 gap-2 rounded-xl border border-ion/25 bg-void/85 px-3 py-2 backdrop-blur">
        <div>
          <div className="text-[8px] tracking-[0.14em] text-muted uppercase">Velocity</div>
          <div className="text-[11px] text-ink">{formatPercentC(telemetry.percentC)} c</div>
          <div className="mt-1 h-1 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-ion/80" style={{ width: `${speedPct}%` }} />
          </div>
        </div>
        <div>
          <div className="text-[8px] tracking-[0.14em] text-muted uppercase">G-force</div>
          <div className="text-[11px] text-solar">{telemetry.gForce.toFixed(2)} g</div>
          <div className="mt-1 h-1 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-solar/80" style={{ width: `${gPct}%` }} />
          </div>
        </div>
        <div>
          <div className="text-[8px] tracking-[0.14em] text-muted uppercase">Fuel</div>
          <div className="text-[11px] text-mint">{Math.round(telemetry.fuelFraction * 100)}%</div>
          <div className="mt-1 h-1 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-mint/80" style={{ width: `${telemetry.fuelFraction * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function BirdOverlay({ telemetry, route }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute top-1/2 left-3 -translate-y-1/2 rounded-lg border border-ion/30 bg-void/75 px-2.5 py-2 backdrop-blur">
        <div className="text-[8px] tracking-[0.16em] text-ion/80 uppercase">A · launch site</div>
        <div className="text-[11px] font-medium text-ink">{route.startPlanet?.name}</div>
        <div className="text-[9px] text-muted">{formatAltitude(telemetry.altitudeM)}</div>
      </div>
      <div className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg border border-violet/30 bg-void/75 px-2.5 py-2 text-right backdrop-blur">
        <div className="text-[8px] tracking-[0.16em] text-violet/80 uppercase">B · destination</div>
        <div className="text-[11px] font-medium text-ink">{route.endPlanet?.name}</div>
        <div className="text-[9px] text-muted">{formatNumber(telemetry.remainingLy, 2)} ly to go</div>
      </div>
      <div className="absolute inset-x-6 bottom-4">
        <div className="flex items-center justify-between text-[8px] tracking-[0.16em] text-muted uppercase">
          <span>launch</span>
          <span className="text-ion">{Math.round(telemetry.fraction * 100)}% of route</span>
          <span>arrival</span>
        </div>
        <div className="relative mt-1.5 h-1 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-ion/70" style={{ width: `${telemetry.fraction * 100}%` }} />
          <div
            className="absolute -top-1 h-3 w-3 -translate-x-1/2 rounded-full border border-void bg-ion shadow-[0_0_10px_rgba(94,231,255,0.9)]"
            style={{ left: `${telemetry.fraction * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function SplitPanel({ side, view, onViewChange, telemetry, route, playing, chaseDistance, cameraAngle, thrustLevel, azimuthDeg }) {
  const isA = side === 'A'
  const data = isA
    ? {
      title: 'Point A · departure',
      station: route.startPlanet?.name ?? 'Launch planet',
      frame: 'Rest frame of the launch planet',
      clockYears: telemetry.aClockYears,
      distanceLabel: 'Distance travelled',
      distance: `${formatNumber(telemetry.travelledLy, 3)} ly`,
      sub: formatAltitude(telemetry.altitudeM),
      accent: 'border-ion/40 bg-ion/[0.07] text-ion',
      dot: 'bg-ion',
    }
    : {
      title: 'Point B · approach',
      station: route.endPlanet?.name ?? 'Destination',
      frame: 'Rest frame of the destination',
      clockYears: telemetry.bClockYears,
      distanceLabel: 'Remaining distance',
      distance: `${formatNumber(telemetry.remainingLy, 3)} ly`,
      sub: formatDistanceKm(telemetry.remainingLy),
      accent: 'border-violet/40 bg-violet/[0.07] text-violet',
      dot: 'bg-violet',
    }

  return (
    <div className="panel relative overflow-hidden">
      <div className="relative h-[300px] sm:h-[360px] xl:h-[400px]">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_35%,#071019,#03050a_72%)]" />
        <div className="absolute inset-0">
          <LaunchScene
            view={view}
            focus={side}
            telemetry={telemetry}
            route={route}
            chaseDistance={chaseDistance}
            cameraAngle={cameraAngle}
            thrustLevel={thrustLevel}
            azimuthDeg={azimuthDeg}
          />
        </div>

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${data.dot}`} />
              <span className="label text-[9px]">{data.title}</span>
            </div>
            <div className="mt-0.5 text-[15px] leading-tight font-semibold tracking-tight">{data.station}</div>
            <div className="mt-0.5 text-[9px] tracking-[0.08em] text-muted uppercase">{data.frame}</div>
          </div>
          <div className={`rounded-lg border px-2.5 py-1.5 text-right ${data.accent}`}>
            <div className="text-[8px] tracking-[0.14em] uppercase opacity-80">Local elapsed time</div>
            <div className="mt-0.5">
              <Clock years={data.clockYears} size="text-[15px]" tone="" />
            </div>
          </div>
        </div>

        <div className="absolute inset-x-3 bottom-3 space-y-2">
          <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-lg border border-line/70 bg-void/85 px-2.5 py-1.5 backdrop-blur">
            <span className="text-[9px] tracking-[0.12em] text-muted uppercase">Camera</span>
            <select
              value={view}
              aria-label={`Camera for Point ${side}`}
              onChange={(event) => onViewChange(event.target.value)}
              className="rounded-md border border-line bg-void/80 px-1.5 py-0.5 text-[10px] text-ink"
            >
              {['first', 'second', 'third', 'bird'].map((id) => (
                <option key={id} value={id}>
                  {cameraLabel(id)}
                </option>
              ))}
            </select>
          </div>
          <div className="pointer-events-none grid grid-cols-3 gap-2 rounded-xl border border-line/70 bg-void/80 px-3 py-2 backdrop-blur">
            <div>
              <div className="text-[8px] tracking-[0.14em] text-muted uppercase">Velocity</div>
              <div className="text-[11px] text-ink">{formatPercentC(telemetry.percentC)} c</div>
              <div className="text-[9px] text-muted">{formatNumber(telemetry.velocityMs, 0)} m/s</div>
            </div>
            <div>
              <div className="text-[8px] tracking-[0.14em] text-muted uppercase">{data.distanceLabel}</div>
              <div className="text-[11px] text-ink">{data.distance}</div>
              <div className="text-[9px] text-muted">{data.sub}</div>
            </div>
            <div className="text-right">
              <div className="text-[8px] tracking-[0.14em] text-muted uppercase">Ship clock</div>
              <div className="text-[11px] text-mint">{formatNumber(telemetry.shipClockYears, 3)} yr</div>
              <div className="text-[9px] text-muted">{formatNumber(telemetry.gamma, 3)}× γ</div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-3 top-[70px] flex justify-center">
          <span className="rounded-full border border-line/70 bg-void/70 px-2 py-0.5 text-[9px] tracking-[0.12em] text-muted uppercase">
            {telemetry.stageLabel}
          </span>
        </div>
      </div>
      {!playing && <div className="absolute inset-0 bg-void/10" />}
    </div>
  )
}

/* -------------------------------------------------------------------- viewer -- */

export default function LaunchViewer({
  split,
  view,
  viewA,
  viewB,
  onViewAChange,
  onViewBChange,
  telemetry,
  route,
  chaseDistance,
  cameraAngle,
  thrustLevel,
  azimuthDeg,
  playing,
  shipName,
}) {
  const arrived = telemetry.phase === 'complete' || telemetry.phase === 'arrival'
  const statusText =
    telemetry.phase === 'prelaunch'
      ? 'On the pad'
      : arrived
        ? 'Mission complete'
        : playing
          ? 'Live'
          : 'Paused'

  if (split) {
    return (
      <div className="space-y-2">
        <div className="grid gap-2 md:grid-cols-2">
          <SplitPanel
            side="A"
            view={viewA}
            onViewChange={onViewAChange}
            telemetry={telemetry}
            route={route}
            playing={playing}
            chaseDistance={chaseDistance}
            cameraAngle={cameraAngle}
            thrustLevel={thrustLevel}
            azimuthDeg={azimuthDeg}
          />
          <SplitPanel
            side="B"
            view={viewB}
            onViewChange={onViewBChange}
            telemetry={telemetry}
            route={route}
            playing={playing}
            chaseDistance={chaseDistance}
            cameraAngle={cameraAngle}
            thrustLevel={thrustLevel}
            azimuthDeg={azimuthDeg}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet/25 bg-violet/[0.05] px-3 py-2">
          <span className="flex items-center gap-2 text-[10px] tracking-[0.12em] text-muted uppercase">
            <span className="pulse-soft h-1.5 w-1.5 rounded-full bg-violet" />
            One simulation · two rest frames
          </span>
          <span className="text-[10px] text-muted">
            T = {formatNumber(telemetry.tYears, 4)} yr · τ<sub>ship</sub> ={' '}
            {formatNumber(telemetry.shipClockYears, 4)} yr · A−B {formatGap(telemetry.stationGapYears)}
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
          <LaunchScene
            view={view}
            focus="single"
            telemetry={telemetry}
            route={route}
            chaseDistance={chaseDistance}
            cameraAngle={cameraAngle}
            thrustLevel={thrustLevel}
            azimuthDeg={azimuthDeg}
          />
        </div>

        {view === 'first' && <CockpitOverlay telemetry={telemetry} />}
        {view === 'bird' && <BirdOverlay telemetry={telemetry} route={route} />}

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusDot playing={playing} arrived={arrived} />
              <span className="label text-[9px]">{cameraLabel(view)}</span>
              <span className="rounded-full border border-line/70 bg-void/60 px-2 py-0.5 text-[9px] tracking-[0.1em] text-muted uppercase backdrop-blur">
                {statusText}
              </span>
              <span className="rounded-full border border-ion/35 bg-ion/10 px-2 py-0.5 text-[9px] text-ion">
                {telemetry.stageLabel}
              </span>
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              {shipName} <span className="text-muted/70">→</span> {route.endPlanet?.name}
            </h2>
            <div className="mt-0.5 text-[10px] text-muted">
              {route.startPlanet?.name} · {VIEW_DETAIL[view]}
            </div>
          </div>

          <div className="rounded-xl border border-line/70 bg-void/75 px-3 py-2 text-right backdrop-blur">
            <div className="text-[8px] tracking-[0.16em] text-muted uppercase">Ship proper clock</div>
            <div className="mt-1">
              <Clock years={telemetry.shipClockYears} tone="text-mint" size="text-[15px]" />
            </div>
            <div className="mt-1 text-[9px] text-muted">
              γ {formatNumber(telemetry.gamma, 3)} · β {telemetry.beta.toFixed(4)}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-line/70 bg-void/75 px-2.5 py-1 text-[10px] text-ink backdrop-blur">
              {formatPercentC(telemetry.percentC)} c
            </span>
            <span className="rounded-full border border-line/70 bg-void/75 px-2.5 py-1 text-[10px] text-muted backdrop-blur">
              {formatNumber(telemetry.velocityMs, 0)} m/s
            </span>
            <span className="rounded-full border border-line/70 bg-void/75 px-2.5 py-1 text-[10px] text-muted backdrop-blur">
              {telemetry.gForce.toFixed(2)} g
            </span>
            <span className="rounded-full border border-line/70 bg-void/75 px-2.5 py-1 text-[10px] text-muted backdrop-blur">
              {formatAltitude(telemetry.altitudeM)}
              {telemetry.altitudeM < ATMOSPHERE_M ? ' · in atmosphere' : ' · above the atmosphere'}
            </span>
            <span className="rounded-full border border-line/70 bg-void/75 px-2.5 py-1 text-[10px] text-muted backdrop-blur">
              thrust {formatThrust(telemetry.thrustN)}
            </span>
          </div>
          <div className="min-w-[120px] flex-1 sm:max-w-[220px]">
            <div className="flex items-center justify-between text-[9px] tracking-[0.14em] text-muted uppercase">
              <span>mission</span>
              <span className="text-ion">{Math.round(telemetry.progress * 100)}%</span>
            </div>
            <div className="mt-1">
              <ProgressBar progress={telemetry.progress} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
