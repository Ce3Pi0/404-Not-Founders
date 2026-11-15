import { useEffect, useMemo, useRef, useState } from 'react'
import { formatNumber } from '../../lib/physics'
import { mapDistanceLy, searchMap } from '../../lib/starMap'

/**
 * Search over the drawn region's host stars and worlds. Every name comes from
 * the NASA archive extract; picking a result selects the system and flies the
 * camera to its exact 3D position.
 */
export default function MapSearch({ originEntry, onPick }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef(null)

  const results = useMemo(() => searchMap(query, 8), [query])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const choose = (result) => {
    if (!result) return
    onPick(result)
    setQuery('')
    setOpen(false)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((index) => Math.min(index + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(results[active])
    } else if (event.key === 'Escape') {
      setQuery('')
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="pointer-events-auto relative w-full" data-testid="map-search">
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search star systems or worlds"
        aria-label="Search star systems and worlds"
        data-testid="map-search-input"
        className="h-9 w-full rounded-xl border border-white/12 bg-[#03060d]/85 px-3 text-[12px] text-white outline-none backdrop-blur transition placeholder:text-white/35 focus:border-[#5ee7ff]/60"
      />

      {open && query.trim() !== '' && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-64 overflow-auto rounded-xl border border-white/12 bg-[#03060d]/96 p-1 shadow-[0_24px_50px_-28px_#000] backdrop-blur-xl">
          {results.length === 0 && (
            <p className="px-2.5 py-2 text-[11px] text-white/45">
              No host star or world by that name in the drawn region.
            </p>
          )}
          {results.map((result, index) => {
            const distance = mapDistanceLy(result.system, originEntry)
            return (
              <button
                key={`${result.type}-${result.system.name}-${result.name}`}
                type="button"
                onClick={() => choose(result)}
                onMouseEnter={() => setActive(index)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition ${
                  index === active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'
                }`}
              >
                <span
                  className={`shrink-0 rounded px-1 py-[1px] text-[8px] tracking-[0.12em] uppercase ${
                    result.type === 'system'
                      ? 'border border-[#5ee7ff]/40 text-[#bff3ff]/80'
                      : 'border border-white/15 text-white/45'
                  }`}
                >
                  {result.type === 'system' ? 'Star' : 'World'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-white/85">
                  {result.name}
                </span>
                <span className="num shrink-0 text-[10px] text-white/40">
                  {distance == null
                    ? '—'
                    : distance < 0.01
                      ? 'origin'
                      : `${formatNumber(distance, 1)} ly`}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
