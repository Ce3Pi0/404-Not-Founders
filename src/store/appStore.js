import { create } from "zustand";
import { EARTH } from "../lib/earth";
import {
  DEFAULT_PLANET,
  distanceLyBetween,
  nearbyPlanets,
} from "../lib/catalog";
import { missionPhysics, planMission, readPhysicsConfig } from "../lib/mission";
import {
  emptySimulation,
  loadSimulation,
  recordMission,
  saveSimulation,
} from "../lib/simulation";

/** The mission stages, in nav order. */
export const STEPS = [
  { id: "destination", label: "Route" },
  { id: "flight", label: "Flight plan" },
  { id: "journey", label: "Journey" },
  { id: "debrief", label: "Debrief" },
];

const EMPTY_PREDICTION = { earth: "", ship: "" };
const VALID_STEPS = new Set(STEPS.map((step) => step.id));
const GATED = new Set(["journey", "debrief"]);

/**
 * Which stages the header may jump to. Journey and debrief only exist while a
 * launch is in flight, and an arrived flight is not replayed.
 */
export function isStageReachable(mission, target) {
  if (!GATED.has(target)) return true;
  if (!mission) return false;
  return target !== "journey" || !mission.arrivedAt;
}

/**
 * One store for the whole mission flow. Everything the screens share lives
 * here; only presentation details (text buffers, animation progress, the 3D
 * lab) stay local to their components.
 */
export const useAppStore = create((set, get) => ({
  /* ------------------------------ state ------------------------------ */
  step: "destination",
  location: EARTH,
  planet: DEFAULT_PLANET,
  beta: 0.9,
  shipName: "Odyssey",
  prediction: EMPTY_PREDICTION,
  mission: null,
  sim: loadSimulation(),
  aboutOpen: false,

  /* ---------------------------- navigation --------------------------- */
  goToStep(target) {
    if (!VALID_STEPS.has(target)) return;
    const { mission } = get();
    if (!isStageReachable(mission, target)) return;
    // Reaching the debrief is the same event as arriving: log the mission
    // once, move the crew, then show the result.
    if (target === "debrief" && mission && !mission.arrivedAt)
      return get().arrive();
    set({ step: target });
  },
  /* ------------------------------ route ------------------------------ */
  selectOrigin(next) {
    if (!next || next.id === get().location.id) return;
    set({ location: next, mission: null, prediction: EMPTY_PREDICTION });
  },
  selectPlanet(next) {
    if (!next || next.id === get().planet.id) return;
    set({ planet: next, mission: null, prediction: EMPTY_PREDICTION });
  },

  /* --------------------------- flight plan --------------------------- */
  setBeta(beta) {
    set({ beta });
  },
  setShipName(shipName) {
    set({ shipName });
  },
  setPrediction(patch) {
    set((state) => ({ prediction: { ...state.prediction, ...patch } }));
  },

  /* ------------------------ mission lifecycle ------------------------ */
  launch() {
    const { location, planet, beta, shipName } = get();
    const distanceLy = distanceLyBetween(location, planet);
    const { advanced, config } = readPhysicsConfig();
    const plan = planMission({
      origin: location,
      destination: planet,
      distanceLy,
      beta,
      advanced,
      config,
    });
    if (plan.mode === "advanced" && plan.feasibility && !plan.feasibility.ok)
      return;
    set({
      mission: {
        ...missionPhysics(plan),
        origin: location.name,
        originId: location.id,
        planet: planet.name,
        planetId: planet.id,
        shipName: shipName.trim() || "Odyssey",
        distanceLy,
        startedAt: Date.now(),
      },
      step: "journey",
    });
  },
  arrive() {
    const { mission, sim, planet } = get();
    if (!mission) return;
    if (!mission.arrivedAt) {
      set({
        sim: recordMission(sim, mission),
        mission: { ...mission, arrivedAt: Date.now() },
        location: planet,
      });
    }
    set({ step: "debrief" });
  },
  nextMission() {
    const { location, planet } = get();
    const replacement =
      planet.id === location.id
        ? nearbyPlanets(location, 8).find((entry) => entry.id !== location.id)
        : null;
    set({
      mission: null,
      prediction: EMPTY_PREDICTION,
      planet: replacement ?? planet,
      step: "destination",
    });
  },
  goHome() {
    const { planet } = get();
    const replacement =
      planet.kind === "earth"
        ? nearbyPlanets(EARTH, 8).find((entry) => entry.id !== EARTH.id)
        : null;
    set({
      location: EARTH,
      mission: null,
      prediction: EMPTY_PREDICTION,
      planet: replacement ?? planet,
      step: "destination",
    });
  },
  reset() {
    // Outside a browser (SSR, tests) there is no one to ask.
    const ask =
      typeof window !== "undefined" && typeof window.confirm === "function";
    if (
      ask &&
      get().sim.missions.length > 0 &&
      !window.confirm("Reset the simulation and clear the mission log?")
    ) {
      return;
    }
    set({
      sim: emptySimulation(),
      location: EARTH,
      planet: DEFAULT_PLANET,
      mission: null,
      prediction: EMPTY_PREDICTION,
      step: "destination",
    });
  },

  /* ----------------------------- dialogs ----------------------------- */
  openAbout() {
    set({ aboutOpen: true });
  },
  closeAbout() {
    set({ aboutOpen: false });
  },
}));

/* ------------------------------ derived ------------------------------ */

const selectDistanceLy = (state) =>
  distanceLyBetween(state.location, state.planet);

/** Great-circle separation of the current route, in light-years. */
export const useDistanceLy = () => useAppStore(selectDistanceLy);

/* ---------------------------- persistence ---------------------------- */

useAppStore.subscribe((state, previous) => {
  if (state.sim !== previous.sim) saveSimulation(state.sim);
});
