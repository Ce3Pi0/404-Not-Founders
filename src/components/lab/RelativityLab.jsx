import { useEffect, useMemo, useRef, useState } from 'react'
import LaunchViewer from './LaunchViewer'
import LaunchControls from './LaunchControls'
import LaunchConfigPanel from './LaunchConfigPanel'
import LaunchTelemetry from './LaunchTelemetry'
import EducationPanel from './EducationPanel'
import CameraMenu from './CameraMenu'
import { formatNumber } from '../../lib/physics'
import { LY_M } from '../../lib/labPhysics'
import {
  DEFAULT_LAUNCH_CONFIG,
  advanceLaunch,
  createLaunchState,
  launchTelemetry,
  planningSummary,
  routeFor,
  startLaunchState,
} from '../../lib/launchPhysics'

export default function RelativityLab({ onExit, shipName = 'Odyssey' }) {
  const [config, setConfig] = useState(DEFAULT_LAUNCH_CONFIG)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [launch, setLaunch] = useState(() =>
    createLaunchState(DEFAULT_LAUNCH_CONFIG, routeFor(DEFAULT_LAUNCH_CONFIG)),
  )
  const [view, setView] = useState('third')
  const [split, setSplit] = useState(false)
  const [viewA, setViewA] = useState('second')
  const [viewB, setViewB] = useState('second')
  const [chaseDistance, setChaseDistance] = useState(12)
  const [cameraAngle, setCameraAngle] = useState(0.5)
  const [showEducation, setShowEducation] = useState(false)
  const [advisory, setAdvisory] = useState(null)

  const stateRef = useRef(launch)
  const ctxRef = useRef({ config, route: routeFor(config), speed })
  const route = useMemo(
    () => routeFor(config),
    [config.startId, config.endId, config.customDestination, config.customDistanceLy],
  )
  ctxRef.current = { config, route, speed }

  const launched = launch.phase !== 'prelaunch'
  const inSpace = launch.phase === 'space' || launch.phase === 'arrival' || launch.phase === 'complete'

  const telemetry = useMemo(() => launchTelemetry(launch, route, config), [launch, route, config])
  const plan = useMemo(() => planningSummary(config, route), [config, route])
  const thrustLevel = launch.thrustN > 0 ? Math.min(1, launch.thrustN / Math.max(1, config.thrustN)) : 0

  const commit = (next) => {
    stateRef.current = next
    setLaunch(next)
  }

  // Before liftoff every setting change rebuilds the ready-state craft.
  useEffect(() => {
    if (stateRef.current.phase !== 'prelaunch') return
    const fresh = createLaunchState(config, route)
    stateRef.current = fresh
    setLaunch(fresh)
  }, [config, route])

  // The simulation loop. Config and speed are read through a ref so changing
  // them mid-flight never restarts the loop.
  useEffect(() => {
    if (!playing) return undefined
    let frame = 0
    let last = performance.now()
    let lastPaint = 0

    const tick = (now) => {
      const delta = Math.min(0.25, (now - last) / 1000)
      last = now
      const next = advanceLaunch(
        stateRef.current,
        ctxRef.current.config,
        ctxRef.current.route,
        delta,
        ctxRef.current.speed,
      )
      stateRef.current = next
      if (now - lastPaint > 33) {
        lastPaint = now
        setLaunch(next)
      }
      if (next.phase === 'complete') {
        setLaunch(next)
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  const startLaunch = () => {
    setAdvisory(null)
    commit(startLaunchState(config, route))
    setPlaying(true)
  }

  const pause = () => setPlaying(false)
  const resume = () => {
    if (stateRef.current.phase === 'complete') return
    setPlaying(true)
  }
  const reset = () => {
    setPlaying(false)
    setAdvisory(null)
    commit(createLaunchState(config, route))
  }

  const updateConfig = (patch) => {
    if ('launchAngleDeg' in patch && inSpace) {
      setAdvisory(
        'In space the heading is set by the route itself — the gimbal only steers during the climb. Use the target velocity or the arrival burn to reshape the rest of the flight.',
      )
      return
    }

    if ('engines' in patch && launched) {
      setAdvisory(null)
      commit({
        ...stateRef.current,
        engines: patch.engines,
        notice: patch.engines ? null : stateRef.current.notice,
      })
      return
    }

    const routeTouched =
      'endId' in patch || 'customDestination' in patch || 'customDistanceLy' in patch
    if (routeTouched && launched) {
      const nextRoute = routeFor({ ...config, ...patch })
      const travelledLy = stateRef.current.s / LY_M
      if (nextRoute.distanceLy <= travelledLy) {
        setAdvisory(
          `The new destination is ${formatNumber(nextRoute.distanceLy, 2)} ly away, but the ship has already covered ${formatNumber(travelledLy, 3)} ly — it arrives immediately.`,
        )
      } else {
        setAdvisory(
          `Course changed to ${nextRoute.endPlanet.name} · ${formatNumber(nextRoute.distanceLy, 2)} ly. The ship keeps its current position and speed; ${formatNumber(nextRoute.distanceLy - travelledLy, 2)} ly remain and the arrival burn is re-planned.`,
        )
      }
      commit({ ...stateRef.current, routeM: nextRoute.distanceLy * LY_M })
    } else {
      setAdvisory(null)
    }

    setConfig((current) => ({ ...current, ...patch }))
  }

  const toggleEngines = (on) => {
    if (on && stateRef.current.fuelKg <= 0) {
      setAdvisory('The propellant tanks are empty, so no thrust is available. Reset the launch to refuel.')
      return
    }
    setAdvisory(null)
    commit({ ...stateRef.current, engines: on, notice: on ? null : stateRef.current.notice })
  }

  const arrived = telemetry.phase === 'complete' || telemetry.phase === 'arrival'

  return (
    <div className="screen space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Relativity Lab</div>
          <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            Launch console
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
            Configure the craft, launch it, and keep changing the mission while it flies. Thrust,
            acceleration, fuel and course feed one relativistic integrator, so the trajectory, the
            G-force and all three clocks respond to what you do.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="num flex items-center gap-2 rounded-lg border border-line/70 bg-white/[0.02] px-3 py-1.5 text-[11px]">
            <span className="text-ink">{route.startPlanet.name}</span>
            <span className="text-ion">→</span>
            <span className="text-ink">{route.endPlanet.name}</span>
            <span className="text-muted/70">·</span>
            <span className="text-muted">{formatNumber(route.distanceLy, 2)} ly</span>
          </div>
          <span
            className={`num rounded-full border px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase ${
              arrived
                ? 'border-mint/40 bg-mint/10 text-mint'
                : playing
                  ? 'border-ion/40 bg-ion/10 text-ion'
                  : launch.phase === 'prelaunch'
                    ? 'border-line bg-white/[0.02] text-muted'
                    : 'border-solar/40 bg-solar/10 text-solar'
            }`}
          >
            {telemetry.stageLabel}
          </span>
          <button type="button" className="btn px-3 py-1.5 text-xs" onClick={onExit}>
            Mission flow →
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.72fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <LaunchViewer
            split={split}
            view={view}
            viewA={viewA}
            viewB={viewB}
            onViewAChange={setViewA}
            onViewBChange={setViewB}
            telemetry={telemetry}
            route={route}
            chaseDistance={chaseDistance}
            cameraAngle={cameraAngle}
            thrustLevel={thrustLevel}
            azimuthDeg={config.azimuthDeg}
            playing={playing}
            shipName={shipName}
          />
          <CameraMenu
            view={view}
            onChange={setView}
            split={split}
            onSplitChange={setSplit}
            viewA={viewA}
            viewB={viewB}
            onViewAChange={setViewA}
            onViewBChange={setViewB}
            chaseDistance={chaseDistance}
            onChaseDistanceChange={setChaseDistance}
            cameraAngle={cameraAngle}
            onCameraAngleChange={setCameraAngle}
          />
        </div>

        <LaunchControls
          config={config}
          onChange={updateConfig}
          state={launch}
          telemetry={telemetry}
          playing={playing}
          speed={speed}
          onSpeedChange={setSpeed}
          onLaunch={startLaunch}
          onPause={pause}
          onResume={resume}
          onRestart={startLaunch}
          onReset={reset}
          launched={launched}
          advisory={advisory}
          onDismissAdvisory={() => setAdvisory(null)}
          onEnginesToggle={toggleEngines}
        />
      </div>

      <LaunchConfigPanel
        config={config}
        onChange={updateConfig}
        route={route}
        plan={plan}
        launched={launched}
      />

      <LaunchTelemetry telemetry={telemetry} route={route} config={config} shipName={shipName} />

      <EducationPanel
        telemetry={telemetry}
        route={route}
        config={config}
        open={showEducation}
        onToggle={setShowEducation}
      />
    </div>
  )
}
