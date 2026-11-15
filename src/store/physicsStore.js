// The relativity-mode state shared by Flight Plan, Live Flight, Debrief and the
// Expedition Challenge: one switch, one set of advanced parameters, and the
// completed results needed for a simple-vs-advanced comparison.
//
// Persisted so the mode survives navigation and a reload, exactly like the
// mission log.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_ADVANCED_CONFIG } from '../lib/advancedSR'

export const MODE = {
  SIMPLE: 'simple',
  ADVANCED: 'advanced',
}

export const MODE_LABEL = {
  simple: 'SIMPLE SR — Constant Velocity',
  advanced: 'ADVANCED SR — Finite Acceleration',
}

export function routeKey(mission) {
  return `${mission?.origin ?? '?'}→${mission?.planet ?? '?'}`
}

export const usePhysicsStore = create(
  persist(
    (set, get) => ({
      advanced: false,
      config: { ...DEFAULT_ADVANCED_CONFIG },
      /** Last completed result per route and mode, for the Debrief comparison. */
      results: {},

      setAdvanced(next) {
        set({ advanced: Boolean(next) })
      },

      setConfig(patch) {
        set((state) => ({ config: { ...state.config, ...patch } }))
      },

      resetConfig() {
        set({ config: { ...DEFAULT_ADVANCED_CONFIG } })
      },

      recordResult(mission) {
        if (!mission) return
        const mode = mission.mode === MODE.ADVANCED ? MODE.ADVANCED : MODE.SIMPLE
        const key = routeKey(mission)
        const entry = {
          mode,
          shipName: mission.shipName,
          distanceLy: mission.distanceLy,
          beta: mission.beta,
          requestedBeta: mission.requestedBeta ?? mission.beta,
          gamma: mission.gamma,
          earthYears: mission.earthYears,
          shipYears: mission.shipYears,
          driftYears: mission.driftYears,
          accelMs: mission.advanced?.accelMs ?? null,
          completedAt: Date.now(),
        }
        set((state) => {
          const results = {
            ...state.results,
            [key]: { ...(state.results[key] ?? {}), [mode]: entry },
          }
          // Keep the comparison table bounded.
          const keys = Object.keys(results)
          for (const stale of keys.slice(0, Math.max(0, keys.length - 12))) {
            delete results[stale]
          }
          return { results }
        })
      },

      resultsFor(mission) {
        return get().results[routeKey(mission)] ?? {}
      },
    }),
    {
      name: 'beyond-time/physics-v1',
      version: 1,
      partialize: (state) => ({
        advanced: state.advanced,
        config: state.config,
        results: state.results,
      }),
    },
  ),
)

/** True when the advanced mode is selected. */
export const useAdvancedMode = () => usePhysicsStore((state) => state.advanced)
