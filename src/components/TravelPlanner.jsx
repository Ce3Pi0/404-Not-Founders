import { useMemo, useRef, useState } from 'react'
import UniverseScene from './map/UniverseScene'
import SystemPickerDialog from './travel/SystemPickerDialog'
import { EARTH } from '../lib/catalog'
import {
  PICK_TARGETS,
  REGION_SYSTEMS,
  defaultPlanetFor,
  mapDistanceLy,
  travelSystemFor,
} from '../lib/starMap'
import { C_KM_S, formatNumber, formatYears, simulateMission } from '../lib/physics'

/** Direction the camera sits away from the route midpoint. */
const VIEW_DIRECTION = (() => {
  const vector = [0.4, 0.42, 1]
  const length = Math.hypot(...vector)
  return vector.map((value) => value / length)
})()

function routeFraming(originEntry, destinationEntry) {
  if (!originEntry?.renderPosition || !destinationEntry?.renderPosition) return null
  const a = originEntry.renderPosition
  const b = destinationEntry.renderPosition
  const target = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  const span = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  const distance = Math.max(14, span * 0.85)
  return {
    span,
    view: {
      position: target.map((value, index) => value + VIEW_DIRECTION[index] * distance),
      target,
    },
  }
}

function Stat({ label, value, note }) {
  return (
    <div className="rounded-lg border border-line/40 bg-void/50 px-3 py-2">
      <div className="text-[8px] tracking-[0.16em] text-ink/45 uppercase">{label}</div>
      <div className="num mt-0.5 text-[14px] text-ink/90">{value}</div>
      {note && <div className="mt-0.5 text-[9px] text-ink/40">{note}</div>}
    </div>
  )
}

/**
 * `/travel` — the Travel Planner.
 *
 * The existing 3D star map is the background: the archive's exact Cartesian
 * positions place both host systems, a glowing path links them, and a
 * spacecraft parked at the departure star carries the speed control. Times use
 * special relativity with constant cruise speed (see `simulateMission`).
 */
export default function TravelPlanner({
  origin,
  destination,
  distanceLy,
  beta,
  onBetaChange,
  shipName,
  onShipNameChange,
  onLaunch,
  onChangeDeparture,
  onChangeDestination,
  onReturnToEarth,
  onReturnToMap,
}) {
  const [picker, setPicker] = useState(null)
  const [hovered, setHovered] = useState(null)
  const labelsRef = useRef(null)
  const shipAnchorRef = useRef(null)

  const originEntry = useMemo(() => travelSystemFor(origin), [origin])
  const destinationEntry = useMemo(() => travelSystemFor(destination), [destination])
  const sameSystem = Boolean(
    originEntry && destinationEntry && originEntry.name === destinationEntry.name,
  )
  const route = useMemo(() => {
    if (!originEntry?.renderPosition || !destinationEntry?.renderPosition || sameSystem) {
      return null
    }
    return {
      from: originEntry.renderPosition,
      to: destinationEntry.renderPosition,
    }
  }, [originEntry, destinationEntry, sameSystem])

  const framing = useMemo(
    () => routeFraming(originEntry, destinationEntry),
    [originEntry, destinationEntry],
  )
  const ship = useMemo(() => {
    if (!route) return null
    return { position: route.from, to: route.to }
  }, [route])

  const labels = useMemo(
    () => (destinationEntry ? [destinationEntry] : []),
    [destinationEntry],
  )

  const flight = simulateMission(distanceLy, beta)
  const canLaunch = Boolean(route) && distanceLy > 0 && !sameSystem
  const pct = ((beta - 0.1) / (0.99 - 0.1)) * 100
  const earthIsOrigin = origin?.id === EARTH.id
  const earthIsDestination = destination?.id === EARTH.id

  const pickDestinationFromMap = (entry) => {
    if (!entry || entry.name === originEntry?.name) return
    const planet = defaultPlanetFor(entry)
    if (planet) onChangeDestination(planet)
  }

  return (
    <section className="screen space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">
            Travel Planner · NASA host stars
          </div>
          <h1 className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            <span>{originEntry?.name ?? origin.name}</span>
            <span className="text-ink/35">→</span>
            <span>{destinationEntry?.name ?? destination.name}</span>
          </h1>
          <p className="mt-1 text-[11px] text-ink/65">
            <span className="num text-ink/90">
              {formatNumber(distanceLy, distanceLy < 1 ? 5 : 2)} ly
            </span>{' '}
            · Euclidean separation of the exact NASA RA/Dec coordinates, not a difference of
            listed distances
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn px-3 py-1.5 text-[11px]"
            onClick={() => setPicker('departure')}
          >
            Change Departure
          </button>
          <button
            type="button"
            className="btn px-3 py-1.5 text-[11px]"
            onClick={() => setPicker('destination')}
          >
            Change Destination
          </button>
          {!earthIsOrigin && (
            <button
              type="button"
              className="btn px-3 py-1.5 text-[11px]"
              onClick={onReturnToEarth}
              disabled={earthIsDestination}
              title={earthIsDestination ? 'Earth is already the destination' : undefined}
            >
              Return to Earth
            </button>
          )}
          <button type="button" className="btn px-3 py-1.5 text-[11px]" onClick={onReturnToMap}>
            Return to Star Map
          </button>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="relative h-[56vh] min-h-[420px] w-full">
          <UniverseScene
            systems={REGION_SYSTEMS}
            pickTargets={PICK_TARGETS}
            labels={labels}
            labelsRef={labelsRef}
            route={route}
            routeGlow
            ship={ship}
            shipAnchorRef={shipAnchorRef}
            view={framing?.view ?? null}
            maxDistance={Math.max(700, (framing?.span ?? 0) * 2.6)}
            far={Math.max(4000, (framing?.span ?? 0) * 6 + 100)}
            selected={destinationEntry}
            hovered={hovered}
            onSelect={pickDestinationFromMap}
            onHover={setHovered}
          />

          {/* selected destination name */}
          <div
            ref={labelsRef}
            aria-label="Destination label"
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          >
            {labels.map((entry) => (
              <div
                key={entry.name}
                className="absolute top-0 left-0 will-change-transform"
                style={{ visibility: 'hidden' }}
              >
                <span className="block -translate-x-1/2 -translate-y-[160%] rounded border border-cyan-300/60 bg-void/85 px-1.5 py-[1px] text-[10px] tracking-[0.08em] whitespace-nowrap text-cyan-100 backdrop-blur-sm">
                  {entry.name}
                </span>
              </div>
            ))}
          </div>

          {/* speed control rides on the spacecraft */}
          {ship && (
            <div
              ref={shipAnchorRef}
              className="pointer-events-none absolute top-0 left-0 z-20 will-change-transform"
              style={{ visibility: 'hidden' }}
            >
              <div className="pointer-events-auto w-[254px] -translate-x-1/2 -translate-y-[calc(100%+16px)] rounded-xl border border-line/60 bg-void/90 px-3 py-2.5 shadow-lg backdrop-blur">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[8px] tracking-[0.16em] text-ink/45 uppercase">
                    Craft speed
                  </span>
                  <span className="num text-[15px] text-ink">{beta.toFixed(3)} c</span>
                </div>
                <div className="relative mt-1.5 h-[16px]">
                  <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line/60" />
                  <div
                    className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-ion"
                    style={{ width: `${pct}%` }}
                  />
                  <input
                    type="range"
                    className="slider relative"
                    min="0.1"
                    max="0.99"
                    step="0.005"
                    value={beta}
                    aria-label="Cruise speed as a fraction of the speed of light"
                    onChange={(event) => onBetaChange(Number(event.target.value))}
                  />
                </div>
                <div className="mt-0.5 flex justify-between text-[8px] text-ink/40">
                  <span className="num">0.10 c</span>
                  <span className="num">0.99 c</span>
                </div>
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-[2px] text-[9px]">
                  <dt className="text-ink/50">Lorentz γ</dt>
                  <dd className="num text-right text-ink/85">{flight.gamma.toFixed(3)}</dd>
                  <dt className="text-ink/50">Reference</dt>
                  <dd className="num text-right text-ink/85">{formatYears(flight.earthYears)}</dd>
                  <dt className="text-ink/50">Ship</dt>
                  <dd className="num text-right text-ink/85">{formatYears(flight.shipYears)}</dd>
                  <dt className="text-ink/50">Aging Δ</dt>
                  <dd className="num text-right text-ink/85">{formatYears(flight.driftYears)}</dd>
                </dl>
              </div>
            </div>
          )}

          {/* view-only hints */}
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden rounded-full border border-line/40 bg-void/75 px-3 py-1 text-[9px] text-ink/55 backdrop-blur lg:block">
            Drag to orbit · scroll to zoom · click a star to set the destination
          </div>
          <button
            type="button"
            className="btn btn-primary absolute right-3 bottom-3 z-20 px-4 py-2 text-[12px]"
            onClick={onLaunch}
            disabled={!canLaunch}
            data-testid="launch-spacecraft"
          >
            Launch Spacecraft
          </button>
          {hovered && hovered.name !== originEntry?.name && (
            <div className="pointer-events-none absolute top-3 left-3 z-20 rounded-lg border border-line/50 bg-void/85 px-2.5 py-1.5 text-[10px] text-ink/75 backdrop-blur">
              {hovered.name}
              {originEntry && (
                <span className="num ml-2 text-ink/45">
                  {formatNumber(mapDistanceLy(hovered, originEntry), 1)} ly from{' '}
                  {originEntry.name}
                </span>
              )}
              <span className="ml-2 text-ink/35">· click to set destination</span>
            </div>
          )}

          {!route && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 px-6 text-center">
              <div className="mx-auto max-w-md rounded-xl border border-line/60 bg-void/90 px-4 py-3 text-[11px] leading-relaxed text-ink/70 backdrop-blur">
                <span className="block text-[9px] tracking-[0.16em] text-ink/45 uppercase">
                  Route not drawable
                </span>
                {sameSystem
                  ? 'Departure and destination are in the same host system. Choose another destination to plan an interstellar journey.'
                  : 'One end of this route has no measured distance in the archive, so the path cannot be placed on the map.'}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="panel p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-[9px] tracking-[0.16em] text-ink/45 uppercase">
              Predicted clocks · constant cruise
            </div>
            <span className="num text-[10px] text-ink/55">
              {formatNumber(beta * C_KM_S, 0)} km/s
            </span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat
              label="Distance"
              value={`${formatNumber(distanceLy, distanceLy < 1 ? 5 : 2)} ly`}
              note="Euclidean · RA/Dec cartesian"
            />
            <Stat label="Cruise speed" value={`${beta.toFixed(3)} c`} note="0.10c–0.99c" />
            <Stat label="Lorentz factor" value={flight.gamma.toFixed(3)} note="1 / √(1 − β²)" />
            <Stat
              label="Reference time"
              value={formatYears(flight.earthYears)}
              note="distance / β"
            />
            <Stat
              label="Spacecraft time"
              value={formatYears(flight.shipYears)}
              note="reference / γ"
            />
            <Stat
              label="Aging difference"
              value={formatYears(flight.driftYears)}
              note="reference − spacecraft"
            />
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-ink/45">
            Model assumptions: the craft cruises at a constant speed for the whole trip;
            departure and destination are treated as stationary in the chosen reference frame;
            acceleration and deceleration are negligible; and gravitational clock corrections
            during transit are not included. Times are illustrative for the selected speed.
          </p>
        </div>

        <div className="panel flex flex-col gap-3 p-4">
          <div>
            <label
              htmlFor="travel-ship-name"
              className="block text-[8px] tracking-[0.16em] text-ink/45 uppercase"
            >
              Spacecraft
            </label>
            <input
              id="travel-ship-name"
              className="field mt-1"
              value={shipName}
              maxLength={28}
              aria-label="Spacecraft name"
              onChange={(event) => onShipNameChange(event.target.value)}
            />
          </div>
          <p className="text-[9px] leading-relaxed text-ink/40">
            {canLaunch
              ? `${shipName.trim() || 'Odyssey'} leaves ${originEntry?.name ?? origin.name} for ${destinationEntry?.name ?? destination.name}. On arrival that system becomes the next departure point.`
              : 'Pick two different host systems to launch.'}
          </p>
          <div className="mt-auto border-t border-line/40 pt-2 text-[10px] text-ink/55">
            <div className="flex justify-between">
              <span>From</span>
              <span className="text-ink/80">{origin.name}</span>
            </div>
            <div className="mt-0.5 flex justify-between">
              <span>To</span>
              <span className="text-ink/80">{destination.name}</span>
            </div>
          </div>
        </div>
      </div>

      {picker && (
        <SystemPickerDialog
          mode={picker}
          excludeSystem={picker === 'departure' ? destinationEntry?.name : originEntry?.name}
          distanceFrom={picker === 'departure' ? destinationEntry : originEntry}
          onSelect={(planet) => {
            if (picker === 'departure') onChangeDeparture(planet)
            else onChangeDestination(planet)
            setPicker(null)
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </section>
  )
}
