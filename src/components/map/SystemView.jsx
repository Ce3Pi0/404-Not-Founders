import { useMemo, useState } from 'react'
import { classifyPlanet } from '../../lib/planet'
import { formatNumber } from '../../lib/physics'
import { entryIsSolar, mapDistanceLy, mapSystemFor } from '../../lib/starMap'

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-line/40 bg-void/45 px-2.5 py-2">
      <div className="text-[8px] tracking-[0.16em] text-ink/45 uppercase">{label}</div>
      <div className="num mt-0.5 text-[12px] text-ink/90">{value}</div>
    </div>
  )
}

/**
 * `/system/:id` — the destination of "Explore System". Shows the host star,
 * its distance from the current location and every known exoplanet. Back to
 * Universe returns to the map with its selection and framing intact.
 */
export default function SystemView({ entry, origin, initialPlanetId, onBack, onSetDestination }) {
  const originEntry = useMemo(() => mapSystemFor(origin), [origin])
  const [selectedId, setSelectedId] = useState(initialPlanetId ?? null)

  const selectedPlanet = useMemo(() => {
    if (!entry) return null
    return (
      entry.planets.find((planet) => planet.id === selectedId) ??
      entry.planets.find((planet) => planet.id === origin?.id) ??
      entry.planets[0] ??
      null
    )
  }, [entry, selectedId, origin])

  if (!entry) {
    return (
      <section className="screen panel flex flex-col items-start gap-3 p-6">
        <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">System</div>
        <h1 className="text-xl font-semibold">This system is not in the archive</h1>
        <p className="max-w-md text-[12px] text-ink/60">
          The address does not match a host star in the NASA extract.
        </p>
        <button type="button" className="btn px-3 py-1.5 text-[12px]" onClick={onBack}>
          ← Back to Universe
        </button>
      </section>
    )
  }

  const solar = entryIsSolar(entry)
  const distance = mapDistanceLy(entry, originEntry)
  const look = selectedPlanet ? classifyPlanet(selectedPlanet) : null

  return (
    <section className="screen grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <div className="panel p-5">
        <button
          type="button"
          className="btn px-3 py-1.5 text-[11px]"
          onClick={onBack}
          data-testid="back-to-universe"
        >
          ← Back to Universe
        </button>

        <div className="mt-4 text-[9px] tracking-[0.18em] text-ink/45 uppercase">
          {solar ? 'Home system' : 'Host-star system'}
        </div>
        <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          {entry.name}
        </h1>
        <p className="mt-1 text-[11px] text-ink/65">
          {formatNumber(entry.planets.length, 0)} known exoplanet
          {entry.planets.length === 1 ? '' : 's'} · NASA Exoplanet Archive
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat
            label={`From ${originEntry?.name ?? 'current location'}`}
            value={distance == null ? '—' : `${formatNumber(distance, 2)} ly`}
          />
          <Stat label="Known worlds" value={`${entry.planets.length}`} />
          <Stat
            label="From Earth"
            value={solar ? 'origin' : `${formatNumber(entry.distanceLy, 2)} ly`}
          />
          <Stat
            label="RA / Dec"
            value={`${formatNumber(entry.ra, 1)}° / ${formatNumber(entry.dec, 1)}°`}
          />
          <Stat
            label="Map x, y, z"
            value={
              entry.mapPosition
                ? entry.mapPosition.map((value) => formatNumber(value, 1)).join(', ')
                : 'not plotted'
            }
          />
          <Stat label="Current location" value={origin?.name ?? 'Earth'} />
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[9px] tracking-[0.16em] text-ink/45 uppercase">Exoplanets</span>
            <span className="text-[9px] text-ink/40">select one to inspect</span>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {entry.planets.map((planet) => {
              const active = selectedPlanet && planet.id === selectedPlanet.id
              return (
                <li key={planet.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(planet.id)}
                    aria-pressed={active}
                    className={`chip ${active ? 'border-cyan-300/70 bg-panel/60 text-white' : ''}`}
                  >
                    {planet.name}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {selectedPlanet && (
        <aside className="panel p-5" data-testid="system-world">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">
                {selectedPlanet.kind === 'earth' ? 'Home world' : 'Exoplanet'}
              </div>
              <h2 className="mt-1 truncate text-lg leading-tight font-semibold">
                {selectedPlanet.name}
              </h2>
              <div className="mt-1 text-[11px] text-ink/60">{entry.name}</div>
            </div>
            <span
              className="rounded-full border border-line/60 px-2 py-0.5 text-[10px] text-ink/70"
              style={{ background: look?.palette?.[3] }}
            >
              {look?.label}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat
              label="Orbit"
              value={
                selectedPlanet.semiMajorAxisAu == null
                  ? 'unknown'
                  : `${formatNumber(selectedPlanet.semiMajorAxisAu, 3)} AU`
              }
            />
            <Stat
              label="Period"
              value={
                selectedPlanet.orbitalPeriodDays == null
                  ? 'unknown'
                  : `${formatNumber(selectedPlanet.orbitalPeriodDays, 1)} d`
              }
            />
            <Stat
              label="Equilibrium"
              value={
                selectedPlanet.eqTempK == null
                  ? 'unknown'
                  : `${formatNumber(selectedPlanet.eqTempK, 0)} K`
              }
            />
            <Stat
              label="Radius"
              value={`${formatNumber(selectedPlanet.radiusEarth, 2)} R⊕`}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary mt-4 w-full py-2 text-[12px]"
            onClick={() => onSetDestination(selectedPlanet)}
          >
            Plan Travel
          </button>
          <p className="mt-2 text-[10px] leading-relaxed text-ink/40">
            Bulk properties are estimated from the archive's orbital columns; positions use the
            exact RA/Dec/distance frame.
          </p>
        </aside>
      )}
    </section>
  )
}
