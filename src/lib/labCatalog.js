import { PLANETS } from "./catalog";
import { EARTH } from "./earth";

export const LAB_PLANETS = [EARTH, ...PLANETS];

const BY_ID = new Map(LAB_PLANETS.map((planet) => [planet.id, planet]));

export const labPlanetById = (id) => BY_ID.get(id) ?? EARTH;

export const LAB_DEFAULT_START = EARTH.id;

const DEFAULT_DESTINATION =
  PLANETS.find((planet) => planet.name === "Proxima Cen b") ?? PLANETS[0];
export const LAB_DEFAULT_END = DEFAULT_DESTINATION.id;

/**
 * Catalog radial separation. Every distance is measured from Earth, so the
 * difference of the two catalog distances is the smallest possible separation
 * between the worlds. True separations depend on their sky positions, which the
 * archive export does not carry; the UI labels the route accordingly.
 */
export function routeDistanceLy(startPlanet, endPlanet) {
  const delta = Math.abs(
    (startPlanet?.distanceLy ?? 0) - (endPlanet?.distanceLy ?? 0),
  );
  if (!Number.isFinite(delta)) return 0.05;
  return Math.max(0.05, delta);
}
