const STORAGE_KEY = 'beyond-time/simulation/v1'

export function emptySimulation() {
  return { earthYears: 0, shipYears: 0, missions: [] }
}

export function loadSimulation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptySimulation()
    const parsed = JSON.parse(raw)
    return {
      earthYears: Number.isFinite(parsed?.earthYears) ? parsed.earthYears : 0,
      shipYears: Number.isFinite(parsed?.shipYears) ? parsed.shipYears : 0,
      missions: Array.isArray(parsed?.missions) ? parsed.missions : [],
    }
  } catch {
    return emptySimulation()
  }
}

export function saveSimulation(simulation) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(simulation))
  } catch {
    // Storage can be unavailable in private modes; the mission still works in memory.
  }
}

export function recordMission(simulation, mission) {
  return {
    earthYears: simulation.earthYears + mission.earthYears,
    shipYears: simulation.shipYears + mission.shipYears,
    missions: [
      {
        id: `${mission.planet}-${Date.now()}`,
        planet: mission.planet,
        shipName: mission.shipName,
        beta: mission.beta,
        gamma: mission.gamma,
        distanceLy: mission.distanceLy,
        earthYears: mission.earthYears,
        shipYears: mission.shipYears,
        completedAt: new Date().toISOString(),
      },
      ...simulation.missions,
    ].slice(0, 24),
  }
}
