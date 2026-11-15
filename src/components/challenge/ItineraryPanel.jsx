import { formatNumber } from '../../lib/physics'
import {
  BETA_MAX,
  BETA_MIN,
  formatChallengeYears,
  formatEnergyUnits,
  formatSmallEnergy,
} from '../../lib/challenge/physics'
import RouteStops from './RouteStops'

function LegCard({ leg, onSetSpeed }) {
  return (
    <div className="rounded-xl border border-line/45 bg-void/45 p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="truncate text-[10.5px] text-ink">
          <span className="text-ink/40">Leg {leg.index + 1}</span> · {leg.fromSystem}{' '}
          <span className="text-ink/35">→</span> {leg.toSystem}
        </div>
        <span className="num shrink-0 text-[10px] text-ink/60">
          {formatNumber(leg.distanceLy, leg.distanceLy < 1 ? 4 : 2)} ly
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="range"
          min={BETA_MIN}
          max={BETA_MAX}
          step="0.01"
          value={leg.beta}
          onChange={(event) => onSetSpeed(leg.key, event.target.value)}
          className="lab-slider w-full"
          aria-label={`Cruise speed for leg ${leg.index + 1}`}
          data-testid={`leg-slider-${leg.index}`}
        />
        <span className="num w-[52px] shrink-0 text-right text-[11px] text-[#5ee7ff]">
          {leg.beta.toFixed(2)}c
        </span>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] text-ink/55">
        <span>
          γ <span className="num text-ink/80">{leg.gamma.toFixed(4)}</span>
        </span>
        <span>
          Earth <span className="num text-ink/80">{formatChallengeYears(leg.earthYears)}</span>
        </span>
        <span>
          Escape{' '}
          <span className="num text-ink/80">
            {leg.gravityAvailable ? `${formatSmallEnergy(leg.gravityCost)}` : 'orbital'}
          </span>
        </span>
        <span>
          Ship <span className="num text-ink/80">{formatChallengeYears(leg.shipYears)}</span>
        </span>
        <span>
          Accel{' '}
          <span className="num text-ink/80">{formatEnergyUnits(leg.accelerationCost, 3)}</span>
        </span>
        <span>
          Brake <span className="num text-ink/80">{formatEnergyUnits(leg.brakingCost, 3)}</span>
        </span>
      </div>

      <div className="mt-1 flex items-baseline justify-between border-t border-line/35 pt-1 text-[9.5px]">
        <span className="text-ink/45">
          {leg.departureMode === 'surface'
            ? `Surface departure · ${leg.departurePlanetName}`
            : `Orbital departure · ${leg.departurePlanetName}`}
        </span>
        <span className="num text-ink">
          {formatEnergyUnits(leg.totalEnergyCost, 3)} mc²
        </span>
      </div>
    </div>
  )
}

/** Persistent left-hand itinerary: the route, then one speed control per leg. */
export default function ItineraryPanel({ route, onRemove, onMove, onSetSpeed, onClear }) {
  return (
    <aside className="panel flex max-h-[calc(70vh+96px)] flex-col gap-2 overflow-hidden p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[8px] tracking-[0.16em] text-ink/45 uppercase">Itinerary</div>
          <div className="text-[12px] text-ink">
            Earth <span className="text-ink/35">→</span> {route.stops.length} stop
            {route.stops.length === 1 ? '' : 's'} <span className="text-ink/35">→</span> Earth
          </div>
        </div>
        <button
          type="button"
          className="chip shrink-0"
          onClick={onClear}
          disabled={route.stops.length === 0}
        >
          Reset
        </button>
      </div>

      <div className="min-h-0 overflow-y-auto pr-0.5">
        {route.stops.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line/50 px-3 py-3 text-[10px] leading-relaxed text-ink/50">
            Click a star in the map, then add a planet. Earth stays at the start and the return is
            added automatically.
          </p>
        ) : (
          <RouteStops
            route={route}
            controls
            onRemove={onRemove}
            onMove={onMove}
            compact
          />
        )}

        {route.skipped.length > 0 && (
          <p className="mt-2 text-[9px] leading-relaxed text-[#ff9a70]">
            {route.skipped.length} selection(s) have no measured star distance and cannot be flown.
          </p>
        )}

        <div className="mt-3 space-y-2">
          <div className="text-[8px] tracking-[0.16em] text-ink/45 uppercase">
            Cruise velocity per leg
          </div>
          {route.legs.length === 0 ? (
            <p className="text-[10px] text-ink/45">Add a destination to create the first leg.</p>
          ) : (
            route.legs.map((leg) => (
              <LegCard key={leg.key} leg={leg} onSetSpeed={onSetSpeed} />
            ))
          )}
        </div>
      </div>
    </aside>
  )
}
