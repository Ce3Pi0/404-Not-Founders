export const START_AGE = 25;

export const STAGES = [
  { id: 'baby', label: 'Baby', range: '0–1 yr', upTo: 1 },
  { id: 'toddler', label: 'Toddler', range: '1–3 yr', upTo: 3 },
  { id: 'child', label: 'Child', range: '3–12 yr', upTo: 12 },
  { id: 'teen', label: 'Teen', range: '12–20 yr', upTo: 20 },
  { id: 'adult', label: 'Adult', range: '20–55 yr', upTo: 55 },
  { id: 'elderly', label: 'Elderly', range: '55–85 yr', upTo: 85 },
  { id: 'skeleton', label: 'Skeleton', range: '85+ yr', upTo: Infinity },
];

/** Biological age = years lived since the simulation began, plus the crew's starting age. */
export function ageFromYears(years) {
  return START_AGE + Math.max(0, years);
}

export function stageForYears(years) {
  const age = ageFromYears(years);
  return STAGES.find((stage) => age < stage.upTo) ?? STAGES[STAGES.length - 1];
}

export function describeAge(years) {
  const age = ageFromYears(years);
  const stage = stageForYears(years);
  return { age, stage, label: `${age.toFixed(1)} yr · ${stage.label}` };
}
