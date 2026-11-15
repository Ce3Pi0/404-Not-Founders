import {
  formatChallengeYears,
  formatEnergyUnits,
  formatEnergy,
} from '../../lib/challenge/physics'
import { PHASE_LABEL, PHASE, STATUS } from '../../lib/challenge/engine'
import { formatNumber } from '../../lib/physics'
import RouteStops from './RouteStops'

function Stat({ label, value, tone = 'default' }) {
  const color = tone === 'accent' ? 'text-[#5ee7ff]' : tone === 'warn' ? 'text-[#ffb9a0]' : 'text-ink'
  return (
    <div>
      <div className="text-[7.5px] tracking-[0.14em] text-ink/45 uppercase">{label}</div>
      <div className={`num text-[11px] ${color}`}>{value}</div>
    </div>
  )
}

function Meter({ fraction, tone = 'default' }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/12">
      <div
        className={`h-full ${tone === 'low' ? 'bg-[#ff7a45]' : 'bg-ion'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/**
 * The expedition HUD. Every number comes from the one simulation state — the
 * same state that moves the spacecraft.
 */
export default function ExpeditionHud({ expedition, summary }) {
  const leg = expedition.route.legs[expedition.currentLegIndex] ?? null
  const energyFraction = summary.energyRemaining / Math.max(summary.energyBudget, 1e-9)
  const timeFraction = summary.earthTimeRemaining / Math.max(summary.earthTimeBudget, 1e-9)
  const legRemainingLy = leg ? Math.max(0, leg.distanceLy * (1 - expedition.legProgress)) : 0
  const journeyProgress =
    summary.distanceLy / Math.max(0.000001, summary.totalDistanceLy)
  const deadline = expedition.status === STATUS.FAILED && expedition.failure?.reason === 'time'

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between gap-2 p-2 sm:p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="rounded-xl border border-line/55 bg-void/88 px-3 py-2 backdrop-blur">
          <div className="text-[8px] tracking-[0.18em] text-[#5ee7ff] uppercase">
            Beyond Time — Expedition mode
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
            <Stat label="Current location" value={expedition.currentLocation.systemName} />
            <Stat label="Destination" value={leg ? leg.arrivalPlanetName : '—'} />
            <Stat
              label="Leg"
              value={`${Math.min(expedition.currentLegIndex + 1, expedition.route.legs.length)} / ${
                expedition.route.legs.length
              }`}
            />
            <Stat label="Phase" value={PHASE_LABEL[expedition.currentPhase] ?? '—'} />
          </div>
        </div>

        <div className="w-[214px] rounded-xl border border-line/55 bg-void/88 px-3 py-2 backdrop-blur sm:w-[240px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">
              Earth time remaining
            </span>
            <span
              className={`num text-[15px] leading-none ${
                deadline || summary.earthTimeRemaining === 0 ? 'text-[#ff9a70]' : 'text-ink'
              }`}
            >
              {formatNumber(summary.earthTimeRemaining, 2)}
            </span>
          </div>
          <div className="text-right text-[8px] text-ink/40">years</div>
          <Meter fraction={timeFraction} tone={timeFraction < 0.15 ? 'low' : 'default'} />

          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">
              Energy remaining
            </span>
            <span
              className={`num text-[15px] leading-none ${
                summary.energyRemaining === 0 ? 'text-[#ff9a70]' : 'text-ink'
              }`}
            >
              {formatEnergyUnits(summary.energyRemaining, 6)}
            </span>
          </div>
          <div className="text-right text-[8px] text-ink/40">mc²</div>
          <Meter fraction={energyFraction} tone={energyFraction < 0.15 ? 'low' : 'default'} />
        </div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="hidden max-w-[240px] rounded-xl border border-line/55 bg-void/88 px-3 py-2 backdrop-blur lg:block">
          <div className="text-[8px] tracking-[0.16em] text-ink/45 uppercase">Expedition route</div>
          <div className="mt-1">
            <RouteStops
              route={expedition.route}
              surveyedIds={expedition.surveyedPlanetIds}
              compact
              failedLegIndex={
                expedition.failure?.reason === 'time' ? expedition.failure.legIndex : null
              }
            />
          </div>
        </div>

        <div className="flex-1 rounded-xl border border-line/55 bg-void/88 px-3 py-2 backdrop-blur sm:mx-2 sm:max-w-[560px]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <Stat
              label={leg?.physicsMode === 'advanced' ? 'Peak velocity' : 'Velocity'}
              value={leg ? `${(leg.betaPeak ?? leg.beta).toFixed(3)} c` : '—'}
              tone="accent"
            />
            <Stat label="Lorentz factor γ" value={leg ? leg.gamma.toFixed(4) : '—'} />
            <Stat label="Distance remaining" value={`${formatNumber(legRemainingLy, 2)} ly`} />
            <Stat label="Ship proper time" value={formatChallengeYears(summary.shipYears)} />
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full bg-[#5ee7ff]"
                style={{ width: `${Math.min(100, journeyProgress * 100)}%` }}
              />
            </div>
            <span className="num text-[8.5px] text-ink/50">
              {formatNumber(Math.min(100, journeyProgress * 100), 1)}%
            </span>
          </div>
          {expedition.currentPhase !== PHASE.IDLE && (
            <div className="mt-1 flex items-center justify-between text-[8.5px] text-ink/45">
              <span>{PHASE_LABEL[expedition.currentPhase]}</span>
              <span className="num">
                Earth clock {formatChallengeYears(summary.earthYears)} · spent{' '}
                {formatEnergy(summary.energySpent, { digits: 6 })}
              </span>
            </div>
          )}
        </div>

        <div className="hidden w-[120px] rounded-xl border border-line/55 bg-void/88 px-2 py-2 text-right backdrop-blur sm:block">
          <div className="text-[7.5px] tracking-[0.14em] text-ink/45 uppercase">Surveyed</div>
          <div className="num text-[16px] leading-none text-[#5ee7ff]">{summary.surveyedCount}</div>
          <div className="mt-1 text-[7.5px] tracking-[0.14em] text-ink/45 uppercase">Systems</div>
          <div className="num text-[11px] text-ink">{summary.systemsVisited}</div>
        </div>
      </div>
    </div>
  )
}
