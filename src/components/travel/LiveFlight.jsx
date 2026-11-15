import { useEffect, useMemo, useRef, useState } from 'react'
import FlightScene from './flight/FlightScene'
import FlightHud, { CockpitOverlay } from './flight/FlightHud'
import FlightControls from './flight/FlightControls'
import {
  FLIGHT_TIMELINE_SECONDS,
  flightClock,
  retardedProgress,
  yearsPerPlaybackSecond,
} from '../../lib/flight'
import { formatNumber, formatYears } from '../../lib/physics'
import { travelSystemFor } from '../../lib/starMap'

/** Arrival flourish before the action panel takes over. */
const ARRIVAL_TRANSITION_MS = 1200

const CAMERA_LABEL = {
  external: "External · bird's-eye",
  observer: 'Departure Observer',
  cockpit: 'Spacecraft cockpit',
}

function StatusDot({ playing, arrived }) {
  if (arrived) return <span className="h-1.5 w-1.5 rounded-full bg-ink" />
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full bg-ion ${playing ? 'pulse-soft' : 'opacity-60'}`}
    />
  )
}

function ArrivalPanel({
  mission,
  originEntry,
  destination,
  clock,
  onExplore,
  onChooseDestination,
  onReturnToEarth,
}) {
  const backToEarth = destination.kind !== 'earth'
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-void/85 p-3 sm:p-4">
      <div className="screen max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-ion/60 bg-void/95 p-4 text-center shadow-2xl sm:p-5">
        <div className="text-[9px] tracking-[0.18em] text-ink/50 uppercase">
          Journey complete · arrival
        </div>
        <h2 className="mt-1 text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
          Welcome to {destination.name}
        </h2>
        <p className="mt-1 text-[11px] text-ink/60">
          {originEntry?.name ?? mission.origin} <span className="text-ink/35">→</span>{' '}
          {destination.star} · {mission.shipName} at {mission.beta.toFixed(3)} c
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2 text-left">
          <div className="rounded-lg border border-line/55 bg-void/60 px-2 py-1.5">
            <div className="text-[7px] tracking-[0.12em] text-ink/45 uppercase">Reference</div>
            <div className="num mt-0.5 text-[11px] text-ink">{formatYears(clock.earthYears)}</div>
          </div>
          <div className="rounded-lg border border-line/55 bg-void/60 px-2 py-1.5">
            <div className="text-[7px] tracking-[0.12em] text-ink/45 uppercase">Ship</div>
            <div className="num mt-0.5 text-[11px] text-ink">{formatYears(clock.shipYears)}</div>
          </div>
          <div className="rounded-lg border border-ion/50 bg-ion/10 px-2 py-1.5">
            <div className="text-[7px] tracking-[0.12em] text-ink/45 uppercase">Age gap</div>
            <div className="num mt-0.5 text-[11px] text-ink">{formatYears(clock.driftYears)}</div>
          </div>
        </div>

        <p className="mt-2 text-[9px] text-ink/40">
          {formatNumber(mission.distanceLy, 2)} ly flown · current system {destination.star}
        </p>

        <div className="mt-3 flex flex-col gap-1.5">
          <button type="button" className="btn btn-primary w-full py-2 text-[12px]" onClick={onExplore}>
            Explore This System
          </button>
          <button type="button" className="btn w-full py-2 text-[12px]" onClick={onChooseDestination}>
            Choose Another Destination
          </button>
          {backToEarth && (
            <button type="button" className="btn w-full py-2 text-[12px]" onClick={onReturnToEarth}>
              Return to Earth
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Live Flight — the animated interstellar exploration run between the Travel
 * Planner's departure and destination systems.
 *
 * One requestAnimationFrame clock advances a single `progressRef`. The 3D scene
 * reads that ref every frame; the HUD samples it into React state and derives
 * both clocks from that same fraction via `flightClock`. Mission distance and
 * durations come from the planner untouched, so changing playback speed moves
 * the picture, never the physics.
 */
export default function LiveFlight({
  mission,
  origin,
  destination,
  shipName,
  onArrive,
  onBack,
  onExplore,
  onChooseDestination,
  onReturnToEarth,
}) {
  const originEntry = useMemo(
    () => travelSystemFor(mission.originPlanet ?? origin),
    [mission.originPlanet, origin],
  )
  const destinationEntry = useMemo(
    () => travelSystemFor(mission.destinationPlanet ?? destination),
    [mission.destinationPlanet, destination],
  )

  const progressRef = useRef(0)
  const arrivalRef = useRef(false)
  const onArriveRef = useRef(onArrive)
  const [progress, setProgress] = useState(0)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [camera, setCamera] = useState('external')
  const [delayed, setDelayed] = useState(true)
  const [arriving, setArriving] = useState(false)
  const [arrived, setArrived] = useState(false)

  useEffect(() => {
    onArriveRef.current = onArrive
  }, [onArrive])

  /* The accelerated timeline: visual progress only, never the mission clocks. */
  useEffect(() => {
    if (!playing) return undefined
    let frame
    let last = performance.now()
    let lastPaint = 0

    const step = (now) => {
      const delta = Math.min(0.12, Math.max(0, (now - last) / 1000))
      last = now
      progressRef.current = Math.min(
        1,
        progressRef.current + (delta * rate) / FLIGHT_TIMELINE_SECONDS,
      )
      if (now - lastPaint > 40 || progressRef.current >= 1) {
        lastPaint = now
        setProgress(progressRef.current)
      }
      if (progressRef.current >= 1) {
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [playing, rate])

  /* Reaching the destination: transition, then commit the arrival once. */
  useEffect(() => {
    if (progress < 1 || arrivalRef.current) return undefined
    arrivalRef.current = true
    setArriving(true)
    const timer = setTimeout(() => {
      setArriving(false)
      setArrived(true)
      onArriveRef.current?.(mission)
    }, ARRIVAL_TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [progress, mission])

  const start = () => {
    if (progressRef.current >= 1) return
    setStarted(true)
    setPlaying(true)
  }

  const pause = () => setPlaying(false)

  const resume = () => {
    if (progressRef.current >= 1) return
    setStarted(true)
    setPlaying(true)
  }

  const restart = () => {
    if (arrivalRef.current) return
    progressRef.current = 0
    setProgress(0)
    setStarted(true)
    setPlaying(true)
  }

  const clock = flightClock(mission, progress)
  const delayedClock = flightClock(mission, retardedProgress(progress, mission.beta))
  const delayYears = clock.earthYears - delayedClock.earthYears
  const yearsPerSecond = yearsPerPlaybackSecond(mission, rate)
  const status = arrived ? 'Arrived' : arriving ? 'Arrival' : !started ? 'Ready' : playing ? 'In transit' : 'Paused'
  const originName = originEntry?.name ?? origin.name
  const destinationName = destinationEntry?.name ?? destination.name

  return (
    <section className="screen space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">
            Live flight · accelerated timeline
          </div>
          <h1 className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            <span className="truncate">{originName}</span>
            <span className="text-ink/35">→</span>
            <span className="truncate">{destinationName}</span>
          </h1>
          <p className="mt-1 text-[11px] text-ink/65">
            <span className="num text-ink/90">
              {formatNumber(mission.distanceLy, mission.distanceLy < 1 ? 5 : 2)} ly
            </span>{' '}
            · {mission.beta.toFixed(3)} c · {formatYears(mission.earthYears)} reference ·{' '}
            {formatYears(mission.shipYears)} spacecraft
          </p>
        </div>

        <button type="button" className="btn px-3 py-1.5 text-[11px]" onClick={onBack}>
          ← Back to Travel Planner
        </button>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="panel overflow-hidden">
          <div className="relative h-[52vh] min-h-[420px] w-full">
            <FlightScene
              origin={originEntry}
              destination={destinationEntry}
              cameraMode={camera}
              beta={mission.beta}
              progressRef={progressRef}
              delayed={delayed}
            />

            <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="flex items-center gap-1.5 rounded-full border border-line/70 bg-void/85 px-2.5 py-1 text-[10px] text-ink backdrop-blur">
                  <StatusDot playing={playing} arrived={arrived} />
                  {status}
                </span>
                <span className="rounded-full border border-line/60 bg-void/80 px-2.5 py-1 text-[10px] text-ink/70 backdrop-blur">
                  {CAMERA_LABEL[camera]}
                </span>
              </div>
              <span className="num rounded-full border border-line/60 bg-void/85 px-2.5 py-1 text-[10px] text-ink/75 backdrop-blur">
                {formatNumber(clock.remainingLy, mission.distanceLy < 1 ? 5 : 2)} ly to go
              </span>
            </div>

            {camera === 'cockpit' && !arrived && (
              <CockpitOverlay clock={clock} shipName={shipName} />
            )}

            {arriving && (
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-void/75">
                <div className="arrival-bloom text-center">
                  <div className="text-[9px] tracking-[0.24em] text-ink/55 uppercase">
                    Arriving
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {destinationName}
                  </div>
                </div>
              </div>
            )}

            {arrived && (
              <ArrivalPanel
                mission={mission}
                originEntry={originEntry}
                destination={mission.destinationPlanet ?? destination}
                clock={clock}
                onExplore={onExplore}
                onChooseDestination={onChooseDestination}
                onReturnToEarth={onReturnToEarth}
              />
            )}
          </div>

          <FlightControls
            camera={camera}
            onCameraChange={setCamera}
            started={started}
            playing={playing}
            progress={progress}
            arrived={arrived}
            rate={rate}
            onRateChange={setRate}
            onStart={start}
            onPause={pause}
            onResume={resume}
            onRestart={restart}
            delayed={delayed}
            onDelayedChange={setDelayed}
            yearsPerSecond={yearsPerSecond}
            originName={originName}
            destinationName={destinationName}
          />
        </div>

        <FlightHud
          mission={mission}
          clock={clock}
          shipName={shipName}
          camera={camera}
          delayed={delayed}
          onDelayedChange={setDelayed}
          delayYears={delayYears}
          retardedPercent={delayedClock.progress * 100}
        />
      </div>
    </section>
  )
}
