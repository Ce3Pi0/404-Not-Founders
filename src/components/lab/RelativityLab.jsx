import { useEffect, useMemo, useRef, useState } from 'react'
import LabViewer from './LabViewer'
import CameraMenu from './CameraMenu'
import LabControls from './LabControls'
import TelemetryDashboard from './TelemetryDashboard'
import {
  LAB_DEFAULT_END,
  LAB_DEFAULT_START,
  labPlanetById,
  routeDistanceLy,
} from '../../lib/labCatalog'
import {
  betaForDuration,
  durationBounds,
  formatGap,
  solveVoyage,
  telemetryAt,
} from '../../lib/labPhysics'
import { formatNumber, formatYears } from '../../lib/physics'

const PLAYBACK_SECONDS = 26

export default function RelativityLab({ onExit, shipName = 'Odyssey' }) {
  const [startId, setStartId] = useState(LAB_DEFAULT_START)
  const [endId, setEndId] = useState(LAB_DEFAULT_END)
  const [beta, setBeta] = useState(0.9)
  const [accelG, setAccelG] = useState(1)
  const [view, setView] = useState('third')
  const [split, setSplit] = useState(false)
  const [chaseDistance, setChaseDistance] = useState(9)
  const [missionTime, setMissionTime] = useState(0)
  const [playing, setPlaying] = useState(false)

  const timeRef = useRef(0)
  timeRef.current = missionTime

  const startPlanet = labPlanetById(startId)
  const endPlanet = labPlanetById(endId)
  const distanceLy = routeDistanceLy(startPlanet, endPlanet)

  const voyage = useMemo(
    () => solveVoyage({ distanceLy, beta, accelG, startPlanet, endPlanet }),
    [distanceLy, beta, accelG, startPlanet, endPlanet],
  )

  const bounds = useMemo(() => durationBounds(distanceLy, accelG), [distanceLy, accelG])
  const telemetry = useMemo(() => telemetryAt(voyage, missionTime), [voyage, missionTime])

  // Any change to the flight plan recomputes the profile and replays it.
  useEffect(() => {
    setMissionTime(0)
    setPlaying(false)
    timeRef.current = 0
  }, [voyage])

  useEffect(() => {
    if (!playing) return undefined
    let frame = 0
    let last = performance.now()
    let lastPaint = 0
    let elapsed = timeRef.current

    const tick = (now) => {
      const delta = Math.min(0.3, (now - last) / 1000)
      last = now
      elapsed = Math.min(voyage.duration, elapsed + (delta * voyage.duration) / PLAYBACK_SECONDS)
      if (now - lastPaint > 32) {
        lastPaint = now
        setMissionTime(elapsed)
      }
      if (elapsed >= voyage.duration) {
        setMissionTime(voyage.duration)
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, voyage.duration])

  const play = () => {
    setMissionTime(0)
    timeRef.current = 0
    setPlaying(true)
  }
  const pause = () => setPlaying(false)
  const resume = () => setPlaying(true)
  const reset = () => {
    setPlaying(false)
    setMissionTime(0)
    timeRef.current = 0
  }

  const onDurationChange = (years) => {
    setBeta(betaForDuration(distanceLy, accelG, years))
  }

  const swap = () => {
    setStartId(endId)
    setEndId(startId)
  }

  const arrived = missionTime >= voyage.duration && voyage.duration > 0

  return (
    <div className="screen space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Relativity Lab</div>
          <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            Planetary flight console
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
            Choose two worlds, set the ship&apos;s speed, acceleration and journey duration, then fly
            it from four camera perspectives or two synchronized rest frames. Every clock and
            telemetry reading comes from one relativistic flight solution.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="num flex items-center gap-2 rounded-lg border border-line/70 bg-white/[0.02] px-3 py-1.5 text-[11px]">
            <span className="text-ink">{startPlanet.name}</span>
            <span className="text-ion">→</span>
            <span className="text-ink">{endPlanet.name}</span>
            <span className="text-muted/70">·</span>
            <span className="text-muted">{formatNumber(distanceLy, 2)} ly</span>
          </div>
          <span
            className={`num rounded-full border px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase ${
              arrived
                ? 'border-mint/40 bg-mint/10 text-mint'
                : playing
                  ? 'border-ion/40 bg-ion/10 text-ion'
                  : 'border-line bg-white/[0.02] text-muted'
            }`}
          >
            {arrived ? 'Arrived' : playing ? 'Live' : 'Standby'}
          </span>
          <button type="button" className="btn px-3 py-1.5 text-xs" onClick={onExit}>
            Mission flow →
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.72fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <LabViewer
            split={split}
            view={view}
            telemetry={telemetry}
            voyage={voyage}
            startPlanet={startPlanet}
            endPlanet={endPlanet}
            chaseDistance={chaseDistance}
            playing={playing}
            shipName={shipName}
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <CameraMenu
              view={view}
              onChange={setView}
              split={split}
              onSplitChange={setSplit}
              chaseDistance={chaseDistance}
              onChaseDistanceChange={setChaseDistance}
            />
            <section className="panel p-4 sm:p-5">
              <div className="label">Route snapshot</div>
              <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight">
                {startPlanet.name} → {endPlanet.name}
              </h2>
              <dl className="mt-3 space-y-2 text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Coordinate duration</dt>
                  <dd className="num text-ink">{formatYears(voyage.duration)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Ship proper time</dt>
                  <dd className="num text-mint">{formatYears(voyage.shipProper)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Clock divergence</dt>
                  <dd className="num text-solar">{formatGap(voyage.duration - voyage.shipProper)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Peak cruise speed</dt>
                  <dd className="num text-ink">{(voyage.betaPeak * 100).toFixed(2)}% c</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Acceleration</dt>
                  <dd className="num text-ink">{voyage.accelG.toFixed(1)} g</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Route separation</dt>
                  <dd className="num text-ink">{formatNumber(distanceLy, 2)} ly</dd>
                </div>
              </dl>
              <p className="mt-3 text-[10px] leading-relaxed text-muted/75">
                Route length is the radial separation of the two catalog distances from Earth, the
                smallest possible physical separation. Stations A and B are modelled at rest in the
                same inertial frame.
              </p>
            </section>
          </div>
        </div>

        <LabControls
          startId={startId}
          endId={endId}
          onStartChange={setStartId}
          onEndChange={setEndId}
          onSwap={swap}
          beta={beta}
          onBetaChange={setBeta}
          accelG={accelG}
          onAccelChange={setAccelG}
          durationBounds={bounds}
          voyage={voyage}
          onDurationChange={onDurationChange}
          playing={playing}
          missionTime={missionTime}
          shipClockYears={telemetry.shipClockYears}
          onPlay={play}
          onPause={pause}
          onResume={resume}
          onReset={reset}
          onExit={onExit}
        />
      </div>

      <TelemetryDashboard
        telemetry={telemetry}
        voyage={voyage}
        startPlanet={startPlanet}
        endPlanet={endPlanet}
        shipName={shipName}
      />
    </div>
  )
}
