import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { formatNumber } from '../lib/physics'
import { LY_M } from '../lib/labPhysics'
import {
  DEFAULT_LAUNCH_CONFIG,
  advanceLaunch,
  createLaunchState,
  routeFor,
  startLaunchState,
} from '../lib/launchPhysics'

/**
 * Relativity Lab state. The store owns the configuration, the playback flags,
 * the camera/view choices and the simulation snapshot; RelativityLab only runs
 * the animation loop and passes values to the presentational panels.
 *
 * `launchRef` keeps the frame-fresh simulation state so config edits made
 * mid-flight act on the latest position even though React snapshots are
 * throttled to ~30 fps.
 */
const freshLaunch = (config = DEFAULT_LAUNCH_CONFIG) =>
  createLaunchState(config, routeFor(config))

let launchRef = freshLaunch()
let lastPaint = 0

const inSpacePhase = (phase) =>
  phase === 'space' || phase === 'arrival' || phase === 'complete'

export const useLabStore = create((set, get) => {
  const commit = (next) => {
    launchRef = next
    set({ launch: next })
  }

  return {
    /* ------------------------------ state ------------------------------ */
    config: DEFAULT_LAUNCH_CONFIG,
    speed: 1,
    playing: false,
    launch: launchRef,
    view: 'third',
    split: false,
    viewA: 'second',
    viewB: 'second',
    chaseDistance: 12,
    cameraAngle: 0.5,
    showEducation: false,
    advisory: null,

    /* ------------------------------ camera ----------------------------- */
    setSpeed: (speed) => set({ speed }),
    setView: (view) => set({ view }),
    setSplit: (split) => set({ split }),
    setViewA: (viewA) => set({ viewA }),
    setViewB: (viewB) => set({ viewB }),
    setChaseDistance: (chaseDistance) => set({ chaseDistance }),
    setCameraAngle: (cameraAngle) => set({ cameraAngle }),
    setShowEducation: (showEducation) => set({ showEducation }),
    dismissAdvisory: () => set({ advisory: null }),

    /* --------------------------- configuration -------------------------- */
    updateConfig(patch) {
      const state = get()
      const current = launchRef
      const launched = current.phase !== 'prelaunch'

      if ('launchAngleDeg' in patch && inSpacePhase(current.phase)) {
        set({
          advisory:
            'In space the heading is set by the route itself — the gimbal only steers during the climb. Use the target velocity or the arrival burn to reshape the rest of the flight.',
        })
        return
      }

      if ('engines' in patch && launched) {
        set({ advisory: null })
        commit({
          ...current,
          engines: patch.engines,
          notice: patch.engines ? null : current.notice,
        })
        return
      }

      const routeTouched =
        'endId' in patch || 'customDestination' in patch || 'customDistanceLy' in patch
      let advisory = null

      if (routeTouched && launched) {
        const nextRoute = routeFor({ ...state.config, ...patch })
        const travelledLy = current.s / LY_M
        advisory =
          nextRoute.distanceLy <= travelledLy
            ? `The new destination is ${formatNumber(nextRoute.distanceLy, 2)} ly away, but the ship has already covered ${formatNumber(travelledLy, 3)} ly — it arrives immediately.`
            : `Course changed to ${nextRoute.endPlanet.name} · ${formatNumber(nextRoute.distanceLy, 2)} ly. The ship keeps its current position and speed; ${formatNumber(nextRoute.distanceLy - travelledLy, 2)} ly remain and the arrival burn is re-planned.`
        commit({ ...current, routeM: nextRoute.distanceLy * LY_M })
      }

      const nextConfig = { ...state.config, ...patch }
      set({ config: nextConfig, advisory })

      // Before liftoff every setting change rebuilds the ready-state craft.
      if (launchRef.phase === 'prelaunch') {
        commit(createLaunchState(nextConfig, routeFor(nextConfig)))
      }
    },

    /* --------------------------- simulation ----------------------------- */
    step(delta) {
      const { config, speed } = get()
      const route = routeFor(config)
      const next = advanceLaunch(launchRef, config, route, delta, speed)
      launchRef = next

      if (next.phase === 'complete') {
        set({ launch: next, playing: false })
        return
      }

      const now = performance.now()
      if (now - lastPaint > 33) {
        lastPaint = now
        set({ launch: next })
      }
    },
    startLaunch() {
      const { config } = get()
      set({ advisory: null, playing: true })
      commit(startLaunchState(config, routeFor(config)))
    },
    pause() {
      set({ playing: false })
    },
    resume() {
      if (launchRef.phase === 'complete') return
      set({ playing: true })
    },
    resetLaunch() {
      const { config } = get()
      set({ playing: false, advisory: null })
      commit(createLaunchState(config, routeFor(config)))
    },
    toggleEngines(on) {
      if (on && launchRef.fuelKg <= 0) {
        set({
          advisory:
            'The propellant tanks are empty, so no thrust is available. Reset the launch to refuel.',
        })
        return
      }
      set({ advisory: null })
      commit({ ...launchRef, engines: on, notice: on ? null : launchRef.notice })
    },
  }
})

/* ---------------------- consumer hooks (shallow) ---------------------- */

const selectSim = (state) => ({
  config: state.config,
  speed: state.speed,
  playing: state.playing,
  launch: state.launch,
  view: state.view,
  split: state.split,
  viewA: state.viewA,
  viewB: state.viewB,
  chaseDistance: state.chaseDistance,
  cameraAngle: state.cameraAngle,
  showEducation: state.showEducation,
  advisory: state.advisory,
})

const selectActions = (state) => ({
  updateConfig: state.updateConfig,
  setSpeed: state.setSpeed,
  setView: state.setView,
  setSplit: state.setSplit,
  setViewA: state.setViewA,
  setViewB: state.setViewB,
  setChaseDistance: state.setChaseDistance,
  setCameraAngle: state.setCameraAngle,
  setShowEducation: state.setShowEducation,
  dismissAdvisory: state.dismissAdvisory,
  startLaunch: state.startLaunch,
  pause: state.pause,
  resume: state.resume,
  resetLaunch: state.resetLaunch,
  toggleEngines: state.toggleEngines,
})

/** Reactive slice of the lab state. */
export const useLabSim = () => useLabStore(useShallow(selectSim))

/** Stable lab actions, bundled so the console reads one object. */
export const useLabActions = () => useLabStore(useShallow(selectActions))
