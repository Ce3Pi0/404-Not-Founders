import { useEffect, useMemo } from 'react'
import LaunchViewer from './LaunchViewer'
import LaunchControls from './LaunchControls'
import LaunchConfigPanel from './LaunchConfigPanel'
import LaunchTelemetry from './LaunchTelemetry'
import EducationPanel from './EducationPanel'
import CameraMenu from './CameraMenu'
import { formatNumber } from '../../lib/physics'
import { launchTelemetry, planningSummary, routeFor } from '../../lib/launchPhysics'
import { useAppStore } from '../../store/appStore'
import { useLabActions, useLabSim, useLabStore } from '../../store/labStore'

export default function RelativityLab() {
  const shipName = useAppStore((state) => state.shipName)
  const exitLab = useAppStore((state) => state.exitLab)

  const {
    config,
    speed,
    playing,
    launch,
    view,
    split,
    viewA,
    viewB,
    chaseDistance,
    cameraAngle,
    showEducation,
    advisory,
  } = useLabSim()

  const {
    updateConfig,
    setSpeed,
    setView,
    setSplit,
    setViewA,
    setViewB,
    setChaseDistance,
    setCameraAngle,
    setShowEducation,
    dismissAdvisory,
    startLaunch,
    pause,
    resume,
    resetLaunch,
    toggleEngines,
  } = useLabActions()

  const route = useMemo(
    () => routeFor(config),
    [config.startId, config.endId, config.customDestination, config.customDistanceLy],
  )

  const launched = launch.phase !== 'prelaunch'
  const inSpace = launch.phase === 'space' || launch.phase === 'arrival' || launch.phase === 'complete'

  const telemetry = useMemo(() => launchTelemetry(launch, route, config), [launch, route, config])
  const plan = useMemo(() => planningSummary(config, route), [config, route])
  const thrustLevel = launch.thrustN > 0 ? Math.min(1, launch.thrustN / Math.max(1, config.thrustN)) : 0

  // Leaving the lab should not leave the simulation running behind the scenes.
  useEffect(() => () => useLabStore.getState().pause(), [])

  // The simulation loop. The store holds the frame-fresh state, so config and
  // speed edits mid-flight never restart the loop.
  useEffect(() => {
    if (!playing) return undefined
    let frame = 0
    let last = performance.now()

    const tick = (now) => {
      const delta = Math.min(0.25, (now - last) / 1000)
      last = now
      useLabStore.getState().step(delta)
      if (useLabStore.getState().playing) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

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
          <div className="flex items-center gap-2 rounded-lg border border-line/70 bg-white/[0.02] px-3 py-1.5 text-[11px]">
            <span className="text-ink">{route.startPlanet.name}</span>
            <span className="text-ion">→</span>
            <span className="text-ink">{route.endPlanet.name}</span>
            <span className="text-muted/70">·</span>
            <span className="text-muted">{formatNumber(route.distanceLy, 2)} ly</span>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase ${arrived
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
          <button type="button" className="btn px-3 py-1.5 text-xs" onClick={exitLab}>
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
          onReset={resetLaunch}
          launched={launched}
          advisory={advisory}
          onDismissAdvisory={dismissAdvisory}
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
