import { useEffect, useMemo, useRef, useState } from 'react'
import { defaultPlanetFor, MAPPED_ENTRIES, mapDistanceLy } from '../../lib/starMap'
import { formatNumber } from '../../lib/physics'

/**
 * Host-star picker for the Travel Planner. It searches every system with a
 * measured distance — including systems beyond the drawn 150-ly region — so
 * both ends of a route can be any NASA host star the archive can place.
 */
export default function SystemPickerDialog({
  mode,
  excludeSystem,
  distanceFrom,
  onSelect,
  onClose,
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const title = mode === 'departure' ? 'Change departure' : 'Change destination'

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const candidates = useMemo(
    () => MAPPED_ENTRIES.filter((entry) => entry.name !== excludeSystem),
    [excludeSystem],
  )

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const distance = (entry) =>
      distanceFrom ? (mapDistanceLy(entry, distanceFrom) ?? Infinity) : 0
    const list = needle
      ? candidates.filter(
          (entry) =>
            entry.name.toLowerCase().includes(needle) ||
            entry.planets.some((planet) => planet.name.toLowerCase().includes(needle)),
        )
      : [...candidates]
    return list
      .sort((a, b) => {
        if (needle) {
          const aStarts = a.name.toLowerCase().startsWith(needle) ? 0 : 1
          const bStarts = b.name.toLowerCase().startsWith(needle) ? 0 : 1
          if (aStarts !== bStarts) return aStarts - bStarts
        }
        return distance(a) - distance(b) || a.name.localeCompare(b.name)
      })
      .slice(0, 12)
  }, [candidates, query, distanceFrom])

  const choose = (entry) => {
    const planet = defaultPlanetFor(entry) ?? entry.planets[0]
    if (planet) onSelect(planet)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 p-4 backdrop-blur-sm"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="panel mt-[7vh] flex w-full max-w-lg flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line/50 px-4 py-3">
          <div>
            <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">Travel planner</div>
            <h2 className="mt-0.5 text-lg leading-tight font-semibold">{title}</h2>
          </div>
          <button type="button" className="btn px-2 py-1 text-[11px]" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="px-4 pt-3">
          <input
            ref={inputRef}
            type="search"
            className="field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search host stars or worlds"
            aria-label="Search host stars"
            data-testid="system-picker-input"
          />
        </div>

        <ul className="mt-2 max-h-[52vh] overflow-auto px-2 pb-3">
          {results.length === 0 && (
            <li className="px-2.5 py-3 text-[11px] text-ink/55">
              No host star with a measured distance matches that name.
            </li>
          )}
          {results.map((entry) => {
            const away = distanceFrom ? mapDistanceLy(entry, distanceFrom) : null
            return (
              <li key={entry.name}>
                <button
                  type="button"
                  onClick={() => choose(entry)}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-panel/45"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{entry.name}</span>
                    <span className="block text-[10px] text-ink/50">
                      {entry.planets.length} known world{entry.planets.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="num shrink-0 text-[10px] text-ink/55">
                    {away == null ? '—' : `${formatNumber(away, away < 1 ? 3 : 1)} ly`}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <p className="border-t border-line/40 px-4 py-2 text-[9px] leading-relaxed text-ink/40">
          Every host star with a distance in the NASA extract is listed, charted region or not.
          Choosing a system selects its innermost known world for the mission record.
        </p>
      </div>
    </div>
  )
}
