import { isSolarWorld } from '../../lib/catalog'
import { classifyPlanet, describeStar } from '../../lib/planet'
import { formatNumber } from '../../lib/physics'
import { formatAu } from '../../lib/planetSystem'

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
 * Inspector for the local system: the selected world's archive properties, or
 * a host-star summary when nothing is selected. Every value shown comes from
 * the NASA extract or a derived field that is labelled as derived.
 */
export default function SystemWorldPanel({
  entry,
  system,
  selectedPlanet,
  selectedBody,
  fromHere,
  originName,
  isCurrentWorld,
  onSelect,
  onViewPlanet,
  onPlanTravel,
}) {
  const look = selectedPlanet ? classifyPlanet(selectedPlanet) : null
  const star = entry?.planets?.[0] ? describeStar(entry.planets[0]) : null
  const orbitKnown = selectedPlanet?.semiMajorAxisAu != null

  return (
    <aside className="panel flex flex-col gap-3 p-4" data-testid="system-world">
      {selectedPlanet ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">
                {selectedPlanet.kind === 'earth'
                  ? 'Home world'
                  : isSolarWorld(selectedPlanet)
                    ? 'Solar System world'
                    : 'Exoplanet'}
              </div>
              <h2 className="mt-1 truncate text-lg leading-tight font-semibold">
                {selectedPlanet.name}
              </h2>
              <div className="mt-1 text-[11px] text-ink/60">{entry.name}</div>
            </div>
            <span
              className="shrink-0 rounded-full border border-line/60 px-2 py-0.5 text-[10px] text-ink/70"
              style={{ background: look?.palette?.[3] }}
            >
              {look?.label}
            </span>
          </div>

          {!orbitKnown && (
            <div className="rounded-lg border border-line/60 bg-void/60 px-2.5 py-2">
              <div className="text-[9px] tracking-[0.16em] text-ink/55 uppercase">
                Orbit not fully characterized
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-ink/60">
                The archive row has no semi-major axis for this world, so it is not placed on the
                rings and no orbital distance is implied.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Semi-major axis"
              value={orbitKnown ? formatAu(selectedPlanet.semiMajorAxisAu) : '—'}
            />
            <Stat
              label="Orbital period"
              value={
                selectedPlanet.orbitalPeriodDays == null
                  ? '—'
                  : `${formatNumber(selectedPlanet.orbitalPeriodDays, 2)} d`
              }
            />
            <Stat
              label="Radius"
              value={`${formatNumber(selectedPlanet.radiusEarth, 2)} R⊕`}
              note={selectedPlanet.bulkEstimated ? 'estimated bulk' : undefined}
            />
            <Stat
              label={selectedPlanet.eqTempK == null ? 'Mean temp' : 'Equilibrium'}
              value={
                selectedPlanet.eqTempK != null
                  ? `${formatNumber(selectedPlanet.eqTempK, 0)} K`
                  : selectedPlanet.meanTempK == null
                    ? '—'
                    : `${formatNumber(selectedPlanet.meanTempK, 0)} K`
              }
            />
            <Stat label="Host star" value={star?.spectral ?? '—'} />
            <Stat
              label={`From ${originName ?? 'here'}`}
              value={fromHere == null ? '—' : `${formatNumber(fromHere, 2)} ly`}
            />
          </div>

          {selectedBody && !selectedBody.periodDays && (
            <p className="text-[10px] leading-relaxed text-ink/55">
              Orbital period not reported, so this world is drawn at its semi-major axis but is not
              animated.
            </p>
          )}

          <div className="space-y-1.5">
            <button
              type="button"
              className="btn w-full py-2 text-[12px]"
              onClick={() => onViewPlanet(selectedPlanet)}
            >
              View Planet
            </button>
            <button
              type="button"
              className="btn btn-primary w-full py-2 text-[12px]"
              onClick={() => onPlanTravel(selectedPlanet)}
              disabled={isCurrentWorld}
            >
              {isCurrentWorld ? 'You are here' : 'Plan Travel'}
            </button>
          </div>

          <p className="text-[9px] leading-relaxed text-ink/40">
            {selectedPlanet.kind === 'earth'
              ? 'Earth is drawn from NASA Blue Marble imagery.'
              : 'Surface texture and colour are a visual interpretation generated from bulk estimates — not real imagery.'}{' '}
            Orbits are circular, at the archive's semi-major axis, with illustrative starting
            phases: not a present-day ephemeris.
          </p>
        </>
      ) : (
        <>
          <div>
            <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">Host star</div>
            <h2 className="mt-1 text-lg leading-tight font-semibold">{entry.name}</h2>
            <div className="mt-1 text-[11px] text-ink/60">
              {star?.spectral ?? 'Unclassified'} ·{' '}
              {star?.teff == null ? 'Teff unknown' : `${formatNumber(star.teff, 0)} K`}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat label="Known worlds" value={`${entry.planets.length}`} />
            <Stat label="On the rings" value={`${system?.placedCount ?? 0}`} />
            <Stat
              label="Mass"
              value={star?.radius == null ? '—' : `${formatNumber(entry.planets[0].starMassSun, 2)} M☉`}
              note="derived"
            />
            <Stat
              label="Radius"
              value={star?.radius == null ? '—' : `${formatNumber(star.radius, 2)} R☉`}
              note="derived"
            />
            <Stat
              label={`From ${originName ?? 'here'}`}
              value={fromHere == null ? '—' : `${formatNumber(fromHere, 2)} ly`}
            />
            {originName !== 'Earth' && (
              <Stat label="From Earth" value={`${formatNumber(entry.distanceLy, 2)} ly`} />
            )}
          </div>

          {system?.uncharted?.length > 0 && (
            <p className="rounded-lg border border-line/50 bg-void/50 px-2.5 py-2 text-[10px] leading-relaxed text-ink/55">
              {system.uncharted.length === 1 ? 'One world has' : `${system.uncharted.length} worlds have`}{' '}
              no semi-major axis in the archive, so {system.uncharted.length === 1 ? 'it is' : 'they are'}{' '}
              listed but not placed on the rings.
            </p>
          )}

          <p className="text-[10px] leading-relaxed text-ink/45">
            Click a planet, its label, or a name below to inspect it. Mass and radius of the host
            star are derived from the archive's orbit with Kepler's third law, not measured.
          </p>
        </>
      )}

      <div className="mt-auto border-t border-line/40 pt-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[9px] tracking-[0.16em] text-ink/45 uppercase">
            Worlds · {entry.planets.length}
          </span>
          <span className="text-[9px] text-ink/40">select one</span>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {entry.planets.map((planet) => {
            const active = selectedPlanet && planet.id === selectedPlanet.id
            const placed = planet.semiMajorAxisAu != null && planet.semiMajorAxisAu > 0
            return (
              <li key={planet.id}>
                <button
                  type="button"
                  onClick={() => onSelect(planet)}
                  aria-pressed={active}
                  className={`chip ${active ? 'border-cyan-300/70 bg-panel/60 text-white' : ''}`}
                  title={placed ? undefined : 'Orbit not fully characterized'}
                >
                  {planet.name}
                  {!placed && <span className="text-[9px] text-ink/45">· no orbit</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
