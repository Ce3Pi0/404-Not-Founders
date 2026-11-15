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
 * Floating card for one host-star system. Everything numeric comes from the
 * exact catalogue coordinates, never from the drawn scene positions.
 */
export default function SystemPanel({
  entry,
  activePlanet,
  originPlanet,
  originEntry,
  onPickPlanet,
  onSetDestination,
  onSetOrigin,
  onExplore,
  onClose,
}) {
  const solar = entryIsSolar(entry)
  const fromHere = mapDistanceLy(entry, originEntry)
  const coords = entry.mapPosition
    ? entry.mapPosition.map((value) => formatNumber(value, 2)).join(', ')
    : null
  const atOrigin = Boolean(activePlanet && originPlanet && activePlanet.id === originPlanet.id)

  return (
    <div
      data-testid="system-panel"
      className="panel pointer-events-auto flex min-h-0 flex-col gap-3 overflow-auto p-4"
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
          aria-label="Clear selection"
        >
          ×
        </button>
      </div>

      <div className="space-y-1.5 rounded-xl border border-line/50 bg-void/50 px-3 py-2.5">
        <Row
          label={`From ${originEntry?.name ?? 'current location'}`}
          value={fromHere == null ? '—' : `${formatNumber(fromHere, 3)} ly`}
        />
        <Row label="Known worlds" value={`${entry.planets.length}`} />
        {!solar && (
          <Row
            label="From Earth"
            value={`${formatNumber(entry.distanceLy, 3)} ly`}
          />
        )}
        <Row
          label="RA / Dec"
          value={`${formatNumber(entry.ra, 2)}° / ${formatNumber(entry.dec, 2)}°`}
        />
        <Row label="Map x, y, z" value={coords ? `${coords} ly` : 'not plotted'} />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[9px] tracking-[0.16em] text-ink/45 uppercase">Exoplanets</span>
          <span className="text-[9px] text-ink/40">select one</span>
        </div>
        <ul className="max-h-40 space-y-1 overflow-auto pr-1">
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
                      ? 'border-cyan-300/70 bg-panel/60'
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

      <div className="sticky bottom-0 -mx-4 -mb-4 space-y-1.5 rounded-b-2xl border-t border-line/40 bg-void/90 px-4 pt-2 pb-4 backdrop-blur">
        <button
          type="button"
          className="btn w-full border-cyan-300/50 py-2 text-[12px] hover:border-cyan-200/70"
          onClick={() => onExplore(entry)}
        >
          Explore System
        </button>
        <button
          type="button"
          className="btn btn-primary w-full py-2 text-[12px]"
          onClick={() => onSetDestination(activePlanet)}
          disabled={!activePlanet || atOrigin}
        >
          Plan Travel
        </button>
        <button
          type="button"
          className="w-full rounded-lg py-1 text-[10px] text-ink/50 transition hover:text-ink/85 disabled:opacity-40"
          onClick={() => onSetOrigin(activePlanet)}
          disabled={!activePlanet || atOrigin}
        >
          Depart from here instead
        </button>
      </div>
    </div>
  )
}
