import PlanetPortrait from './PlanetPortrait'
import { isSolarWorld } from '../lib/catalog'
import { classifyPlanet, describeStar } from '../lib/planet'
import { formatNumber } from '../lib/physics'
import { formatAu } from '../lib/planetSystem'

function Stat({ label, value, note }) {
  return (
    <div className="rounded-lg border border-line/40 bg-void/45 px-2.5 py-2">
      <div className="text-[8px] tracking-[0.16em] text-ink/45 uppercase">{label}</div>
      <div className="num mt-0.5 text-[12px] text-ink/90">{value}</div>
      {note && <div className="mt-0.5 text-[9px] text-ink/40">{note}</div>}
    </div>
  )
}

/**
 * `/planet/:id` — the record for one world, opened from the Star System
 * Explorer's "View Planet". Values are the archive's orbital columns plus the
 * derived bulk estimates; surface art is a visual interpretation.
 */
export default function PlanetDetailView({
  planet,
  origin,
  distanceLy,
  onBack,
  onBackToSystem,
  onPlanTravel,
}) {
  const look = classifyPlanet(planet)
  const star = describeStar(planet)
  const isEarth = planet.kind === 'earth'
  const orbitKnown = planet.semiMajorAxisAu != null

  return (
    <section className="screen space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn px-3 py-1.5 text-[11px]" onClick={onBack} data-testid="back-to-universe">
              ← Back to Universe
            </button>
            {planet.star && (
              <button type="button" className="btn px-3 py-1.5 text-[11px]" onClick={onBackToSystem}>
                ← {planet.star} system
              </button>
            )}
          </div>
          <div className="mt-3 text-[9px] tracking-[0.18em] text-ink/45 uppercase">
            {isEarth ? 'Home world' : 'Planet record'}
          </div>
          <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            {planet.name}
          </h1>
          <p className="mt-1 text-[11px] text-ink/65">
            {star.name} · {star.spectral}
            {isEarth && ' · home world'}
            {!isEarth &&
              (isSolarWorld(planet)
                ? ` · ${formatAu(planet.semiMajorAxisAu)} from the Sun`
                : ` · ${formatNumber(planet.distanceLy, 2)} ly from Earth`)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn px-3 py-1.5 text-[11px]" onClick={onBack}>
            Close
          </button>
          <button type="button" className="btn btn-primary px-4 py-2 text-[12px]" onClick={() => onPlanTravel(planet)}>
            Plan Travel
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="panel relative overflow-hidden">
          <div className="relative h-[320px] sm:h-[380px]">
            <PlanetPortrait planet={planet} />
            <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
              <div className="rounded-full border border-line/70 bg-void/80 px-2.5 py-1 text-[10px] tracking-[0.16em] text-ink/75 uppercase">
                {look.label}
              </div>
              <div className="rounded-full border border-line/60 bg-void/80 px-2.5 py-1 text-[10px] text-ink/60">
                visual interpretation
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
              <span className="text-[9px] tracking-[0.18em] text-ink/35 uppercase">
                surface art generated from bulk estimates
              </span>
            </div>
          </div>
        </div>

        <div className="panel p-4">
          <div className="text-[9px] tracking-[0.16em] text-ink/45 uppercase">
            {planet.dataSource ?? 'NASA Exoplanet Archive'}
          </div>

          {!orbitKnown && (
            <div className="mt-2 rounded-lg border border-line/60 bg-void/60 px-2.5 py-2">
              <div className="text-[9px] tracking-[0.16em] text-ink/55 uppercase">
                Orbit not fully characterized
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-ink/60">
                This row has no semi-major axis in the extract, so no orbital distance or position
                is implied.
              </p>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Semi-major axis" value={orbitKnown ? formatAu(planet.semiMajorAxisAu) : '—'} />
            <Stat
              label="Orbital period"
              value={
                planet.orbitalPeriodDays == null
                  ? '—'
                  : `${formatNumber(planet.orbitalPeriodDays, 2)} d`
              }
            />
            <Stat
              label="Radius"
              value={`${formatNumber(planet.radiusEarth, 2)} R⊕`}
              note={planet.bulkEstimated ? 'estimated' : undefined}
            />
            <Stat
              label="Mass"
              value={`${formatNumber(planet.massEarth, 2)} M⊕`}
              note={planet.bulkEstimated ? 'estimated' : undefined}
            />
            <Stat
              label="Density"
              value={`${formatNumber(planet.densityGcc, 2)} g/cm³`}
              note={planet.bulkEstimated ? 'estimated' : undefined}
            />
            <Stat
              label={planet.eqTempK == null ? 'Mean temp' : 'Equilibrium'}
              value={
                planet.eqTempK != null
                  ? `${formatNumber(planet.eqTempK, 0)} K`
                  : planet.meanTempK == null
                    ? '—'
                    : `${formatNumber(planet.meanTempK, 0)} K`
              }
            />
            {planet.axialTiltDeg != null && (
              <Stat label="Axial tilt" value={`${formatNumber(planet.axialTiltDeg, 2)}°`} />
            )}
            {planet.surfaceGravityMs2 != null && (
              <Stat label="Surface gravity" value={`${formatNumber(planet.surfaceGravityMs2, 2)} m/s²`} />
            )}
            <Stat label="Host star" value={star.spectral} />
            <Stat
              label="Star temperature"
              value={star.teff == null ? '—' : `${formatNumber(star.teff, 0)} K`}
            />
            <Stat
              label={`From ${origin?.name ?? 'here'}`}
              value={`${formatNumber(distanceLy ?? 0, distanceLy < 1 ? 5 : 2)} ly`}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat
              label="RA / Dec"
              value={`${formatNumber(planet.ra, 2)}° / ${formatNumber(planet.dec, 2)}°`}
            />
            <Stat
              label="Composition"
              value={look.composition}
              note="visual interpretation"
            />
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-ink/45">
            {isSolarWorld(planet)
              ? 'Orbital and physical columns are the measured Solar System OpenData values. The surface texture is an artistic interpretation, and the orbital phase is illustrative — this page does not claim a present-day position.'
              : 'Orbital columns come from the NASA extract. Radius, mass, density and temperature are derived or estimated, and the surface texture is an artistic interpretation — this page does not claim a present-day position without orbital epoch and phase data.'}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary px-4 py-2 text-[12px]"
              onClick={() => onPlanTravel(planet)}
            >
              Plan Travel
            </button>
            <button type="button" className="btn px-4 py-2 text-[12px]" onClick={onBackToSystem}>
              Explore {planet.star}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
