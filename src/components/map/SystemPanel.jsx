import { classifyPlanet } from '../../lib/planet'
import { formatNumber } from '../../lib/physics'
import { entryIsSolar, mapDistanceLy } from '../../lib/starMap'

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[9px] tracking-[0.16em] text-ink/45 uppercase">{label}</span>
      <span className="num text-right text-[11px] text-ink/85">{value}</span>
    </div>
  )
}

/**
 * Details for one host-star system. Everything numeric comes from the exact
 * catalogue coordinates, never from the drawn scene positions.
 */
export default function SystemPanel({
  entry,
  activePlanet,
  originPlanet,
  originEntry,
  onPickPlanet,
  onSetDestination,
  onSetOrigin,
  onClose,
}) {
  const solar = entryIsSolar(entry)
  const fromHere = mapDistanceLy(entry, originEntry)
  const coords = entry.mapPosition.map((value) => formatNumber(value, 2)).join(', ')
  const atOrigin = Boolean(activePlanet && originPlanet && activePlanet.id === originPlanet.id)

  return (
    <div
      data-testid="system-panel"
      className="panel pointer-events-auto flex max-h-full flex-col gap-3 overflow-auto p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">
            {solar ? 'Home system' : 'Host-star system'}
          </div>
          <h2 className="truncate text-lg leading-tight font-semibold">{entry.name}</h2>
        </div>
        <button
          type="button"
          className="btn shrink-0 px-2 py-1 text-[11px]"
          onClick={onClose}
          aria-label="Close system details"
        >
          ×
        </button>
      </div>

      <div className="space-y-1.5 rounded-xl border border-line/50 bg-void/50 px-3 py-2.5">
        <Row
          label="From Earth"
          value={solar ? 'origin' : `${formatNumber(entry.distanceLy, 3)} ly`}
        />
        <Row
          label="From here"
          value={fromHere == null ? '—' : `${formatNumber(fromHere, 3)} ly`}
        />
        <Row label="RA / Dec" value={`${formatNumber(entry.ra, 2)}° / ${formatNumber(entry.dec, 2)}°`} />
        <Row label="Map x, y, z" value={`${coords} ly`} />
        <Row label="Worlds" value={`${entry.planets.length}`} />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[9px] tracking-[0.16em] text-ink/45 uppercase">Worlds</span>
          <span className="text-[9px] text-ink/40">select one to route</span>
        </div>
        <ul className="max-h-44 space-y-1 overflow-auto pr-1">
          {entry.planets.map((planet) => {
            const look = classifyPlanet(planet)
            const active = activePlanet && planet.id === activePlanet.id
            return (
              <li key={planet.id}>
                <button
                  type="button"
                  onClick={() => onPickPlanet(planet)}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                    active
                      ? 'border-ion bg-panel/60'
                      : 'border-transparent hover:border-line/60 hover:bg-panel/35'
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: look.palette[2] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{planet.name}</span>
                  <span className="shrink-0 text-[10px] text-ink/50">
                    {planet.eqTempK == null ? '—' : `${formatNumber(planet.eqTempK, 0)} K`}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="space-y-1.5">
        <button
          type="button"
          className="btn btn-primary w-full py-2 text-[12px]"
          onClick={() => onSetDestination(activePlanet)}
          disabled={!activePlanet || atOrigin}
        >
          Set as destination
        </button>
        <button
          type="button"
          className="btn w-full py-2 text-[12px]"
          onClick={() => onSetOrigin(activePlanet)}
          disabled={!activePlanet || atOrigin}
        >
          Depart from here
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-ink/40">
        Positions are NASA RA/Dec/distance converted to a Y-up light-year frame. Scene scale is
        linear, 1 unit = 1 ly — travel times still use the catalogue vectors.
      </p>
    </div>
  )
}
