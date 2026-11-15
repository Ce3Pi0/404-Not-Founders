// One central store for the Expedition Challenge.
//
// The route, the active expedition, every resource and every clock live here,
// so moving between the planner, the flight, the survey stop and the result
// screen never resets the run. State is persisted to localStorage, so a reload
// resumes the expedition exactly where it stopped (simulation time only
// advances while the flight is playing).

import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildDirectReturnLeg, buildExpeditionRoute } from '../lib/challenge/route'
import { clampBeta } from '../lib/challenge/physics'
import { readPhysicsConfig } from '../lib/mission'
import { usePhysicsStore } from './physicsStore'
import {
  advanceExpedition,
  continueExpedition as continueEngine,
  createExpedition,
  insertFinalLeg,
  pauseExpedition,
  resumeExpedition,
  surveyPlanet as surveyEngine,
} from '../lib/challenge/engine'

export const PRESETS = [
  {
    id: 'explorer',
    name: 'Explorer',
    energyBudget: 20,
    earthTimeBudget: 300,
    blurb: 'Generous budgets — a long tour of the neighbourhood.',
  },
  {
    id: 'navigator',
    name: 'Navigator',
    energyBudget: 5,
    earthTimeBudget: 100,
    blurb: 'The beginner challenge: plan carefully, return with resources to spare.',
  },
  {
    id: 'expert',
    name: 'Relativity Expert',
    energyBudget: 2.5,
    earthTimeBudget: 60,
    blurb: 'Restricted budgets — every leg at high speed is ruinous.',
  },
  { id: 'custom', name: 'Custom', blurb: 'Choose both budgets yourself.' },
]

export const DEFAULT_PRESET = 'navigator'
export const STORAGE_KEY = 'beyond-time-challenge-v1'

const presetById = (id) => PRESETS.find((preset) => preset.id === id) ?? null

const clampBudget = (value, min, max, fallback) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

export const useChallengeStore = create(
  persist(
    (set, get) => ({
      preset: DEFAULT_PRESET,
      energyBudget: 5,
      earthTimeBudget: 100,
      planetIds: [],
      legSpeeds: {},
      shipName: 'Odyssey',
      expedition: null,

      /* ------------------------------------------------------------ setup -- */

      setPreset(id) {
        const preset = presetById(id)
        if (!preset) return
        if (preset.id === 'custom') {
          set({ preset: 'custom' })
          return
        }
        set({
          preset: preset.id,
          energyBudget: preset.energyBudget,
          earthTimeBudget: preset.earthTimeBudget,
        })
      },

      setCustomBudgets({ energyBudget, earthTimeBudget }) {
        set((state) => ({
          preset: 'custom',
          energyBudget:
            energyBudget == null
              ? state.energyBudget
              : clampBudget(energyBudget, 0.1, 200, state.energyBudget),
          earthTimeBudget:
            earthTimeBudget == null
              ? state.earthTimeBudget
              : clampBudget(earthTimeBudget, 1, 5000, state.earthTimeBudget),
        }))
      },

      setShipName(name) {
        set({ shipName: name })
      },

      /* ------------------------------------------------------------ route -- */

      addPlanet(planet) {
        if (!planet || planet.kind === 'earth') return
        set((state) => {
          if (state.planetIds.includes(planet.id)) return state
          return { planetIds: [...state.planetIds, planet.id] }
        })
      },

      removePlanet(planetId) {
        set((state) => ({
          planetIds: state.planetIds.filter((id) => id !== planetId),
        }))
      },

      /** Reorder one stop in the itinerary; ±1 moves it before/after its neighbour. */
      movePlanet(planetId, direction) {
        set((state) => {
          const from = state.planetIds.indexOf(planetId)
          const to = from + direction
          if (from < 0 || to < 0 || to >= state.planetIds.length) return state
          const next = [...state.planetIds]
          const [moved] = next.splice(from, 1)
          next.splice(to, 0, moved)
          return { planetIds: next }
        })
      },

      clearRoute() {
        set({ planetIds: [], legSpeeds: {} })
      },

      setLegSpeed(key, beta) {
        set((state) => ({ legSpeeds: { ...state.legSpeeds, [key]: clampBeta(beta) } }))
      },

      /* --------------------------------------------------------- flight -- */

      /** Build a fresh expedition from the current route and budgets. */
      launch() {
        const state = get()
        const { advanced, config } = readPhysicsConfig()
        const route = buildExpeditionRoute(state.planetIds, state.legSpeeds, {
          advanced,
          config,
        })
        if (!route.valid) return null
        const expedition = createExpedition({
          route,
          energyBudget: state.energyBudget,
          earthTimeBudget: state.earthTimeBudget,
          shipName: state.shipName,
        })
        set({ expedition })
        return expedition
      },

      /** Advance the running simulation by real elapsed playback seconds. */
      tick(dtSeconds) {
        const expedition = get().expedition
        if (!expedition) return expedition
        const next = advanceExpedition(expedition, dtSeconds)
        if (next !== expedition) set({ expedition: next })
        return next
      },

      pause() {
        const expedition = get().expedition
        if (!expedition) return
        const next = pauseExpedition(expedition)
        if (next !== expedition) set({ expedition: next })
      },

      resume() {
        const expedition = get().expedition
        if (!expedition) return
        const next = resumeExpedition(expedition)
        if (next !== expedition) set({ expedition: next })
      },

      survey(planetId) {
        const expedition = get().expedition
        if (!expedition) return
        const next = surveyEngine(expedition, planetId)
        if (next !== expedition) set({ expedition: next })
      },

      continueFlight() {
        const expedition = get().expedition
        if (!expedition) return
        const next = continueEngine(expedition)
        if (next !== expedition) set({ expedition: next })
      },

      /** End the route early: replace the unflown remainder with one leg home. */
      returnToEarthNow(beta) {
        const expedition = get().expedition
        if (!expedition || expedition.status !== 'surveying') return
        const leg = buildDirectReturnLeg({
          fromSystem: expedition.currentLocation.systemName,
          departurePlanetId: expedition.currentLocation.planetId,
          index: expedition.currentLegIndex + 1,
          beta,
          // A running expedition keeps the physics mode it launched with.
          options:
            expedition.route.physicsMode === 'advanced'
              ? { advanced: true, config: expedition.route.advancedConfig }
              : {},
        })
        if (!leg) return
        set({ expedition: insertFinalLeg(expedition, leg) })
      },

      /* --------------------------------------------------------- outcomes -- */

      /** Same route, same budgets, everything else fresh. */
      retry() {
        const expedition = get().expedition
        if (!expedition) return
        set({
          expedition: createExpedition({
            route: expedition.route,
            energyBudget: expedition.energyBudget,
            earthTimeBudget: expedition.earthTimeBudget,
            shipName: expedition.shipName,
          }),
        })
      },

      /** Keep the route, go back to the planner with the same speeds. */
      reconfigureVelocities() {
        const expedition = get().expedition
        if (!expedition) return
        const legSpeeds = { ...get().legSpeeds }
        for (const leg of expedition.route.legs) legSpeeds[leg.key] = leg.beta
        set({ expedition: null, legSpeeds })
      },

      /** Start over with an empty itinerary but the same budgets. */
      chooseDifferentRoute() {
        set({ expedition: null, planetIds: [], legSpeeds: {} })
      },

      /** Full reset back to the default beginner budgets. */
      newChallenge() {
        const preset = presetById(DEFAULT_PRESET)
        set({
          preset: preset.id,
          energyBudget: preset.energyBudget,
          earthTimeBudget: preset.earthTimeBudget,
          planetIds: [],
          legSpeeds: {},
          expedition: null,
        })
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (state) => ({
        preset: state.preset,
        energyBudget: state.energyBudget,
        earthTimeBudget: state.earthTimeBudget,
        planetIds: state.planetIds,
        legSpeeds: state.legSpeeds,
        shipName: state.shipName,
        expedition: state.expedition,
      }),
    },
  ),
)

/** The projected route for the current itinerary, rebuilt when it changes. */
export function useChallengeRoute() {
  const planetIds = useChallengeStore((state) => state.planetIds)
  const legSpeeds = useChallengeStore((state) => state.legSpeeds)
  const advanced = usePhysicsStore((state) => state.advanced)
  const config = usePhysicsStore((state) => state.config)
  return useMemo(
    () => buildExpeditionRoute(planetIds, legSpeeds, { advanced, config }),
    [planetIds, legSpeeds, advanced, config],
  )
}

/** The active expedition, if any. */
export function useExpedition() {
  return useChallengeStore((state) => state.expedition)
}
