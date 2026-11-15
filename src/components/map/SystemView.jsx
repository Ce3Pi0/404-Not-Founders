import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import PlanetaryScene from './PlanetaryScene'
import SystemWorldPanel from './SystemWorldPanel'
import OrientationGizmo from './OrientationGizmo'
import { formatNumber } from '../../lib/physics'
import { entryIsSolar, mapDistanceLy, mapSystemFor } from '../../lib/starMap'
import {
  buildPlanetSystem,
  daysPerSecond,
  formatSimSpeed,
  systemFraming,
  systemReferencePeriodDays,
} from '../../lib/planetSystem'

/**
 * `/system/:id` — the Star System Explorer.
 *
 * Zooming into a host star swaps the interstellar, light-year universe map for
 * this local scene, which works in AU: every placed planet sits on the archive's
 * `pl_orbsmax`, orbit rates come from `pl_orbper`, and the camera is framed to
 * the system. Selection flies the camera to a world and feeds the inspector.
 */
export default function SystemView({
  entry,
  origin,
  initialPlanetId,
  onBack,
  onViewPlanet,
  onPlanTravel,
}) {
  const system = useMemo(() => buildPlanetSystem(entry), [entry])
  const framing = useMemo(() => systemFraming(system), [system])
  const referencePeriod = useMemo(() => systemReferencePeriodDays(system), [system])
  const originEntry = useMemo(() => mapSystemFor(origin), [origin])

  const [selectedId, setSelectedId] = useState(initialPlanetId ?? null)
  const [orbitsOn, setOrbitsOn] = useState(true)
  const [labelsOn, setLabelsOn] = useState(true)
  const [speedPosition, setSpeedPosition] = useState(0.55)
  const [paused, setPaused] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const [focus, setFocus] = useState(null)

  const labelsRef = useRef(null)
  const scaleBarRef = useRef(null)
  const scaleTextRef = useRef(null)
  const cameraQuaternionRef = useRef(new THREE.Quaternion())
  const focusNonce = useRef(0)

  /** A different system starts fresh: same camera framing, new selection. */
  useEffect(() => {
    setSelectedId(initialPlanetId ?? null)
    setFocus(null)
    setResetSignal(0)
  }, [entry?.name, initialPlanetId])

  const selectPlanet = useCallback(
    (planet) => {
      if (!planet) {
        setSelectedId(null)
        return
      }
      setSelectedId(planet.id)
      const placed = system?.bodies.some((body) => body.planet.id === planet.id)
      if (placed) {
        focusNonce.current += 1
        setFocus({ id: planet.id, nonce: focusNonce.current })
      }
    },
    [system],
  )

  const timeScale = daysPerSecond(speedPosition, referencePeriod)

  if (!entry || !system) {
    return (
      <section className="screen panel flex flex-col items-start gap-3 p-6">
        <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">System</div>
        <h1 className="text-xl font-semibold">This system is not in the archive</h1>
        <p className="max-w-md text-[12px] text-ink/60">
          The address does not match a host star in the NASA extract.
        </p>
        <button type="button" className="btn px-3 py-1.5 text-[12px]" onClick={onBack}>
          ← Back to Universe
        </button>
      </section>
    )
  }

  const solar = entryIsSolar(entry)
  const fromHere = mapDistanceLy(entry, originEntry)
  const selectedPlanet =
    entry.planets.find((planet) => planet.id === selectedId) ?? null
  const selectedBody =
    system.bodies.find((body) => body.planet.id === selectedId) ?? null

  return (
    <section className="screen space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            className="btn px-3 py-1.5 text-[11px]"
            onClick={onBack}
            data-testid="back-to-universe"
          >
            ← Back to Universe
          </button>
          <div className="mt-3 text-[9px] tracking-[0.18em] text-ink/45 uppercase">
            {solar ? 'Home system' : 'Host-star system'} · Star System Explorer
          </div>
          <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            {entry.name}
          </h1>
          <p className="mt-1 text-[11px] text-ink/65">
            {formatNumber(entry.planets.length, 0)} known world
            {entry.planets.length === 1 ? '' : 's'} · {system.placedCount} on the rings ·{' '}
            {system.compressed
              ? 'orbit spacing compressed for display'
              : 'local scale in AU'}
            {fromHere != null && fromHere > 0 && (
              <span className="text-ink/45"> · {formatNumber(fromHere, 2)} ly from {origin?.name}</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`btn px-3 py-1.5 text-[11px] ${orbitsOn ? 'border-cyan-300/60' : 'text-ink/60'}`}
            aria-pressed={orbitsOn}
            onClick={() => setOrbitsOn((value) => !value)}
          >
            Orbits
          </button>
          <button
            type="button"
            className={`btn px-3 py-1.5 text-[11px] ${labelsOn ? 'border-cyan-300/60' : 'text-ink/60'}`}
            aria-pressed={labelsOn}
            onClick={() => setLabelsOn((value) => !value)}
          >
            Labels
          </button>
          <button
            type="button"
            className="btn px-3 py-1.5 text-[11px]"
            onClick={() => setResetSignal((value) => value + 1)}
          >
            Reset camera
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_352px]">
        <div className="panel overflow-hidden">
          <div className="relative h-[56vh] min-h-[420px] w-full">
            <PlanetaryScene
              system={system}
              framing={framing}
              selectedId={selectedId}
              focus={focus}
              orbitsOn={orbitsOn}
              labelsOn={labelsOn}
              timeScale={timeScale}
              paused={paused}
              labelsRef={labelsRef}
              scaleBarRef={scaleBarRef}
              scaleTextRef={scaleTextRef}
              cameraQuaternionRef={cameraQuaternionRef}
              resetSignal={resetSignal}
              onSelect={selectPlanet}
            />

            {/* projected planet names, following the live orbital positions */}
            <div
              ref={labelsRef}
              aria-label="Planet name labels"
              className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
              style={{ display: labelsOn ? undefined : 'none' }}
            >
              {system.bodies.map((body) => {
                const active = body.planet.id === selectedId
                return (
                  <div
                    key={body.planet.id}
                    className="absolute top-0 left-0 will-change-transform"
                    style={{ visibility: 'hidden' }}
                  >
                    <button
                      type="button"
                      onClick={() => selectPlanet(body.planet)}
                      className={`pointer-events-auto -translate-x-1/2 -translate-y-[150%] rounded border px-1.5 py-[1px] text-[10px] whitespace-nowrap backdrop-blur-sm transition ${
                        active
                          ? 'border-cyan-300/80 bg-void/85 text-cyan-100'
                          : 'border-line/35 bg-void/65 text-ink/75 hover:border-line hover:text-white'
                      }`}
                    >
                      {body.planet.name}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* local scale — the system scene measures AU, never light-years */}
            <div className="pointer-events-none absolute top-3 left-3 z-20 rounded-xl border border-line/45 bg-void/85 px-3 py-2 backdrop-blur">
              {system.compressed ? (
                <>
                  <div className="text-[10px] text-ink/85">Orbit spacing compressed</div>
                  <div className="mt-1 text-[8px] tracking-[0.16em] text-ink/45 uppercase">
                    real AU in the panel
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div ref={scaleBarRef} className="h-px bg-white/70" style={{ width: 120 }} />
                    <span
                      ref={scaleTextRef}
                      data-testid="system-scale-readout"
                      className="num text-[10px] text-ink/85"
                    >
                      —
                    </span>
                  </div>
                  <div className="mt-1 text-[8px] tracking-[0.16em] text-ink/45 uppercase">
                    AU · linear · 1 unit = 1 AU
                  </div>
                </>
              )}
            </div>

            {/* simulation time */}
            <div className="pointer-events-auto absolute bottom-3 left-3 z-20 w-[250px] rounded-xl border border-line/45 bg-void/85 px-3 py-2 backdrop-blur">
              <div className="flex items-baseline justify-between">
                <span className="text-[8px] tracking-[0.16em] text-ink/45 uppercase">
                  Simulation time
                </span>
                <span className="num text-[10px] text-ink/85">1 s ≈ {formatSimSpeed(timeScale)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  className="btn px-2 py-1 text-[10px]"
                  onClick={() => setPaused((value) => !value)}
                  aria-pressed={paused}
                >
                  {paused ? 'Play' : 'Pause'}
                </button>
                <div className="relative h-[18px] flex-1">
                  <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line/60" />
                  <div
                    className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-ion"
                    style={{ width: `${speedPosition * 100}%` }}
                  />
                  <input
                    type="range"
                    className="slider relative"
                    min="0"
                    max="1"
                    step="0.01"
                    value={speedPosition}
                    aria-label="Simulation time rate"
                    onChange={(event) => setSpeedPosition(Number(event.target.value))}
                  />
                </div>
              </div>
              <div className="mt-1 text-[8px] text-ink/40">
                rate ratios from pl_orbper · clock scaled per system · phases illustrative
              </div>
            </div>

            {/* 3D orientation indicator */}
            <div className="pointer-events-none absolute right-3 bottom-3 z-20 rounded-xl border border-line/45 bg-void/80 p-1.5 backdrop-blur">
              <OrientationGizmo quaternionRef={cameraQuaternionRef} />
            </div>

            <div className="pointer-events-none absolute right-3 top-3 z-20 hidden rounded-full border border-line/40 bg-void/75 px-3 py-1 text-[9px] text-ink/55 backdrop-blur lg:block">
              Drag to orbit · scroll to zoom · click a planet
            </div>
          </div>
        </div>

        <SystemWorldPanel
          entry={entry}
          system={system}
          selectedPlanet={selectedPlanet}
          selectedBody={selectedBody}
          fromHere={fromHere}
          originName={origin?.name}
          isCurrentWorld={Boolean(selectedPlanet && origin && selectedPlanet.id === origin.id)}
          onSelect={selectPlanet}
          onViewPlanet={onViewPlanet}
          onPlanTravel={onPlanTravel}
        />
      </div>
    </section>
  )
}
