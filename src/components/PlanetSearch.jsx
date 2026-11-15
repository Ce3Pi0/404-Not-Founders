import { useEffect, useRef, useState } from 'react'
import { classifyPlanet } from '../lib/planet'
import { formatNumber } from '../lib/physics'
import { searchPlanets } from '../lib/catalog'

/**
 * Searchable world picker used for both ends of a route. Passing an empty
 * query lists the supplied suggestions (nearest worlds to the relevant origin).
 */
export default function PlanetSearch({
  id,
  label,
  value,
  onSelect,
  suggestions,
  placeholder = 'Search 6,442 worlds — try “TRAPPIST”',
  distanceFor,
  distanceLabel = 'away',
  disabled = false,
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef(null)
  const inputRef = useRef(null)

  const searched = query.trim() ? searchPlanets(query, 20) : []
  const options = searched.length || query.trim() ? searched : suggestions.filter(Boolean)

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query])

  const choose = (next) => {
    onSelect(next)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((current) => Math.min(options.length - 1, current + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => Math.max(0, current - 1))
    } else if (event.key === 'Enter' && open && options[active]) {
      event.preventDefault()
      choose(options[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="label">{label}</span>
        {value && (
          <span className="num text-[10px] text-ink/55">
            {value.star}
            {distanceFor ? ` · ${formatNumber(distanceFor(value), 2)} ly ${distanceLabel}` : ''}
          </span>
        )}
      </div>

      <div ref={boxRef} className="relative">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink/45"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m16.5 16.5 4 4" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-listbox`}
            aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? `${id}-${options[active].id}` : undefined}
            className="field pr-9 pl-10"
            placeholder={placeholder}
            value={query}
            disabled={disabled}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-ink/60 transition hover:text-white"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
            >
              ×
            </button>
          )}
        </div>

        {open && (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-line/70 bg-void shadow-2xl">
            <div className="flex items-center justify-between border-b border-line/50 px-3 py-1.5">
              <span className="text-[9px] tracking-[0.16em] text-ink/50 uppercase">
                {query.trim() ? 'Matches' : 'Nearest worlds'}
              </span>
              <span className="num text-[10px] text-ink/50">{options.length}</span>
            </div>
            <ul id={`${id}-listbox`} role="listbox" className="max-h-64 overflow-auto p-1">
              {options.map((option, index) => {
                const look = classifyPlanet(option)
                return (
                  <li key={option.id}>
                    <button
                      id={`${id}-${option.id}`}
                      type="button"
                      role="option"
                      aria-selected={index === active}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(option)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                        index === active ? 'bg-panel/60' : 'hover:bg-panel/35'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: option.kind === 'earth' ? '#ffffff' : look.palette[2] }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-ink">{option.name}</span>
                        <span className="block truncate text-[10px] text-ink/55">
                          {option.star} · {option.kind === 'earth' ? 'Home world' : look.label}
                        </span>
                      </span>
                      {distanceFor && (
                        <span className="num shrink-0 text-[10px] text-ink/55">
                          {formatNumber(distanceFor(option), 2)} ly
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
              {options.length === 0 && (
                <li className="px-3 py-4 text-center text-[12px] text-ink/60">
                  No known world matches “{query}”.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
