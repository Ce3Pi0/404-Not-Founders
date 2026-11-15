import { useCallback, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import UniverseScene from './UniverseScene'
import SystemPanel from './SystemPanel'
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
  defaultPlanetFor,
  entryIsSolar,
  labelSystems,
  mapSystemFor,
} from '../../lib/starMap'

/**
 * Interactive 3D universe map of the nearest 150 light-years.
 *
 * Every point is a unique host-star system at its exact catalogue position;
 * selection feeds back into the mission's existing origin/destination state.
 */
export default function StarMapView({ origin, planet, onSetDestination, onSetOrigin, onExit }) {
  const [selected, setSelected] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [resetSignal, setResetSignal] = useState(0)

  const labelsRef = useRef(null)
  const scaleBarRef = useRef(null)
  const scaleTextRef = useRef(null)
  const cameraQuaternionRef = useRef(new THREE.Quaternion())

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

  const handleSelect = useCallback(
    (entry) => {
      setSelected(entry)
      setActiveId(entry ? (defaultPlanetFor(entry, planet)?.id ?? null) : null)
    },
    [planet],
  )

  const handleHover = useCallback((entry) => setHovered(entry), [])

  const activePlanet = useMemo(() => {
    if (!selected) return null
    return (
      selected.planets.find((candidate) => candidate.id === activeId) ??
      defaultPlanetFor(selected, planet)
    )
  }, [selected, activeId, planet])

  const routeDistance = originEntry && destinationEntry
    ? distanceLyBetween(origin, planet)
    : null

  const notes = []
  if (BEYOND_REGION_COUNT > 0) {
    notes.push(`${formatNumber(BEYOND_REGION_COUNT, 0)} mapped systems beyond this region are not drawn`)
  }
  if (UNMAPPED_SYSTEM_COUNT > 0) {
    notes.push(`${formatNumber(UNMAPPED_SYSTEM_COUNT, 0)} systems without a measured distance are not plotted`)
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
          selected={selected}
          hovered={hovered}
          resetSignal={resetSignal}
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
                      ? 'border-white/70 bg-void/85 text-white'
                      : home
                        ? 'border-line/60 bg-void/80 text-white hover:border-white/60'
                        : 'border-line/35 bg-void/60 text-ink/75 hover:border-line hover:text-white'
                  }`}
                >
                  {entry.name}
                  {active && (
                    <span className="ml-1 text-[9px] text-ink/55">
                      {formatNumber(entry.distanceLy, 1)} ly
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* region and legend */}
        <div className="pointer-events-none absolute top-3 left-3 z-20 max-w-[288px] space-y-2">
          <div className="rounded-xl border border-line/50 bg-void/85 px-3 py-2.5 backdrop-blur">
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

          <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-xl border border-line/40 bg-void/75 px-3 py-2 text-[9px] text-ink/60 backdrop-blur">
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
              onClose={() => handleSelect(null)}
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
