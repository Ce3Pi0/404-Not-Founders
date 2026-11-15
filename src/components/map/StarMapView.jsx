import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import UniverseScene from './UniverseScene'
import { HOME_CAMERA, HOME_TARGET, framingForRoute } from '../../lib/mapCamera'
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
 *
 * The interface is deliberately quiet: a compact navigation rail on the left,
 * a drawer that only exists while a star is inspected, and the rest of the
 * viewport left to the map itself.
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
  arrival = null,
  onReturnToEarth,
}) {
  const [selected, setSelected] = useState(() =>
    mapSystemNamed(viewState?.current?.selected ?? null),
  )
  /* Arriving from the Earth scene: open tight on the Solar origin, then pull
   * the camera back into the full map — the outward half of the transition. */
  const [bootView, setBootView] = useState(() =>
    arrival ? { position: [0.9, 0.6, 1.25], target: HOME_TARGET } : null,
  )

  useEffect(() => {
    if (!arrival) return undefined
    const timer = setTimeout(
      () => setBootView({ position: HOME_CAMERA, target: HOME_TARGET }),
      420,
    )
    return () => clearTimeout(timer)
  }, [arrival])
  const [hovered, setHovered] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [focus, setFocus] = useState(null)
  const [frameView, setFrameView] = useState(null)
  const [compact, setCompact] = useState(false)
  /* The route is already in app state, but it is only drawn once the user asks
   * to see it: a line to a destination 40 ly away would otherwise run off the
   * opening view before anyone had chosen anything. */
  const [routeVisible, setRouteVisible] = useState(false)

  const labelsRef = useRef(null)
  const routeLabelRef = useRef(null)
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

  const routeDistance =
    originEntry && destinationEntry ? distanceLyBetween(origin, planet) : null

  const routeLabel = useMemo(() => {
    if (!routeVisible || !route || routeDistance == null || routeDistance <= 0) return null
    return { from: route.from, to: route.to, text: `${formatNumber(routeDistance, 2)} ly` }
  }, [route, routeDistance, routeVisible])

  const drawnRoute = routeVisible ? route : null

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

  const focusTo = useCallback((entry, options = {}) => {
    if (!entry?.renderPosition) return
    focusKey.current += 1
    setFocus({ entry, nonce: focusKey.current, ...options })
  }, [])

  const applySelection = useCallback(
    (entry, { fly = false, duration, closeness } = {}) => {
      setSelected(entry)
      setActiveId(entry ? (defaultPlanetFor(entry, planet)?.id ?? null) : null)
      if (viewState?.current) viewState.current.selected = entry?.name ?? null
      if (fly) focusTo(entry, { duration, closeness })
    },
    [focusTo, planet, viewState],
  )

  /** Clicking a star selects it and glides the camera in a little. */
  const handleSelect = useCallback(
    (entry) => applySelection(entry, { fly: Boolean(entry), duration: 1.45, closeness: 0.62 }),
    [applySelection],
  )

  const handleHover = useCallback((entry) => setHovered(entry), [])

  const handleSearchPick = useCallback(
    (result) => {
      applySelection(result.system, { fly: true, duration: 1.4, closeness: 0.55 })
      if (result.planet) setActiveId(result.planet.id)
    },
    [applySelection],
  )

  /**
   * Explore dives toward the star, then opens that system's page. The system is
   * already selected, so the world picked in the card is preserved. The Solar
   * System is the way back to the real Earth scene, at AU scale.
   */
  const handleExplore = useCallback(
    (entry) => {
      if (!entry) return
      setSelected(entry)
      if (viewState?.current) viewState.current.selected = entry.name
      focusTo(entry, { duration: 0.8, closeness: 0.28 })
      clearTimeout(exploreTimer.current)
      exploreTimer.current = setTimeout(() => {
        if (entryIsSolar(entry)) {
          if (onReturnToEarth) onReturnToEarth()
          return
        }
        onExplore(entry)
      }, 820)
    },
    [focusTo, onExplore, onReturnToEarth, viewState],
  )

  /** Double-clicking a star is the same dive gesture as "Explore System". */
  const handleActivate = useCallback(
    (entry) => {
      if (!entry) return
      if (entryIsSolar(entry)) {
        setSelected(entry)
        if (viewState?.current) viewState.current.selected = entry.name
        if (onReturnToEarth) onReturnToEarth()
        return
      }
      applySelection(entry)
      handleExplore(entry)
    },
    [applySelection, handleExplore, onReturnToEarth, viewState],
  )

  /** Center on wherever the crew actually is, without leaving the map. */
  const handleCenterOnLocation = useCallback(() => {
    if (originEntry) focusTo(originEntry, { duration: 1.2, closeness: 0.55 })
  }, [focusTo, originEntry])

  /** Fit both ends of the current route in frame, gliding, never snapping. */
  const handleFrameRoute = useCallback(() => {
    if (!route) return
    setRouteVisible(true)
    setFrameView({ ...framingForRoute(route.from, route.to), nonce: Date.now() })
  }, [route])

  const activePlanet = useMemo(() => {
    if (!selected) return null
    return (
      selected.planets.find((candidate) => candidate.id === activeId) ??
      defaultPlanetFor(selected, planet)
    )
  }, [selected, activeId, planet])

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

  const exploreTarget = selected ?? originEntry

  return (
    <section className="screen overflow-hidden border border-white/10 bg-black">
      <div className="relative h-[78vh] min-h-[580px] w-full bg-black">
        <UniverseScene
          systems={REGION_SYSTEMS}
          pickTargets={PICK_TARGETS}
          labels={labels}
          labelsRef={labelsRef}
          scaleBarRef={scaleBarRef}
          scaleTextRef={scaleTextRef}
          cameraQuaternionRef={cameraQuaternionRef}
          route={drawnRoute}
          routeLabel={routeLabel}
          routeLabelRef={routeLabelRef}
          distanceTo={distanceTo}
          selected={selected}
          hovered={hovered}
          resetSignal={resetSignal}
          cameraState={cameraState}
          focus={focus}
          frame={frameView}
          view={bootView}
          onSelect={handleSelect}
          onHover={handleHover}
          onApproachOrigin={onReturnToEarth}
          onExploreEntry={handleActivate}
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
                  onDoubleClick={() => handleActivate(entry)}
                  title={home ? 'Double-click to return to Earth orbit' : 'Double-click to explore'}
                  className={`pointer-events-auto -translate-x-1/2 -translate-y-[170%] rounded-full border px-2 py-[2px] text-[10px] whitespace-nowrap backdrop-blur-sm transition ${
                    active
                      ? 'border-[#5ee7ff]/70 bg-[#04141d]/90 text-[#dff8ff] shadow-[0_0_16px_-4px_#5ee7ff]'
                      : home
                        ? 'border-[#ffcf7a]/45 bg-[#050403]/80 text-white hover:border-[#ffcf7a]/80'
                        : 'border-white/12 bg-[#02060f]/70 text-white/70 hover:border-white/35 hover:text-white'
                  }`}
                >
                  {home ? (
                    <span className="flex items-baseline gap-1">
                      <span className="font-medium tracking-[0.02em]">Solar System</span>
                      <span className="text-[9px] text-[#ffcf7a]/85">— Home</span>
                    </span>
                  ) : (
                    entry.name
                  )}
                  {active && !home && (
                    <span className="ml-1 text-[9px] text-[#9fe9ff]/80">
                      {formatNumber(entry.distanceLy, 1)} ly
                    </span>
                  )}
                  {hovered?.name === entry.name && !active && (
                    <span className="ml-1 text-[9px] text-white/45">
                      {entry.planets.length > 1 ? `${entry.planets.length} worlds` : '1 world'}
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* route distance, projected onto the midpoint of the drawn path */}
        <div
          ref={routeLabelRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 z-10"
          style={{ visibility: 'hidden' }}
        >
          {routeLabel && (
            <span
              data-testid="route-distance"
              className="block -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#5ee7ff]/40 bg-[#02080f]/85 px-2 py-[1px] text-[9px] tracking-[0.12em] whitespace-nowrap text-[#bff3ff] uppercase backdrop-blur-sm"
            >
              {routeLabel.text}
            </span>
          )}
        </div>

        {/* compact navigation rail */}
        <div className="absolute top-3 left-3 z-20 w-[272px] max-w-[calc(100%-6.5rem)]">
          <MapSearch originEntry={originEntry} onPick={handleSearchPick} />

          <div
            data-testid="map-nav-panel"
            className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#03060d]/85 shadow-[0_20px_50px_-30px_#000] backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => setCompact((value) => !value)}
              aria-expanded={!compact}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-white/[0.04]"
            >
              <span className="text-[9px] tracking-[0.22em] text-white/45 uppercase">
                Universe map
              </span>
              <span className="flex items-center gap-1.5">
                <span className="num text-[10px] text-white/70">
                  nearest {MAP_REGION_LY} ly
                </span>
                <span className="text-[10px] text-white/40">{compact ? '▸' : '▾'}</span>
              </span>
            </button>

            {!compact && (
              <div className="space-y-2 border-t border-white/[0.07] px-3 pt-2 pb-3">
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[8px] tracking-[0.18em] text-white/35 uppercase">
                      Current
                    </span>
                    <span className="truncate text-[11px] text-white/85">
                      {origin.star ?? origin.name}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[8px] tracking-[0.18em] text-white/35 uppercase">
                      Destination
                    </span>
                    <span className="truncate text-[11px] text-white/85">
                      {destinationEntry?.name ?? planet.star}
                      {routeDistance != null && routeDistance > 0 && (
                        <span className="num ml-1 text-[10px] text-[#9fe9ff]">
                          {formatNumber(routeDistance, 2)} ly
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[8px] tracking-[0.18em] text-white/35 uppercase">
                      Mapped
                    </span>
                    <span className="num text-[10px] text-white/60">
                      {formatNumber(REGION_SYSTEM_COUNT, 0)} systems
                    </span>
                  </div>
                </div>

                <div className="flex gap-1.5 pt-0.5">
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-[#5ee7ff]/45 bg-[#5ee7ff]/10 px-2 py-1.5 text-[10px] text-[#c9f7ff] transition hover:border-[#5ee7ff]/80 hover:bg-[#5ee7ff]/15 disabled:opacity-35"
                    onClick={() => handleExplore(exploreTarget)}
                    disabled={!exploreTarget}
                  >
                    Explore system
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1.5 text-[10px] text-white/85 transition hover:border-white/35 hover:bg-white/[0.09] disabled:opacity-35"
                    onClick={() => {
                      const target = activePlanet ?? planet
                      onSetDestination(target)
                    }}
                    disabled={!planet}
                  >
                    Plan travel
                  </button>
                </div>

                {route && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      data-testid="frame-route"
                      onClick={handleFrameRoute}
                      className="flex-1 rounded-lg border border-white/10 px-2 py-1 text-[9px] tracking-[0.16em] text-white/45 uppercase transition hover:border-[#5ee7ff]/50 hover:text-[#bff3ff]"
                    >
                      Frame route
                    </button>
                    <button
                      type="button"
                      data-testid="toggle-route"
                      onClick={() => setRouteVisible((value) => !value)}
                      aria-pressed={routeVisible}
                      className={`rounded-lg border px-2 py-1 text-[9px] tracking-[0.16em] uppercase transition ${
                        routeVisible
                          ? 'border-[#5ee7ff]/50 text-[#bff3ff]'
                          : 'border-white/10 text-white/35 hover:text-white/70'
                      }`}
                    >
                      {routeVisible ? 'Line on' : 'Line off'}
                    </button>
                  </div>
                )}

                <p className="text-[9px] leading-relaxed text-white/35">
                  {formatNumber(REGION_SYSTEM_COUNT, 0)} host stars · 1 unit = 1 ly ·{' '}
                  {LABEL_LIMIT} labels max
                  {notes.length > 0 && <span className="block">{notes[0]}</span>}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* edge controls */}
        <div className="pointer-events-auto absolute top-3 right-3 z-20 flex flex-col items-end gap-1.5">
          <div className="flex gap-1.5">
            {onStartChallenge && (
              <button
                type="button"
                className="rounded-lg border border-[#5ee7ff]/45 bg-[#5ee7ff]/10 px-2.5 py-1.5 text-[10px] whitespace-nowrap text-[#c9f7ff] transition hover:border-[#5ee7ff]/80"
                onClick={onStartChallenge}
                data-testid="start-expedition-challenge-map"
              >
                <span className="lg:hidden">Challenge</span>
                <span className="hidden lg:inline">Expedition challenge</span>
              </button>
            )}
            <button
              type="button"
              className="rounded-lg border border-white/12 bg-[#03060d]/80 px-2.5 py-1.5 text-[10px] text-white/75 backdrop-blur transition hover:border-white/30 hover:text-white"
              onClick={() => setResetSignal((value) => value + 1)}
            >
              <span className="lg:hidden">Reset</span>
              <span className="hidden lg:inline">Reset view</span>
            </button>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              data-testid="center-on-location"
              className="rounded-lg border border-white/12 bg-[#03060d]/80 px-2.5 py-1.5 text-[10px] whitespace-nowrap text-white/75 backdrop-blur transition hover:border-white/30 hover:text-white"
              onClick={handleCenterOnLocation}
            >
              <span className="lg:hidden">Locate</span>
              <span className="hidden lg:inline">Center on location</span>
            </button>
            {onReturnToEarth && (
              <button
                type="button"
                className="rounded-lg border border-white/12 bg-[#03060d]/80 px-2.5 py-1.5 text-[10px] whitespace-nowrap text-white/75 backdrop-blur transition hover:border-white/30 hover:text-white"
                onClick={onReturnToEarth}
                data-testid="return-to-earth-orbit"
              >
                <span className="lg:hidden">Earth</span>
                <span className="hidden lg:inline">Earth orbit</span>
              </button>
            )}
            <button
              type="button"
              className="rounded-lg border border-white/12 bg-[#03060d]/80 px-2.5 py-1.5 text-[10px] whitespace-nowrap text-white/75 backdrop-blur transition hover:border-white/30 hover:text-white"
              onClick={onExit}
            >
              Close
            </button>
          </div>
        </div>

        {/* selected system — the only permanent content drawer */}
        {selected && (
          <div className="pointer-events-none absolute top-[52px] right-3 z-30 flex max-h-[calc(100%-150px)] w-[296px] max-lg:inset-x-3 max-lg:top-auto max-lg:bottom-3 max-lg:w-auto max-lg:max-h-[56%]">
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
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-lg border border-white/10 bg-[#03060d]/80 px-2.5 py-2 backdrop-blur">
          <div className="flex items-center gap-2">
            <div ref={scaleBarRef} className="h-px bg-[#5ee7ff]/70" style={{ width: 120 }} />
            <span
              ref={scaleTextRef}
              data-testid="scale-readout"
              className="num text-[10px] text-white/80"
            >
              —
            </span>
          </div>
          <div className="mt-1 text-[8px] tracking-[0.16em] text-white/35 uppercase">
            light-years · linear
          </div>
        </div>

        {/* navigation hints */}
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 rounded-full border border-white/10 bg-[#03060d]/70 px-3 py-1 text-[9px] text-white/45 backdrop-blur md:block">
          Drag to orbit · scroll to zoom · right-drag to pan · double-click a star
        </div>

        {/* 3D orientation indicator */}
        <div className="pointer-events-none absolute right-3 bottom-3 z-20 rounded-lg border border-white/10 bg-[#03060d]/80 p-1.5 backdrop-blur">
          <OrientationGizmo quaternionRef={cameraQuaternionRef} />
        </div>
      </div>
    </section>
  )
}
