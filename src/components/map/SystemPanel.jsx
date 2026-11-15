import { useState } from 'react'
import { classifyPlanet } from '../../lib/planet'
import { formatNumber } from '../../lib/physics'
import { entryIsSolar, mapDistanceLy } from '../../lib/starMap'

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[8px] tracking-[0.16em] text-white/35 uppercase">{label}</span>
      <span className="num text-right text-[10px] text-white/80">{value}</span>
    </div>
  )
}

/**
 * Drawer for one host-star system. Compact by default and collapsible to its
 * header, so inspecting a star never covers the map the user is flying.
 * Everything numeric comes from the exact catalogue coordinates, never from the
 * drawn scene positions.
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
  const [open, setOpen] = useState(true)
  const solar = entryIsSolar(entry)
  const fromHere = mapDistanceLy(entry, originEntry)
  const coords = entry.mapPosition
    ? entry.mapPosition.map((value) => formatNumber(value, 2)).join(', ')
    : null
  const atOrigin = Boolean(activePlanet && originPlanet && activePlanet.id === originPlanet.id)

  return (
    <div
      data-testid="system-panel"
      className="pointer-events-auto flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-white/12 bg-[#03060d]/88 text-white shadow-[0_24px_60px_-32px_#000] backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2">
        <div className="min-w-0">
          <div className="text-[8px] tracking-[0.2em] text-white/40 uppercase">
            {solar ? 'Home system' : 'Host-star system'}
          </div>
          <h2 className="truncate text-[15px] leading-tight font-semibold tracking-tight">
            {entry.name}
            {solar && <span className="ml-1.5 text-[10px] font-normal text-[#ffcf7a]/85">Home</span>}
          </h2>
          <div className="num mt-0.5 text-[10px] text-[#9fe9ff]/85">
            {fromHere == null
              ? '—'
              : fromHere < 0.001
                ? 'you are here'
                : `${formatNumber(fromHere, 3)} ly from ${originEntry?.name ?? 'location'}`}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="rounded-md px-1.5 py-0.5 text-[10px] text-white/45 transition hover:bg-white/10 hover:text-white"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? 'Collapse system details' : 'Expand system details'}
          >
            {open ? '▾' : '▸'}
          </button>
          <button
            type="button"
            className="rounded-md px-1.5 py-0.5 text-[12px] leading-none text-white/45 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Clear selection"
          >
            ×
          </button>
        </div>
      </div>

      {open && (
        <div className="flex min-h-0 flex-col gap-2.5 overflow-auto border-t border-white/[0.07] px-3 pt-2.5 pb-3">
          <div className="space-y-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2">
            <Row label="Known worlds" value={`${entry.planets.length}`} />
            {!solar && <Row label="From Earth" value={`${formatNumber(entry.distanceLy, 3)} ly`} />}
            <Row
              label="RA / Dec"
              value={`${formatNumber(entry.ra, 2)}° / ${formatNumber(entry.dec, 2)}°`}
            />
            <Row label="Map x, y, z" value={coords ? `${coords} ly` : 'not plotted'} />
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[8px] tracking-[0.16em] text-white/35 uppercase">
                Exoplanets
              </span>
              <span className="text-[8px] text-white/30">select one</span>
            </div>
            <ul className="max-h-32 space-y-0.5 overflow-auto pr-1">
              {entry.planets.map((planet) => {
                const look = classifyPlanet(planet)
                const active = activePlanet && planet.id === activePlanet.id
                return (
                  <li key={planet.id}>
                    <button
                      type="button"
                      onClick={() => onPickPlanet(planet)}
                      aria-pressed={active}
                      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left transition ${
                        active
                          ? 'border-[#5ee7ff]/55 bg-[#5ee7ff]/10'
                          : 'border-transparent hover:border-white/15 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: look.palette[2] }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-white/85">
                        {planet.name}
                      </span>
                      <span className="num shrink-0 text-[9px] text-white/40">
                        {planet.eqTempK == null ? '—' : `${formatNumber(planet.eqTempK, 0)} K`}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="space-y-1.5 border-t border-white/[0.07] pt-2">
            <button
              type="button"
              className="w-full rounded-lg border border-[#5ee7ff]/50 bg-[#5ee7ff]/10 py-1.5 text-[11px] text-[#c9f7ff] transition hover:border-[#5ee7ff]/80 hover:bg-[#5ee7ff]/15"
              onClick={() => onExplore(entry)}
            >
              Explore system
            </button>
            <button
              type="button"
              className="w-full rounded-lg border border-white/15 bg-white/[0.06] py-1.5 text-[11px] text-white/90 transition hover:border-white/35 hover:bg-white/[0.1] disabled:opacity-35"
              onClick={() => onSetDestination(activePlanet)}
              disabled={!activePlanet || atOrigin}
            >
              Plan travel
            </button>
            <button
              type="button"
              className="w-full rounded-md py-0.5 text-[9px] text-white/35 transition hover:text-white/75 disabled:opacity-30"
              onClick={() => onSetOrigin(activePlanet)}
              disabled={!activePlanet || atOrigin}
            >
              Depart from here instead
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
