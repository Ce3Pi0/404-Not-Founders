import { useMemo } from 'react'
import {
  EARTH,
  RECOMMENDED,
  distanceLyBetween,
  nearbyPlanets,
} from '../lib/catalog'
import { classifyPlanet, describeStar } from '../lib/planet'
import { formatNumber, formatYears, surfaceGravity } from '../lib/physics'
import PlanetSearch from './PlanetSearch'

const R_JUPITER = 11.21
const M_JUPITER = 317.8

function Fact({ label, value, sub }) {
  return (
    <div className="bg-panel/25 px-3.5 py-3">
      <div className="text-[9px] tracking-[0.16em] text-ink/50 uppercase">{label}</div>
      <div className="mt-1 text-[13px] text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-ink/50">{sub}</div>}
    </div>
  )
}

function PlanetFacts({ planet, origin, distanceLy }) {
  const look = classifyPlanet(planet)
  const star = describeStar(planet)
  const gravity = surfaceGravity(planet.massEarth, planet.radiusEarth)
  const radiusJupiter = planet.radiusEarth != null ? planet.radiusEarth / R_JUPITER : null
  const massJupiter = planet.massEarth != null ? planet.massEarth / M_JUPITER : null
  const period = planet.orbitalPeriodDays
  const periodLabel =
    period == null
      ? '—'
      : period < 400
        ? `${formatNumber(period, period < 10 ? 2 : 1)} days`
        : `${formatNumber(period / 365.25, 2)} yr`

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line/50 bg-line/30 sm:grid-cols-3">
        <Fact
          label="From here"
          value={`${formatNumber(distanceLy, distanceLy < 1 ? 4 : 2)} ly`}
          sub={`${formatNumber(distanceLy / 3.26156, 3)} pc`}
        />
        <Fact
          label="From Earth"
          value={planet.kind === 'earth' ? 'origin' : `${formatNumber(planet.distanceLy, 2)} ly`}
          sub={planet.kind === 'earth' ? null : `${formatNumber(planet.distancePc, 2)} pc`}
        />
        <Fact
          label="Light travel"
          value={formatYears(distanceLy)}
          sub="at c, one-way"
        />
        <Fact
          label="Radius"
          value={planet.radiusEarth != null ? `${formatNumber(planet.radiusEarth, 2)} R⊕` : '—'}
          sub={radiusJupiter != null ? `${formatNumber(radiusJupiter, 2)} R♃` : null}
        />
        <Fact
          label="Mass"
          value={planet.massEarth != null ? `${formatNumber(planet.massEarth, 2)} M⊕` : '—'}
          sub={massJupiter != null && massJupiter > 0.05 ? `${formatNumber(massJupiter, 2)} M♃` : null}
        />
        <Fact
          label="Equilibrium temp"
          value={planet.eqTempK != null ? `${formatNumber(planet.eqTempK, 0)} K` : '—'}
          sub={planet.eqTempK != null ? `${formatNumber(planet.eqTempK - 273.15, 0)} °C` : 'not reported'}
        />
        <Fact
          label="Orbital period"
          value={periodLabel}
          sub={
            planet.semiMajorAxisAu != null
              ? `${formatNumber(planet.semiMajorAxisAu, planet.semiMajorAxisAu < 0.1 ? 4 : 3)} AU`
              : null
          }
        />
        <Fact
          label="Surface gravity"
          value={gravity != null ? `${formatNumber(gravity, 2)} g` : '—'}
          sub={planet.densityGcc != null ? `${formatNumber(planet.densityGcc, 2)} g/cm³` : null}
        />
        <Fact
          label="Host star"
          value={planet.kind === 'earth' ? 'Sol' : planet.star}
          sub={`${star.spectral} · ${formatNumber(star.teff, 0)} K`}
        />
      </div>

      <div className="rounded-xl border border-line/50 bg-void/50 px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] tracking-[0.16em] text-ink/50 uppercase">Appearance</span>
          <span className="rounded-full border border-line/60 bg-panel/40 px-2 py-0.5 text-[10px] text-ink/85">
            {look.label}
          </span>
          <span className="text-[10px] text-ink/55">{look.composition}</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink/55">
          {look.evidence}
          <span className="text-ink/80">
            {' '}
            Bulk properties and colours are estimates — the CSV archive supplies orbits and
            positions only.
          </span>
        </p>
      </div>
    </div>
  )
}

export default function DestinationPicker({
  origin,
  planet,
  distanceLy,
  onOriginChange,
  onSelect,
  onContinue,
  onGoHome,
}) {
  const departureSuggestions = useMemo(
    () => [EARTH, ...nearbyPlanets(EARTH, 6).filter((entry) => entry.id !== origin.id)],
    [origin.id],
  )
  const destinationSuggestions = useMemo(
    () => nearbyPlanets(origin, 8).filter((entry) => entry.id !== planet.id),
    [origin.id, planet.id],
  )

  const chooseDestination = (next) => {
    if (next.id === origin.id) return
    onSelect(next)
  }

  const chooseOrigin = (next) => {
    onOriginChange(next)
    if (next.id === planet.id) {
      const replacement = nearbyPlanets(next, 6).find((entry) => entry.id !== next.id)
      if (replacement) onSelect(replacement)
    }
  }

  return (
    <div className="panel flex flex-col gap-4 p-5 sm:p-6">
      <div>
        <div className="label">Stage 1 — Plot the route</div>
        <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          Travel from anywhere to anywhere
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink/65">
          Every world in the archive can be a departure point or a destination. Chain routes —
          Earth → an exoplanet → another system → home — and the distance is measured between the
          two systems' real coordinates.
        </p>
      </div>

      <div className="space-y-3">
        <PlanetSearch
          id="departure-search"
          label="Departing from"
          value={origin}
          onSelect={chooseOrigin}
          suggestions={departureSuggestions}
          distanceFor={(entry) => distanceLyBetween(EARTH, entry)}
          distanceLabel="from Earth"
          placeholder="Search any system to depart from"
        />
        <PlanetSearch
          id="destination-search"
          label="Destination"
          value={planet}
          onSelect={chooseDestination}
          suggestions={destinationSuggestions}
          distanceFor={(entry) => distanceLyBetween(origin, entry)}
          distanceLabel="from here"
          placeholder="Search 6,442 archived worlds"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/60 bg-void/50 px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="text-[9px] tracking-[0.16em] text-ink/50 uppercase">Route</div>
          <div className="truncate text-[12px] text-ink">
            {origin.name} <span className="text-ink/45">→</span> {planet.name}
          </div>
        </div>
        <div className="text-right text-[12px] text-ink">
          {formatNumber(distanceLy, distanceLy < 1 ? 5 : 2)} ly
        </div>
      </div>

      <div>
        <div className="mb-2 text-[9px] tracking-[0.16em] text-ink/50 uppercase">Recommended</div>
        <div className="flex flex-wrap gap-1.5">
          {RECOMMENDED.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`chip ${entry.id === planet.id ? 'border-ion text-white' : ''}`}
              onClick={() => chooseDestination(entry)}
            >
              {entry.name}
              <span className="text-[10px] text-ink/55">{formatNumber(entry.distanceLy, 1)} ly</span>
            </button>
          ))}
        </div>
      </div>

      <PlanetFacts planet={planet} origin={origin} distanceLy={distanceLy} />

      <div className="mt-auto space-y-2">
        <button type="button" className="btn btn-primary w-full" onClick={() => onContinue(planet)}>
          Continue to flight plan →
        </button>
        {origin.kind !== 'earth' && onGoHome && (
          <button type="button" className="btn w-full" onClick={onGoHome}>
            ← Go home to Earth
          </button>
        )}
        <p className="text-center text-[10px] text-ink/45">
          Data: NASA Exoplanet Archive extract · {formatNumber(6442, 0)} planets · positions at RA/Dec
        </p>
      </div>
    </div>
  )
}
