import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import UniverseScene from '../map/UniverseScene'
import {
  PICK_TARGETS,
  REGION_SYSTEMS,
  SOLAR_SYSTEM,
  mapDistanceLy,
} from '../../lib/starMap'
import { formatNumber } from '../../lib/physics'
import { CHALLENGE_PATHS, navigate } from '../../lib/router'
import { useChallengeRoute, useChallengeStore } from '../../store/challengeStore'
import { STATUS } from '../../lib/challenge/engine'
import MapSearch from '../map/MapSearch'
import ItineraryPanel from './ItineraryPanel'
import PlanetPickerPanel from './PlanetPickerPanel'
import ProjectionPanel from './ProjectionPanel'

const REGION_BY_NAME = new Map(REGION_SYSTEMS.map((system) => [system.name, system]))

function labelsFor(route, selected, hovered) {
  const out = []
  const seen = new Set()
  const push = (entry) => {
    if (!entry || seen.has(entry.name) || out.length >= 14) return
    seen.add(entry.name)
    out.push(entry)
  }
  push(SOLAR_SYSTEM)
  for (const stop of route.stops) push(REGION_BY_NAME.get(stop.systemName))
  push(selected)
  push(hovered)
  const focus = selected ?? SOLAR_SYSTEM
  for (const system of REGION_SYSTEMS) {
    if (out.length >= 14) break
    if (mapDistanceLy(focus, system) < 26) push(system)
  }
  return out
}

/**
 * Interactive 3D route planner on the real NASA star map.
 *
 * Click a host star, add any of its worlds to the itinerary, then set an
 * independent cruise speed per leg — including the return. The forecast only
 * warns; it never blocks the launch.
 */
export default function RoutePlanner() {
  const route = useChallengeRoute()
  const planetIds = useChallengeStore((state) => state.planetIds)
  const energyBudget = useChallengeStore((state) => state.energyBudget)
  const earthTimeBudget = useChallengeStore((state) => state.earthTimeBudget)
  const expedition = useChallengeStore((state) => state.expedition)
  const addPlanet = useChallengeStore((state) => state.addPlanet)
  const removePlanet = useChallengeStore((state) => state.removePlanet)
  const movePlanet = useChallengeStore((state) => state.movePlanet)
  const clearRoute = useChallengeStore((state) => state.clearRoute)
  const setLegSpeed = useChallengeStore((state) => state.setLegSpeed)
  const launch = useChallengeStore((state) => state.launch)

  const [selectedName, setSelectedName] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [view, setView] = useState(null)
  const [focus, setFocus] = useState(null)
  const [notice, setNotice] = useState(null)

  const labelsRef = useRef(null)
  const scaleBarRef = useRef(null)
  const scaleTextRef = useRef(null)
  const cameraQuaternionRef = useRef(new THREE.Quaternion())
  const cameraState = useRef({ position: null, target: null })

  const selected = selectedName ? REGION_BY_NAME.get(selectedName) ?? null : null
  const labels = useMemo(() => labelsFor(route, selected, hovered), [route, selected, hovered])

  const segments = useMemo(
    () =>
      route.legs.map((leg) => ({
        from: leg.fromPosition,
        to: leg.toPosition,
        status: 'planned',
      })),
    [route],
  )

  const focusNonce = useRef(0)

  const pickFromSearch = (result) => {
    if (!result?.system) return
    setSelectedName(result.system.name)
    focusNonce.current += 1
    setFocus({ entry: result.system, nonce: focusNonce.current, duration: 1.2 })
  }

  const frameRoute = () => {
    const positions = route.stops.map((stop) => stop.position)
    if (positions.length === 0) {
      setView({ position: [78, 58, 96], target: [0, 0, 0] })
      return
    }
    const center = [
      positions.reduce((sum, p) => sum + p[0], 0) / positions.length,
      positions.reduce((sum, p) => sum + p[1], 0) / positions.length,
      positions.reduce((sum, p) => sum + p[2], 0) / positions.length,
    ]
    const radius = Math.max(
      8,
      ...positions.map((p) =>
        Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]),
      ),
    )
    setView({
      position: [center[0] + radius * 1.8, center[1] + radius * 1.25, center[2] + radius * 2],
      target: center,
    })
  }

  const onAdd = (planet) => {
    addPlanet(planet)
    setNotice(`${planet.name} added to the itinerary.`)
  }

  const onRemove = (planetOrId) => {
    const id = typeof planetOrId === 'string' ? planetOrId : planetOrId.id
    removePlanet(id)
  }

  const onLaunch = () => {
    const started = launch()
    if (started) navigate(CHALLENGE_PATHS.flight)
  }

  const resumable =
    expedition && expedition.status !== STATUS.SUCCESS && expedition.status !== STATUS.FAILED
      ? expedition
      : null

  return (
    <section className="screen space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">
            Expedition challenge · route planner
          </div>
          <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            Plot a route that still leaves you a way home
          </h1>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-ink/60">
            One continuous expedition. Click a star to inspect its worlds, add them in any order,
            then choose a cruise velocity for every leg — the return included.
          </p>
        </div>
        {resumable && (
          <button
            type="button"
            className="btn px-3 py-1.5 text-[11px]"
            onClick={() =>
              navigate(
                resumable.status === STATUS.SURVEYING
                  ? CHALLENGE_PATHS.stop
                  : CHALLENGE_PATHS.flight,
              )
            }
          >
            Resume the expedition →
          </button>
        )}
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[330px_minmax(0,1fr)_320px]">
        <div className="order-2 xl:order-1">
          <ItineraryPanel
            route={route}
            onRemove={onRemove}
            onMove={movePlanet}
            onSetSpeed={setLegSpeed}
            onClear={clearRoute}
          />
        </div>

        <div className="order-1 xl:order-2">
          <div className="panel relative overflow-hidden">
            <div className="relative h-[62vh] min-h-[440px] w-full">
              <UniverseScene
                systems={REGION_SYSTEMS}
                pickTargets={PICK_TARGETS}
                labels={labels}
                labelsRef={labelsRef}
                scaleBarRef={scaleBarRef}
                scaleTextRef={scaleTextRef}
                cameraQuaternionRef={cameraQuaternionRef}
                selected={selected}
                hovered={hovered}
                resetSignal={resetSignal}
                cameraState={cameraState}
                focus={focus}
                onSelect={(entry) => setSelectedName(entry?.name ?? null)}
                onHover={setHovered}
                routePath={segments}
                view={view}
                maxDistance={900}
              />

              <div
                ref={labelsRef}
                aria-label="Star name labels"
                className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
              >
                {labels.map((entry) => {
                  const active = selected?.name === entry.name
                  return (
                    <div
                      key={entry.name}
                      className="absolute top-0 left-0 will-change-transform"
                      style={{ visibility: 'hidden' }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedName(entry.name)}
                        className={`pointer-events-auto -translate-x-1/2 -translate-y-[150%] rounded border px-1.5 py-[1px] text-[10px] whitespace-nowrap backdrop-blur-sm transition ${
                          active
                            ? 'border-[#5ee7ff]/80 bg-void/85 text-[#c9f7ff]'
                            : entry.name === SOLAR_SYSTEM.name
                              ? 'border-line/60 bg-void/80 text-white hover:border-white/60'
                              : 'border-line/35 bg-void/60 text-ink/75 hover:border-line hover:text-white'
                        }`}
                      >
                        {entry.name}
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="absolute top-3 left-3 z-20 w-[280px] space-y-2">
                <MapSearch originEntry={SOLAR_SYSTEM} onPick={pickFromSearch} />

                <div className="pointer-events-none rounded-xl border border-line/50 bg-void/88 px-3 py-2.5 backdrop-blur">
                  <div className="text-[9px] tracking-[0.16em] text-ink/45 uppercase">
                    Itinerary in 3D
                  </div>
                  <div className="mt-0.5 text-[13px] font-semibold tracking-tight">
                    Earth {route.stops.length > 0 ? '→ … →' : '→'} Earth
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-ink/60">
                    {route.stops.length} host {route.stops.length === 1 ? 'system' : 'systems'} ·{' '}
                    {formatNumber(route.totalDistanceLy, 2)} ly · {route.legs.length} leg
                    {route.legs.length === 1 ? '' : 's'}
                  </p>
                  <p className="mt-1 text-[9px] text-ink/40">
                    Click a star · drag to orbit · scroll to zoom
                  </p>
                </div>

                <div className="pointer-events-none flex flex-wrap gap-x-3 gap-y-1 rounded-xl border border-line/40 bg-void/75 px-3 py-1.5 text-[9px] text-ink/60 backdrop-blur">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" /> Earth
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#5ee7ff]" /> planned route
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-ion" /> host star
                  </span>
                </div>
              </div>

              <div className="absolute top-3 right-3 z-20 flex gap-2">
                <button
                  type="button"
                  className="btn bg-void/80 px-3 py-1.5 text-[11px]"
                  onClick={() => setResetSignal((value) => value + 1)}
                >
                  Reset camera
                </button>
              </div>

              {selected && (
                <div className="pointer-events-none absolute top-[56px] right-3 z-20 max-h-[calc(100%-80px)] w-[330px] max-md:inset-x-3 max-md:top-auto max-md:bottom-3 max-md:w-auto max-md:max-h-[52%]">
                  <PlanetPickerPanel
                    entry={selected}
                    planetIds={planetIds}
                    onAdd={onAdd}
                    onRemove={onRemove}
                    onClose={() => setSelectedName(null)}
                  />
                </div>
              )}

              <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-xl border border-line/45 bg-void/85 px-3 py-2 backdrop-blur">
                <div className="flex items-center gap-2">
                  <div ref={scaleBarRef} className="h-px bg-white/70" style={{ width: 120 }} />
                  <span ref={scaleTextRef} className="num text-[10px] text-ink/85">
                    —
                  </span>
                </div>
                <div className="mt-1 text-[8px] tracking-[0.16em] text-ink/45 uppercase">
                  light-years · linear
                </div>
              </div>

              {notice && (
                <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-line/50 bg-void/85 px-3 py-1 text-[10px] text-ink/75 backdrop-blur">
                  {notice}
                </div>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-[9px] leading-relaxed text-ink/40">
            Interstellar distances are measured between host-star coordinates from the archive
            (sy_dist in parsecs, converted to light-years). Planets orbiting the same star are a
            local survey, not a second journey. Distances are system-to-system, not exact
            surface-to-surface separations.
          </p>
        </div>

        <div className="order-3">
          <ProjectionPanel
            route={route}
            energyBudget={energyBudget}
            earthTimeBudget={earthTimeBudget}
            onLaunch={onLaunch}
            onFrameRoute={frameRoute}
          />
        </div>
      </div>
    </section>
  )
}
