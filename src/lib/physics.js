// Relativity + planetary helpers.
// Units: c = 1 light-year per year, so distance in ly and speed as a fraction
// of c give travel duration in years directly.

export const C_KM_S = 299792.458;
export const C_M_S = 299792458;
export const G = 6.6743e-11;
export const EARTH_MASS_KG = 5.9722e24;
export const EARTH_RADIUS_M = 6.371e6;
export const DAYS_PER_YEAR = 365.25;
export const MAX_BETA = 0.999;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Constant-velocity mission. Returns durations in the Earth frame and in the
 * ship frame (the crew's proper time).
 */
export function simulateMission(distanceLy, beta) {
  const b = clamp(beta, 0.01, MAX_BETA);
  const gamma = 1 / Math.sqrt(1 - b * b);
  const earthYears = distanceLy / b;
  const shipYears = earthYears / gamma;
  return {
    beta: b,
    gamma,
    earthYears,
    shipYears,
    driftYears: earthYears - shipYears,
    earthDays: earthYears * DAYS_PER_YEAR,
    shipDays: shipYears * DAYS_PER_YEAR,
  };
}

/** Surface gravity of a planet in multiples of Earth's g. */
export function surfaceGravity(massEarth, radiusEarth) {
  if (!massEarth || !radiusEarth) return null;
  return massEarth / (radiusEarth * radiusEarth);
}

/**
 * Clock rate at a planet's surface relative to far-away space:
 * sqrt(1 - r_s / R). Values here are extremely close to 1, which is the point:
 * gravity on these worlds matters far less to our story than velocity does.
 */
export function surfaceClockRate(massEarth, radiusEarth) {
  if (!massEarth || !radiusEarth) return null;
  const schwarzschild = (2 * G * massEarth * EARTH_MASS_KG) / (C_M_S * C_M_S * radiusEarth * EARTH_RADIUS_M);
  if (schwarzschild >= 1) return null;
  return Math.sqrt(1 - schwarzschild);
}

export function formatYears(years) {
  if (!Number.isFinite(years)) return '—';
  if (years <= 0) return '0 yr';
  if (years < 1) {
    const days = years * DAYS_PER_YEAR;
    if (days < 1) return `${(days * 24).toFixed(1)} hr`;
    return `${days.toFixed(1)} days`;
  }
  if (years < 10) return `${years.toFixed(2)} yr`;
  if (years < 1000) return `${years.toFixed(1)} yr`;
  return `${Math.round(years).toLocaleString('en-US')} yr`;
}

export function formatDays(years) {
  if (!Number.isFinite(years)) return '—';
  const days = years * DAYS_PER_YEAR;
  if (days >= 1000) return `${Math.round(days).toLocaleString('en-US')} days`;
  if (days >= 10) return `${days.toFixed(1)} days`;
  return `${days.toFixed(2)} days`;
}

export function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function percentError(guess, actual) {
  if (!Number.isFinite(guess) || !Number.isFinite(actual) || actual <= 0) return null;
  return (Math.abs(guess - actual) / actual) * 100;
}

export function predictionRank(earthError, shipError) {
  const filed = [earthError, shipError].filter((value) => Number.isFinite(value));
  if (filed.length === 0) return { title: 'No prediction filed', note: 'Fly the route and compare afterwards.' };
  const worst = Math.max(...filed);
  if (worst <= 2) return { title: 'Chronometer-grade', note: 'Within 2% on both clocks — textbook.' };
  if (worst <= 10) return { title: 'Relativist', note: 'Within 10% — you have good instincts for γ.' };
  if (worst <= 30) return { title: 'Apprentice navigator', note: 'Within 30% — close enough to feel the effect.' };
  return { title: 'Newtonian instincts', note: 'Off by more than 30% — Newton would have agreed with you.' };
}
