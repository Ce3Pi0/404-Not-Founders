import {
  formatChallengeYears,
  formatEnergyUnits,
} from '../../lib/challenge/physics'
import { formatNumber } from '../../lib/physics'

function Row({ label, value, tone = 'default', big = false }) {
  const color =
    tone === 'over' ? 'text-[#ff9a70]' : tone === 'accent' ? 'text-[#5ee7ff]' : 'text-ink'
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[8.5px] tracking-[0.14em] text-ink/45 uppercase">{label}</span>
      <span className={`num text-right ${big ? 'text-[14px]' : 'text-[11px]'} ${color}`}>
        {value}
      </span>
    </div>
  )
}

function Bar({ value, tone = 'default' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  const color = tone === 'over' ? 'bg-[#ff7a45]' : 'bg-ion'
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Live forecast for the whole expedition. Warnings never block the launch. */
export default function ProjectionPanel({
  route,
  energyBudget,
  earthTimeBudget,
  onLaunch,
  onFrameRoute,
}) {
  const energyLeft = energyBudget - route.totalEnergy
  const timeLeft = earthTimeBudget - route.totalEarthYears
  const energyOver = energyLeft < 0
  const timeOver = timeLeft < 0
  const ready = route.valid

  return (
    <aside className="panel flex flex-col gap-3 p-3">
      <div>
        <div className="text-[8px] tracking-[0.16em] text-ink/45 uppercase">
          Projected resources
        </div>
        <div className="text-[12px] text-ink">Forecast for the whole expedition</div>
      </div>

      <div className="rounded-xl border border-line/45 bg-void/50 px-3 py-2 text-[9.5px] leading-relaxed text-ink/55">
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">Physics mode</span>
          <span className="text-ink/85">
            {route.physicsMode === 'advanced' ? 'ADVANCED SR' : 'SIMPLE SR'}
          </span>
        </div>
        <p className="mt-1">
          {route.physicsMode === 'advanced'
            ? `Every leg accelerates, cruises when the distance allows and brakes at ${formatNumber(
                route.advancedConfig?.accelMs ?? 0,
                2,
              )} m/s² proper acceleration. Times and burn energy use the speed each leg actually reaches.`
            : 'Every leg cruises at its selected speed; acceleration and braking are instantaneous.'}
        </p>
        {route.physicsMode === 'advanced' && route.legs.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {route.legs.map((leg) => (
              <li key={leg.key} className="flex justify-between gap-2">
                <span className="truncate text-ink/45">
                  {leg.fromSystem} → {leg.toSystem}
                </span>
                <span className="num shrink-0 text-ink/80">
                  {(leg.betaPeak ?? leg.beta).toFixed(3)} c
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[8.5px] text-ink/35">
          Change the mode or parameters in Flight Plan; they apply here too.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-line/45 bg-void/50 px-3 py-2.5">
        <Row label="Energy budget" value={`${formatEnergyUnits(energyBudget, 3)} mc²`} />
        <Row
          label="Predicted required"
          value={`${formatEnergyUnits(route.totalEnergy, 3)} mc²`}
        />
        <Row
          label="Projected energy left"
          value={`${formatEnergyUnits(energyLeft, 3)} mc²`}
          tone={energyOver ? 'over' : 'accent'}
          big
        />
        <Bar value={route.totalEnergy / Math.max(energyBudget, 1e-9)} tone={energyOver ? 'over' : 'default'} />
      </div>

      <div className="space-y-2 rounded-xl border border-line/45 bg-void/50 px-3 py-2.5">
        <Row label="Earth-time budget" value={`${formatNumber(earthTimeBudget, 0)} yr`} />
        <Row
          label="Predicted required"
          value={formatChallengeYears(route.totalEarthYears)}
        />
        <Row
          label="Projected time left"
          value={formatChallengeYears(timeLeft)}
          tone={timeOver ? 'over' : 'accent'}
          big
        />
        <Bar value={route.totalEarthYears / Math.max(earthTimeBudget, 1e-9)} tone={timeOver ? 'over' : 'default'} />
      </div>

      <div className="space-y-1.5 rounded-xl border border-line/45 bg-void/50 px-3 py-2.5">
        <Row label="Astronaut elapsed time" value={formatChallengeYears(route.totalShipYears)} />
        <Row label="Planets selected" value={String(route.plannedSurveys)} />
        <Row label="Star systems" value={String(route.stops.length)} />
        <Row label="Total distance" value={`${formatNumber(route.totalDistanceLy, 2)} ly`} />
        <Row label="Survey time" value={formatChallengeYears(route.surveyYears)} />
      </div>

      {(energyOver || timeOver) && ready && (
        <div className="rounded-xl border border-[#ff7a45]/60 bg-[#ff7a45]/10 px-3 py-2 text-[9.5px] leading-relaxed text-[#ffb9a0]">
          Forecast warning: this route is projected to exceed{' '}
          {energyOver && timeOver ? 'both budgets' : energyOver ? 'the energy budget' : 'the Earth-time budget'}.
          Launch is still allowed — the expedition will fail during execution if the projection
          holds.
        </div>
      )}

      <div className="mt-auto space-y-2">
        <button
          type="button"
          className="btn btn-primary w-full py-2.5 text-[12px] tracking-[0.12em] uppercase"
          onClick={onLaunch}
          disabled={!ready}
          data-testid="launch-expedition"
        >
          Launch expedition
        </button>
        {!ready && (
          <p className="text-[9.5px] leading-relaxed text-ink/50">
            Add at least one planet. Only a complete, structurally valid route can launch — the
            budgets never block it.
          </p>
        )}
        <button type="button" className="btn w-full py-1.5 text-[10.5px]" onClick={onFrameRoute}>
          Frame the route in 3D
        </button>
      </div>
    </aside>
  )
}
