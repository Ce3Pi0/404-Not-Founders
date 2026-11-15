import { formatNumber } from '../../lib/physics'
import { EARTH_SYSTEM, systemDistanceLy } from '../../lib/challenge/route'
import { formatChallengeYears, SURVEY_YEARS } from '../../lib/challenge/physics'

function Dot({ tone }) {
  const color =
    tone === 'earth'
      ? 'bg-white'
      : tone === 'surveyed'
        ? 'bg-[#5ee7ff]'
        : tone === 'failed'
          ? 'bg-[#ff7a45]'
          : tone === 'current'
            ? 'bg-[#c084fc]'
            : 'bg-ion'
  return <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
}

/**
 * The one itinerary, rendered identically on the planner, the flight HUD and
 * the result report: Earth departure, the visited systems, Earth return.
 */
export default function RouteStops({
  route,
  surveyedIds = [],
  controls = false,
  onRemove,
  onMove,
  compact = false,
  failedLegIndex = null,
}) {
  if (!route) return null
  const surveyed = new Set(surveyedIds)
  const rows = []

  rows.push(
    <li key="earth-departure" className="flex items-start gap-2">
      <Dot tone="earth" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-ink">Earth</span>
          <span className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">Departure</span>
        </div>
      </div>
    </li>,
  )

  route.stops.forEach((stop, index) => {
    const distance = systemDistanceLy([0, 0, 0], stop.position)
    const allSurveyed = stop.planetIds.every((id) => surveyed.has(id))
    rows.push(
      <li key={`${stop.systemName}-${index}`} className="flex items-start gap-2">
        <Dot
          tone={
            failedLegIndex != null && index === failedLegIndex
              ? 'failed'
              : allSurveyed
                ? 'surveyed'
                : 'stop'
          }
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[11px] text-ink">
              <span className="num mr-1 text-ink/40">{index + 1}.</span>
              {stop.planetNames.join(' · ')}
            </span>
            <span className="shrink-0 text-[8px] tracking-[0.14em] text-ink/45 uppercase">
              Survey
            </span>
          </div>
          <div className="text-[9px] text-ink/45">
            {stop.systemName} · {formatNumber(distance, 2)} ly from Earth
            {!compact && ` · ${formatChallengeYears(SURVEY_YEARS)} each`}
          </div>
          {controls && (
            <div className="mt-1 flex gap-1">
              <button
                type="button"
                className="chip px-1.5 py-0 text-[9px]"
                onClick={() => onMove?.(stop.planetIds[0], -1)}
                aria-label={`Move ${stop.systemName} earlier`}
              >
                ↑
              </button>
              <button
                type="button"
                className="chip px-1.5 py-0 text-[9px]"
                onClick={() => onMove?.(stop.planetIds[0], 1)}
                aria-label={`Move ${stop.systemName} later`}
              >
                ↓
              </button>
              <button
                type="button"
                className="chip px-1.5 py-0 text-[9px] text-[#ff9a70]"
                onClick={() => stop.planetIds.forEach((id) => onRemove?.(id))}
                aria-label={`Remove ${stop.systemName}`}
              >
                remove
              </button>
            </div>
          )}
        </div>
      </li>,
    )
  })

  rows.push(
    <li key="earth-return" className="flex items-start gap-2">
      <Dot tone="earth" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-ink">Earth</span>
          <span className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">Return</span>
        </div>
        <div className="text-[9px] text-ink/45">
          Final leg · {EARTH_SYSTEM} · {route.plannedSurveys} planned surve
          {route.plannedSurveys === 1 ? 'y' : 'ys'} ·{' '}
          {formatChallengeYears(SURVEY_YEARS * route.plannedSurveys)}
        </div>
      </div>
    </li>,
  )

  return <ol className={`space-y-2 ${compact ? 'text-[10px]' : ''}`}>{rows}</ol>
}
