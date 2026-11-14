import { useEffect, useRef, useState } from 'react'
import { NEAREST, RECOMMENDED, searchPlanets, noteFor } from '../lib/catalog'
import { classifyPlanet } from '../lib/planet'
import { formatNumber, surfaceGravity } from '../lib/physics'

const R_JUPITER = 11.21
const M_JUPITER = 317.8

function Fact({ label, value, sub }) {
  return (
    <div className="bg-panel/85 px-3.5 py-3">
      <div className="text-[9px] tracking-[0.16em] text-muted uppercase">{label}</div>
      <div className="num mt-1 text-[13px] text-ink">{value}</div>
      {sub && <div className="num mt-0.5 text-[10px] text-muted">{sub}</div>}
    </div>
  )
}

function PlanetFacts({ planet }) {
  const look = classifyPlanet(planet)
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
  const ax = planet.semiMajorAxisAu
  const note = noteFor(planet.name)

  return (
    <div className="space-y-3">
      {note && (
        <div className="flex items-start gap-2 rounded-xl border border-ion/25 bg-ion/[0.06] px-3 py-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ion" />
          <p className="text-[11px] leading-relaxed text-ink/85">{note}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line/70 bg-line/40 sm:grid-cols-3">
        <Fact
          label="Distance"
          value={`${formatNumber(planet.distanceLy, 2)} ly`}
          sub={`${formatNumber(planet.distancePc, 2)} pc`}
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
        <Fact label="Orbit" value={periodLabel} sub={ax != null ? `${formatNumber(ax, ax < 0.1 ? 4 : 3)} AU` : null} />
        <Fact
          label="Surface gravity"
          value={gravity != null ? `${formatNumber(gravity, 2)} g` : '—'}
          sub={planet.densityGcc != null ? `${formatNumber(planet.densityGcc, 2)} g/cm³` : null}
        />
        <Fact
          label="Host star"
          value={planet.star ?? '—'}
          sub={planet.spectralType ?? (planet.starTeffK ? `${formatNumber(planet.starTeffK, 0)} K` : null)}
        />
        <Fact
          label="Star radius"
          value={planet.starRadiusSun != null ? `${formatNumber(planet.starRadiusSun, 2)} R☉` : '—'}
          sub={planet.starsInSystem != null ? `${planet.starsInSystem} star${planet.starsInSystem > 1 ? 's' : ''}` : null}
        />
        <Fact
          label="Discovered"
          value={planet.discoveryYear ?? '—'}
          sub={planet.discoveryMethod ?? null}
        />
      </div>

      <div className="rounded-xl border border-line/70 bg-void/40 px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] tracking-[0.16em] text-muted uppercase">Appearance</span>
          <span className="rounded-full border border-line bg-white/[0.03] px-2 py-0.5 text-[10px] text-ink/80">
            {look.label}
          </span>
          <span className="text-[10px] text-muted">{look.composition}</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          {look.evidence}
          {look.source !== 'inferred' && (
            <span className="text-solar">
              {' '}
              * Colours are {look.source === 'random' ? 'randomized' : 'estimated'} for this world — see About.
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

export default function DestinationPicker({ planet, onSelect, onContinue }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef(null)
  const inputRef = useRef(null)

  const options = query.trim() ? searchPlanets(query) : NEAREST

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

  const choose = (nextPlanet) => {
    onSelect(nextPlanet)
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
    <div className="panel flex flex-col gap-4 p-5 sm:p-6">
      <div>
        <div className="label">Stage 1 — Discover</div>
        <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          Where should we go?
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Pick a real world from NASA's Exoplanet Archive. Distance and physical properties are
          measured — your spacecraft, and the clocks, are the experiment.
        </p>
      </div>

      <div ref={boxRef} className="relative">
        <label htmlFor="destination-search" className="sr-only">
          Search exoplanets by name or host star
        </label>
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
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
            id="destination-search"
            role="combobox"
            aria-expanded={open}
            aria-controls="destination-listbox"
            aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? `destination-${options[active].id}` : undefined}
            className="field pr-9 pl-10"
            placeholder="Search 100 worlds — try “TRAPPIST” or “Kepler”"
            value={query}
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
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-muted transition hover:bg-white/5 hover:text-ink"
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
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-line bg-deep/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-line/70 px-3 py-1.5">
              <span className="text-[9px] tracking-[0.16em] text-muted uppercase">
                {query.trim() ? 'Matches' : 'Closest to Earth'}
              </span>
              <span className="num text-[10px] text-muted">{options.length}</span>
            </div>
            <ul id="destination-listbox" role="listbox" className="max-h-72 overflow-auto p-1">
              {options.map((option, index) => {
                const optionLook = classifyPlanet(option)
                return (
                  <li key={option.id}>
                    <button
                      id={`destination-${option.id}`}
                      type="button"
                      role="option"
                      aria-selected={index === active}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(option)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                        index === active ? 'bg-ion/10' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: optionLook.palette[2] }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-ink">{option.name}</span>
                        <span className="block truncate text-[10px] text-muted">
                          {option.star ?? '—'} · {optionLook.label}
                        </span>
                      </span>
                      <span className="num shrink-0 text-[10px] text-muted">
                        {formatNumber(option.distanceLy, 2)} ly
                      </span>
                    </button>
                  </li>
                )
              })}
              {options.length === 0 && (
                <li className="px-3 py-4 text-center text-[12px] text-muted">
                  No known world matches “{query}”.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-[9px] tracking-[0.16em] text-muted uppercase">Recommended</div>
        <div className="flex flex-wrap gap-1.5">
          {RECOMMENDED.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`chip ${entry.name === planet.name ? 'border-ion/60 text-ion' : ''}`}
              onClick={() => choose(entry)}
            >
              {entry.name}
              <span className="num text-[10px] text-muted/80">{formatNumber(entry.distanceLy, 1)} ly</span>
            </button>
          ))}
        </div>
      </div>

      <PlanetFacts planet={planet} />

      <div className="mt-auto space-y-2">
        <button type="button" className="btn btn-primary w-full" onClick={() => onContinue(planet)}>
          Continue to flight plan →
        </button>
        <p className="text-center text-[10px] text-muted/80">
          Data: NASA Exoplanet Archive · Planetary Systems Composite Parameters
        </p>
      </div>
    </div>
  )
}
