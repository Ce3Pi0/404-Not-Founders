import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import UniverseScene from './UniverseScene'
import SystemPanel from './SystemPanel'
import MapSearch from './MapSearch'
import OrientationGizmo from './OrientationGizmo'
import { UNMAPPED_SYSTEM_COUNT, distanceLyBetween } from '../../lib/catalog'
import { formatNumber } from '../../lib/physics'
import {
  BEYOND_REGION_COUNT,
  LABEL_LIMIT,
  MAP_REGION_LY,
  PICK_TARGETS,
  REGION_SYSTEMS,
  REGION_SYSTEM_COUNT,
  SOLAR_SYSTEM,
  defaultPlanetFor,
  entryIsSolar,
  labelSystems,
  mapSystemFor,
  mapSystemNamed,
} from '../../lib/starMap'

/**
 * Interactive 3D universe map of the nearest 150 light-years.
 *
 * Every point is a unique host-star system at its exact catalogue position.
 * Selection feeds back into the mission's existing origin/destination state,
 * while `viewState` remembers the inspected star and the camera framing so the
 * system page's Back control returns to exactly what was left behind.
 */
export default function StarMapView({
  origin,
  planet,
  viewState,
  onSetDestination,
  onSetOrigin,
  onExit,
  onExplore,
  onStartChallenge,
}) {
  const [selected, setSelected] = useState(() =>
    mapSystemNamed(viewState?.current?.selected ?? null),
  )
  const [hovered, setHovered] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [focus, setFocus] = useState(null)

  const labelsRef = useRef(null)
  const scaleBarRef = useRef(null)
  const scaleTextRef = useRef(null)
  const cameraQuaternionRef = useRef(new THREE.Quaternion())
  const focusKey = useRef(0)
  const exploreTimer = useRef(null)

  useEffect(() => () => clearTimeout(exploreTimer.current), [])

  const cameraState = viewState?.current?.camera ?? null
  const originEntry = useMemo(() => mapSystemFor(origin), [origin])
  const destinationEntry = useMemo(() => mapSystemFor(planet), [planet])

  const labels = useMemo(
    () =>
      labelSystems({
        selected,
        hovered,
        origin: originEntry,
        destination: destinationEntry,
      }),
    [selected, hovered, originEntry, destinationEntry],
  )

  const route = useMemo(() => {
    if (!originEntry || !destinationEntry) return null
    if (originEntry.name === destinationEntry.name) return null
    return { from: originEntry.renderPosition, to: destinationEntry.renderPosition }
  }, [originEntry, destinationEntry])

  /** Distance line from the current location to the inspected system. */
  const distanceTo = useMemo(() => {
    if (!selected?.renderPosition || !originEntry?.renderPosition) return null
    if (selected.name === originEntry.name) return null
    return { from: originEntry.renderPosition, to: selected.renderPosition }
  }, [selected, originEntry])

  /** Remember the active world so the system page opens on the same one. */
  useEffect(() => {
    if (viewState?.current) viewState.current.planetId = activeId
  }, [activeId, viewState])

  const focusTo = useCallback((entry, duration) => {
    if (!entry?.renderPosition) return
    focusKey.current += 1
    setFocus({ entry, nonce: focusKey.current, duration })
  }, [])

  const applySelection = useCallback(
    (entry, { fly = false, duration } = {}) => {
      setSelected(entry)
      setActiveId(entry ? (defaultPlanetFor(entry, planet)?.id ?? null) : null)
      if (viewState?.current) viewState.current.selected = entry?.name ?? null
      if (fly) focusTo(entry, duration)
    },
    [focusTo, planet, viewState],
  )

  /** Clicking a star selects it; the camera stays where the user put it. */
  const handleSelect = useCallback(
    (entry) => applySelection(entry),
    [applySelection],
  )

  const handleHover = useCallback((entry) => setHovered(entry), [])

  const handleSearchPick = useCallback(
    (result) => {
      applySelection(result.system, { fly: true, duration: 1.3 })
      if (result.planet) setActiveId(result.planet.id)
    },
    [applySelection],
  )

  /**
   * Explore dives toward the star, then opens that system's page. The system is
   * already selected, so the world picked in the card is preserved.
   */
  const handleExplore = useCallback(
    (entry) => {
      if (!entry) return
      setSelected(entry)
      if (viewState?.current) viewState.current.selected = entry.name
      focusTo(entry, 0.75)
      clearTimeout(exploreTimer.current)
      exploreTimer.current = setTimeout(() => onExplore(entry), 780)
    },
    [focusTo, onExplore, viewState],
  )

  const activePlanet = useMemo(() => {
    if (!selected) return null
    return (
      selected.planets.find((candidate) => candidate.id === activeId) ??
      defaultPlanetFor(selected, planet)
    )
  }, [selected, activeId, planet])

  const routeDistance =
    originEntry && destinationEntry ? distanceLyBetween(origin, planet) : null

  const notes = []
  if (BEYOND_REGION_COUNT > 0) {
    notes.push(
      `${formatNumber(BEYOND_REGION_COUNT, 0)} mapped systems beyond this region are not drawn`,
    )
  }
  if (UNMAPPED_SYSTEM_COUNT > 0) {
    notes.push(
      `${formatNumber(UNMAPPED_SYSTEM_COUNT, 0)} systems without a measured distance are not plotted`,
    )
  }

  return (
    <section className="screen panel overflow-hidden">
      <div className="relative h-[74vh] min-h-[560px] w-full">
        <UniverseScene
          systems={REGION_SYSTEMS}
          pickTargets={PICK_TARGETS}
          labels={labels}
          labelsRef={labelsRef}
          scaleBarRef={scaleBarRef}
          scaleTextRef={scaleTextRef}
          cameraQuaternionRef={cameraQuaternionRef}
          route={route}
          distanceTo={distanceTo}
          selected={selected}
          hovered={hovered}
          resetSignal={resetSignal}
          cameraState={cameraState}
          focus={focus}
          onSelect={handleSelect}
          onHover={handleHover}
        />

        {/* projected names from the 3D positions */}
        <div
          ref={labelsRef}
          aria-label="Star name labels"
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
        >
          {labels.map((entry) => {
            const active = selected?.name === entry.name
            const home = entryIsSolar(entry)
            return (
              <div
                key={entry.name}
                className="absolute top-0 left-0 will-change-transform"
                style={{ visibility: 'hidden' }}
              >
                <button
                  type="button"
                  onClick={() => handleSelect(entry)}
                  className={`pointer-events-auto -translate-x-1/2 -translate-y-[150%] rounded border px-1.5 py-[1px] text-[10px] whitespace-nowrap backdrop-blur-sm transition ${
                    active
                      ? 'border-cyan-300/80 bg-void/85 text-cyan-100'
                      : home
                        ? 'border-line/60 bg-void/80 text-white hover:border-white/60'
                        : 'border-line/35 bg-void/60 text-ink/75 hover:border-line hover:text-white'
                  }`}
                >
                  {entry.name}
                  {active && (
                    <span className="ml-1 text-[9px] text-cyan-200/70">
                      {formatNumber(entry.distanceLy, 1)} ly
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* search, region and legend */}
        <div className="absolute top-3 left-3 z-20 w-[300px] space-y-2">
          <MapSearch originEntry={originEntry} onPick={handleSearchPick} />

          <div className="pointer-events-none rounded-xl border border-line/50 bg-void/85 px-3 py-2.5 backdrop-blur">
            <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">Universe map</div>
            <h1 className="mt-0.5 text-[15px] font-semibold tracking-tight">
              Nearest {MAP_REGION_LY} light-years
            </h1>
            <p className="mt-1 text-[10px] leading-relaxed text-ink/60">
              {formatNumber(REGION_SYSTEM_COUNT, 0)} host-star systems · positions linear in
              light-years (1 unit = 1 ly) · labels capped at {LABEL_LIMIT}
            </p>
            <div className="mt-2 border-t border-line/40 pt-2 text-[10px] text-ink/70">
              Route {origin.name} <span className="text-ink/45">→</span> {planet.name}
              {routeDistance != null && (
                <span className="ml-1 text-ink/50">· {formatNumber(routeDistance, 2)} ly</span>
              )}
            </div>
            {notes.map((note) => (
              <p key={note} className="mt-1 text-[9px] leading-relaxed text-ink/40">
                {note}
              </p>
            ))}
            {!selected && (
              <p className="mt-2 text-[10px] text-ink/55">Click a star to inspect its worlds.</p>
            )}
          </div>

          <div className="pointer-events-none flex flex-wrap gap-x-3 gap-y-1 rounded-xl border border-line/40 bg-void/75 px-3 py-2 text-[9px] text-ink/60 backdrop-blur">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white" /> Solar System
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-ion" /> several worlds
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-line" /> single world
            </span>
          </div>
        </div>

        {/* controls */}
        <div className="pointer-events-auto absolute top-3 right-3 z-20 flex gap-2">
          {onStartChallenge && (
            <button
              type="button"
              className="btn border-[#5ee7ff]/60 bg-[#5ee7ff]/12 px-3 py-1.5 text-[11px] text-[#c9f7ff] hover:border-[#5ee7ff]"
              onClick={onStartChallenge}
              data-testid="start-expedition-challenge-map"
            >
              Start expedition challenge →
            </button>
          )}
          <button
            type="button"
            className="btn bg-void/80 px-3 py-1.5 text-[11px]"
            onClick={() => setResetSignal((value) => value + 1)}
          >
            Reset camera
          </button>
          <button type="button" className="btn bg-void/80 px-3 py-1.5 text-[11px]" onClick={onExit}>
            Close map
          </button>
        </div>

        {/* selected system */}
        {selected && (
          <div className="pointer-events-none absolute top-[60px] right-3 z-20 max-h-[calc(100%-180px)] w-[318px] max-md:inset-x-3 max-md:top-auto max-md:bottom-3 max-md:w-auto max-md:max-h-[52%]">
            <SystemPanel
              entry={selected}
              activePlanet={activePlanet}
              originPlanet={origin}
              originEntry={originEntry}
              onPickPlanet={(next) => setActiveId(next.id)}
              onSetDestination={onSetDestination}
              onSetOrigin={onSetOrigin}
              onExplore={handleExplore}
              onClose={() => applySelection(null)}
            />
          </div>
        )}

        {/* scale bar (updated from the live camera) */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-xl border border-line/45 bg-void/85 px-3 py-2 backdrop-blur">
          <div className="flex items-center gap-2">
            <div ref={scaleBarRef} className="h-px bg-white/70" style={{ width: 120 }} />
            <span
              ref={scaleTextRef}
              data-testid="scale-readout"
              className="num text-[10px] text-ink/85"
            >
              —
            </span>
          </div>
          <div className="mt-1 text-[8px] tracking-[0.16em] text-ink/45 uppercase">
            light-years · linear
          </div>
        </div>

        {/* orbit / zoom hints */}
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 rounded-full border border-line/40 bg-void/75 px-3 py-1 text-[9px] text-ink/55 backdrop-blur sm:block">
          Drag to orbit · scroll to zoom · right-drag to pan · click a star
        </div>

        {/* 3D orientation indicator */}
        <div className="pointer-events-none absolute right-3 bottom-3 z-20 rounded-xl border border-line/45 bg-void/80 p-1.5 backdrop-blur">
          <OrientationGizmo quaternionRef={cameraQuaternionRef} />
        </div>
      </div>
    </section>
  )
}
