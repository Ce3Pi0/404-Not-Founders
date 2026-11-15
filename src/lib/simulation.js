const STORAGE_KEY = 'beyond-time/simulation/v1'

export const CAREER_CONTRACTS = [
  { id: 'first-flight', title: 'First Light', detail: 'Complete your first interstellar arrival.', reward: 250 },
  { id: 'interstellar', title: 'Interstellar Survey', detail: 'Reach a destination at least 1 light-year away.', reward: 400 },
  { id: 'near-light', title: 'Relativistic Pioneer', detail: 'Complete a voyage at 0.90c or faster.', reward: 600 },
  { id: 'deep-space', title: 'Deep Space Explorer', detail: 'Complete a voyage of 10 light-years or more.', reward: 1000 },
  { id: 'homecoming', title: 'Homecoming', detail: 'Complete a return voyage to Earth.', reward: 350 },
]

export const CAREER_SHIPS = [
  { id: 'odyssey', name: 'Odyssey', className: 'Explorer class', requirement: 0, description: 'The original exploration craft. A dependable first step beyond Earth.' },
  { id: 'pioneer', name: 'Pioneer', className: 'Survey class', requirement: 2, description: 'A purpose-built vessel for mapping distant planetary systems.' },
  { id: 'horizon', name: 'Horizon', className: 'Long-range class', requirement: 5, description: 'Designed for extended missions and deeper exploration.' },
  { id: 'relativistic', name: 'Relativistic', className: 'Experimental class', requirement: 10, description: 'A high-performance research craft for extreme relativistic voyages.' },
]

export const CAREER_UPGRADES = [
  { id: 'mission-computer', name: 'Mission Computer', detail: 'Improves mission funding rewards by 10% per level.', baseCost: 500, maxLevel: 5 },
  { id: 'research-lab', name: 'Research Laboratory', detail: 'Increases research XP earned by 15% per level.', baseCost: 650, maxLevel: 5 },
  { id: 'deep-space-array', name: 'Deep-Space Array', detail: 'Adds a 100-credit discovery bonus to each completed voyage per level.', baseCost: 800, maxLevel: 3 },
]

function emptyCareer() {
  return {
    credits: 1000,
    xp: 0,
    completedContracts: [],
    selectedShip: 'odyssey',
    upgrades: { 'mission-computer': 0, 'research-lab': 0, 'deep-space-array': 0 },
    totalCreditsEarned: 0,
  }
}

export function emptySimulation() {
  return { earthYears: 0, shipYears: 0, missions: [], career: emptyCareer() }
}

export function loadSimulation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptySimulation()
    const parsed = JSON.parse(raw)
    const career = { ...emptyCareer(), ...(parsed?.career ?? {}) }
    career.completedContracts = Array.isArray(career.completedContracts) ? career.completedContracts : []
    career.upgrades = { ...emptyCareer().upgrades, ...(career.upgrades ?? {}) }
    return {
      earthYears: Number.isFinite(parsed?.earthYears) ? parsed.earthYears : 0,
      shipYears: Number.isFinite(parsed?.shipYears) ? parsed.shipYears : 0,
      missions: Array.isArray(parsed?.missions) ? parsed.missions : [],
      career,
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

function contractsCompleted(mission, completed) {
  const eligible = []
  if (!completed.includes('first-flight')) eligible.push('first-flight')
  if (!completed.includes('interstellar') && mission.distanceLy >= 1) eligible.push('interstellar')
  if (!completed.includes('near-light') && mission.beta >= 0.9) eligible.push('near-light')
  if (!completed.includes('deep-space') && mission.distanceLy >= 10) eligible.push('deep-space')
  if (!completed.includes('homecoming') && /earth/i.test(mission.planet)) eligible.push('homecoming')
  return eligible
}

export function recordMission(simulation, mission) {
  const career = { ...emptyCareer(), ...(simulation.career ?? {}) }
  career.upgrades = { ...emptyCareer().upgrades, ...(career.upgrades ?? {}) }
  const earnedContracts = contractsCompleted(mission, career.completedContracts)
  const contractCredits = CAREER_CONTRACTS
    .filter((contract) => earnedContracts.includes(contract.id))
    .reduce((sum, contract) => sum + contract.reward, 0)
  const computerLevel = career.upgrades['mission-computer'] ?? 0
  const researchLevel = career.upgrades['research-lab'] ?? 0
  const arrayLevel = career.upgrades['deep-space-array'] ?? 0
  const basePay = 100 + Math.round(Math.max(0, mission.distanceLy) * 40)
  const missionPay = Math.round(basePay * (1 + computerLevel * 0.1)) + arrayLevel * 100
  const creditsEarned = missionPay + contractCredits
  const baseXp = 50 + Math.round(Math.max(0, mission.distanceLy) * 15)
  const xpEarned = Math.round(baseXp * (1 + researchLevel * 0.15)) + earnedContracts.length * 100
  const missionRecord = {
    id: `${mission.planet}-${mission.startedAt ?? Date.now()}`,
    origin: mission.origin,
    planet: mission.planet,
    shipName: mission.shipName,
    beta: mission.beta,
    gamma: mission.gamma,
    distanceLy: mission.distanceLy,
    earthYears: mission.earthYears,
    shipYears: mission.shipYears,
    creditsEarned,
    xpEarned,
    contractsCompleted: earnedContracts,
    completedAt: new Date().toISOString(),
  }

  return {
    earthYears: simulation.earthYears + mission.earthYears,
    shipYears: simulation.shipYears + mission.shipYears,
    missions: [missionRecord, ...simulation.missions].slice(0, 24),
    career: {
      ...career,
      credits: career.credits + creditsEarned,
      xp: career.xp + xpEarned,
      totalCreditsEarned: (career.totalCreditsEarned ?? 0) + creditsEarned,
      completedContracts: [...career.completedContracts, ...earnedContracts],
      lastReward: { credits: creditsEarned, xp: xpEarned, contracts: earnedContracts },
    },
  }
}

export function purchaseCareerUpgrade(simulation, upgradeId) {
  const upgrade = CAREER_UPGRADES.find((entry) => entry.id === upgradeId)
  if (!upgrade) return simulation
  const career = { ...emptyCareer(), ...(simulation.career ?? {}) }
  career.upgrades = { ...emptyCareer().upgrades, ...(career.upgrades ?? {}) }
  const level = career.upgrades[upgradeId] ?? 0
  const cost = upgrade.baseCost * (level + 1)
  if (level >= upgrade.maxLevel || career.credits < cost) return simulation
  return {
    ...simulation,
    career: {
      ...career,
      credits: career.credits - cost,
      upgrades: { ...career.upgrades, [upgradeId]: level + 1 },
    },
  }
}
