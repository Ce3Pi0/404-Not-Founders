import { formatNumber } from '../../lib/physics'
import { departureProfile, formatSmallEnergy } from '../../lib/challenge/physics'
import { mapDistanceLy, SOLAR_SYSTEM } from '../../lib/starMap'

function Measured({ label, value, note }) {
  return (
    <div className="rounded-lg border border-line/40 bg-void/50 px-2 py-1">
      <div className="text-[7.5px] tracking-[0.14em] text-ink/45 uppercase">{label}</div>
      <div className="num text-[11px] text-ink/90">{value}</div>
      {note && <div className="text-[7.5px] text-ink/40">{note}</div>}
    </div>
  )
}

/** Catalogue facts only: a missing measurement stays missing. */
function PlanetRow({ planet, inRoute, onAdd, onRemove }) {
  const profile = departureProfile(planet)
  const mass = planet.massEarthMeasured
  const radius = planet.radiusEarthMeasured
  const escape = profile.cost

  return (
    <li className="rounded-xl border border-line/45 bg-void/45 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[11.5px] text-ink">{planet.name}</div>
          <div className="text-[8.5px] text-ink/45">
            {planet.star} · {planet.orbitalPeriodDays != null
              ? `P ${formatNumber(planet.orbitalPeriodDays, 1)} d`
              : 'period unknown'}
          </div>
        </div>
        <button
          type="button"
          className={`chip shrink-0 ${inRoute ? 'border-ion bg-ion/30 text-white' : ''}`}
          onClick={() => (inRoute ? onRemove(planet) : onAdd(planet))}
        >
          {inRoute ? 'In route' : 'Add to route'}
        </button>
      </div>

      <div className="mt-1.5 grid grid-cols-3 gap-1">
        <Measured
          label="Mass"
          value={mass != null ? `${formatNumber(mass, 2)} M⊕` : 'unmeasured'}
          note={mass != null ? planet.massSource : 'no archive value'}
        />
        <Measured
          label="Radius"
          value={radius != null ? `${formatNumber(radius, 2)} R⊕` : 'unmeasured'}
          note={radius != null ? 'archive value' : 'no archive value'}
        />
        <Measured
          label="Escape"
          value={escape != null ? formatSmallEnergy(escape) : 'n/a'}
          note={escape != null ? 'mc², from surface' : 'orbital only'}
        />
      </div>
      <div className="mt-1 text-[8.5px] leading-relaxed text-ink/45">
        {profile.surface
          ? `Surface departure modelled. ${planet.massIsMinimum ? 'Mass is a minimum estimate (M sin i).' : ''}`
          : `${profile.reason}. No surface escape energy is charged.`}
      </div>
    </li>
  )
}

/** System inspector for the challenge planner: pick the worlds to survey. */
export default function PlanetPickerPanel({ entry, planetIds, onAdd, onRemove, onClose }) {
  if (!entry) return null
  const selected = new Set(planetIds)
  const distance = mapDistanceLy(SOLAR_SYSTEM, entry)

  return (
    <div
      data-testid="challenge-system-panel"
      className="panel pointer-events-auto flex max-h-full w-full flex-col gap-2 overflow-auto bg-void/92 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[8px] tracking-[0.16em] text-ink/45 uppercase">Host-star system</div>
          <h2 className="truncate text-[15px] leading-tight font-semibold">{entry.name}</h2>
          <div className="text-[9px] text-ink/50">
            {entry.planets.length} catalogued {entry.planets.length === 1 ? 'world' : 'worlds'} ·{' '}
            {distance != null ? `${formatNumber(distance, 2)} ly from Earth` : 'distance unknown'}
          </div>
        </div>
        <button type="button" className="btn shrink-0 px-2 py-1 text-[11px]" onClick={onClose}>
          ×
        </button>
      </div>

      <ul className="space-y-1.5">
        {[...entry.planets]
          .sort(
            (a, b) =>
              (a.orbitalPeriodDays ?? Number.MAX_SAFE_INTEGER) -
              (b.orbitalPeriodDays ?? Number.MAX_SAFE_INTEGER),
          )
          .map((planet) => (
            <PlanetRow
              key={planet.id}
              planet={planet}
              inRoute={selected.has(planet.id)}
              onAdd={onAdd}
              onRemove={onRemove}
            />
          ))}
      </ul>

      <p className="text-[8.5px] leading-relaxed text-ink/40">
        A second world in the same system is surveyed locally — it never adds another interstellar
        leg. Values are the NASA Exoplanet Archive fields; missing mass or radius is shown as
        unmeasured, never estimated here.
      </p>
    </div>
  )
}
