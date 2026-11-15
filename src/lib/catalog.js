import csvText from "../data/exoplanets.csv?raw";
import { hashString, mulberry32 } from "./planet";

export const LY_PER_PC = 3.26156;
export const LY_PER_AU = 1 / 63241.077;
const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ *
 * CSV parsing — the archive extract is the single source of truth.
 * Columns: pl_name, hostname, ra, dec, sy_dist (pc), pl_orbsmax (AU),
 * pl_orbper (days), pl_bmasse (M⊕), pl_bmassprov, pl_rade (R⊕), st_mass (M☉).
 *
 * `massEarth` / `radiusEarth` below are the app's illustrative bulk estimates.
 * The measured archive values live in `massEarthMeasured` /
 * `radiusEarthMeasured` and are the only ones the challenge's escape-energy
 * model will ever use.
 * ------------------------------------------------------------------ */

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const [header, ...lines] = parseCsv(csvText.trim());
const column = Object.fromEntries(
  header.map((name, index) => [name.trim(), index]),
);
const cell = (line, name) => {
  const value = line[column[name]];
  return value == null || value === "" ? null : value;
};
const num = (line, name) => {
  const value = cell(line, name);
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const round = (value, digits) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function positionVector(raDeg, decDeg, parsecs) {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  return [
    parsecs * Math.cos(dec) * Math.cos(ra),
    parsecs * Math.cos(dec) * Math.sin(ra),
    parsecs * Math.sin(dec),
  ];
}

/**
 * Map frame — right-handed, Y-up, light-years, Solar System at the origin.
 * This is kept separate from the equatorial parsec vectors above: the map uses
 * NASA's RA/Dec angles directly (RA → X/Z, Dec → Y) and physical distances, so
 * display coordinates never feed back into route or travel calculations.
 */
export function mapCartesian(raDeg, decDeg, distanceLy) {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  return [
    distanceLy * Math.cos(dec) * Math.cos(ra),
    distanceLy * Math.sin(dec),
    distanceLy * Math.cos(dec) * Math.sin(ra),
  ];
}

/**
 * Host-star properties are not in the extract, so they are derived from the
 * orbit with Kepler's third law (M = a³/P²) and standard main-sequence
 * mass–radius–luminosity relations. All derived values are marked as such.
 */
function deriveStar(name, semiMajorAxisAu, orbitalPeriodDays) {
  const rand = mulberry32(hashString(`${name}-star`));
  let mass = null;
  if (
    semiMajorAxisAu != null &&
    orbitalPeriodDays != null &&
    orbitalPeriodDays > 0
  ) {
    const periodYears = orbitalPeriodDays / 365.25;
    mass = semiMajorAxisAu ** 3 / periodYears ** 2;
  }
  if (!Number.isFinite(mass) || mass < 0.03) mass = 0.3 + rand() * 1.1;
  mass = Math.min(4, Math.max(0.075, mass));

  const radiusSun = Math.pow(mass, 0.8) * (0.94 + rand() * 0.12);
  const luminosity =
    mass < 0.43 ? 0.23 * mass ** 2.3 : mass < 2 ? mass ** 4 : 1.4 * mass ** 3.5;
  const teff = Math.min(
    40000,
    Math.max(2300, 5772 * (luminosity / radiusSun ** 2) ** 0.25),
  );

  return {
    starMassSun: round(mass, 3),
    starRadiusSun: round(radiusSun, 3),
    starLuminositySun: round(luminosity, 4),
    starTeffK: Math.round(teff),
  };
}

/**
 * The archive reports where a mass comes from. Minimum masses (M sin i) and
 * mass–radius relations are kept labelled so the challenge never presents them
 * as direct measurements.
 */
function normalizeMassSource(value) {
  if (!value) return null
  const text = value.trim()
  if (/^mass$/i.test(text)) return 'Measured mass'
  if (/msini|sin\s*\(?\s*i/i.test(text)) return 'Minimum mass (M sin i)'
  if (/m-r|mass.?radius/i.test(text)) return 'Mass–radius relation estimate'
  return text
}

const isMinimumMass = (value) => Boolean(value) && /msini|sin\s*\(?\s*i/i.test(value)

/** Bulk properties are absent from the extract; estimated deterministically. */
function deriveBulk(name, eqTempK) {
  const rand = mulberry32(hashString(`${name}-bulk`));
  const a = rand();
  const b = rand();

  let radiusEarth;
  if (eqTempK == null) radiusEarth = 0.9 + a * 2.4;
  else if (eqTempK > 900) radiusEarth = 0.75 + a * 1.35;
  else if (eqTempK > 380) radiusEarth = 0.7 + a * 2.3;
  else radiusEarth = b > 0.78 ? 3.4 + a * 6 : 0.75 + a * 1.5;

  const gas = radiusEarth >= 3.2;
  const density = gas ? 0.25 + rand() * 0.55 : 0.6 + rand() * 1.2;
  return {
    radiusEarth: round(radiusEarth, 2),
    densityGcc: round(5.51 * density, 2),
    massEarth: round(radiusEarth ** 3 * density, 2),
    bulkEstimated: true,
  };
}

export const EARTH = {
  id: "earth",
  name: "Earth",
  star: "Solar System",
  kind: "earth",
  distancePc: 0,
  distanceLy: 0,
  ra: 0,
  dec: 0,
  semiMajorAxisAu: 1,
  orbitalPeriodDays: 365.25,
  radiusEarth: 1,
  massEarth: 1,
  radiusEarthMeasured: 1,
  massEarthMeasured: 1,
  massSource: 'Earth reference constants',
  massIsMinimum: false,
  starMassSunMeasured: 1,
  densityGcc: 5.51,
  eqTempK: 255,
  starMassSun: 1,
  starRadiusSun: 1,
  starTeffK: 5772,
  starLuminositySun: 1,
  position: [0, 0, 0],
};

const EXOPLANETS = lines
  .filter((line) => cell(line, "pl_name") && cell(line, "hostname"))
  .map((line, index) => {
    const name = cell(line, "pl_name").trim();
    const star = cell(line, "hostname").trim();
    const ra = num(line, "ra") ?? 0;
    const dec = num(line, "dec") ?? 0;
    const measuredPc = num(line, "sy_dist");
    const distancePc = measuredPc ?? 0;
    const semiMajorAxisAu = num(line, "pl_orbsmax");
    const orbitalPeriodDays = num(line, "pl_orbper");
    const starProps = deriveStar(
      `${star}-${index}`,
      semiMajorAxisAu,
      orbitalPeriodDays,
    );
    const eqTempK =
      semiMajorAxisAu != null && semiMajorAxisAu > 0
        ? Math.min(
            6000,
            (278 * starProps.starLuminositySun ** 0.25) /
              Math.sqrt(semiMajorAxisAu),
          )
        : null;
    const bulk = deriveBulk(name, eqTempK);
    const massProvenance = cell(line, "pl_bmassprov");
    const massEarthMeasured = num(line, "pl_bmasse");
    const radiusEarthMeasured = num(line, "pl_rade");

    return {
      id: `x-${slug(name)}-${index}`,
      name,
      star,
      kind: "exoplanet",
      ra,
      dec,
      distancePc,
      distanceLy: distancePc * LY_PER_PC,
      // `distancePc` keeps its historic 0 fallback so routes and search behave
      // as before; the map needs to know whether the archive reported one.
      distanceKnown: measuredPc != null && measuredPc > 0,
      semiMajorAxisAu,
      orbitalPeriodDays,
      eqTempK: eqTempK == null ? null : Math.round(eqTempK),
      // The archive's own measurements, kept apart from the illustrative bulk
      // estimates so no interface confuses the two.
      massEarthMeasured: massEarthMeasured ?? null,
      radiusEarthMeasured: radiusEarthMeasured ?? null,
      massSource: normalizeMassSource(massProvenance),
      massIsMinimum: isMinimumMass(massProvenance),
      starMassSunMeasured: num(line, "st_mass"),
      ...starProps,
      ...bulk,
      position: positionVector(ra, dec, distancePc),
    };
  });

export const PLANETS = [EARTH, ...EXOPLANETS];
export const BY_ID = new Map(PLANETS.map((planet) => [planet.id, planet]));
export const BY_NAME = new Map(PLANETS.map((planet) => [planet.name, planet]));

export const planetById = (id) => BY_ID.get(id) ?? EARTH;

/* ------------------------------------------------------------------ *
 * Systems and routes
 * ------------------------------------------------------------------ */

export const SYSTEMS = (() => {
  const map = new Map();
  for (const planet of EXOPLANETS) {
    const existing = map.get(planet.star);
    if (existing) {
      existing.planets.push(planet);
    } else {
      map.set(planet.star, {
        name: planet.star,
        position: planet.position,
        distancePc: planet.distancePc,
        distanceLy: planet.distanceLy,
        distanceKnown: planet.distanceKnown,
        // Exact map-frame Cartesian coordinates in light-years (or null when
        // the archive reported no distance and the system has no real place).
        mapPosition: planet.distanceKnown
          ? mapCartesian(planet.ra, planet.dec, planet.distanceLy)
          : null,
        ra: planet.ra,
        dec: planet.dec,
        planets: [planet],
      });
    }
  }
  map.set("Solar System", {
    name: "Solar System",
    position: [0, 0, 0],
    distancePc: 0,
    distanceLy: 0,
    distanceKnown: true,
    mapPosition: [0, 0, 0],
    ra: 0,
    dec: 0,
    planets: [EARTH],
  });
  return map;
})();

/** Unique host-star systems with a measured distance, in the map frame. */
export const MAPPED_SYSTEMS = [...SYSTEMS.values()].filter(
  (system) => system.mapPosition,
);

/** Systems kept in search/routes but left off the map: distance unknown. */
export const UNMAPPED_SYSTEM_COUNT = SYSTEMS.size - MAPPED_SYSTEMS.length;

/** Great-unknown route length between two worlds, in light-years. */
export function distanceLyBetween(from, to) {
  if (!from || !to) return 0;
  if (from.id === to.id) return 0;
  if (from.star === to.star) {
    const a = from.semiMajorAxisAu;
    const b = to.semiMajorAxisAu;
    if (a == null || b == null) return 0.00001;
    return Math.max(0.00001, Math.abs(a - b) * LY_PER_AU);
  }
  const [ax, ay, az] = from.position;
  const [bx, by, bz] = to.position;
  return Math.hypot(ax - bx, ay - by, az - bz) * LY_PER_PC;
}

export function nearbyPlanets(from, limit = 8) {
  const origin = from ?? EARTH;
  return EXOPLANETS.filter((planet) => planet.id !== origin.id)
    .map((planet) => ({ planet, distance: distanceLyBetween(origin, planet) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((entry) => entry.planet);
}

const NOTABLE = [
  "TRAPPIST-1",
  "Proxima Cen",
  "Kepler-22",
  "HD 209458",
  "Kepler-452",
  "WASP-12",
  "KELT-9",
  "TOI-700",
  "GJ 1214",
  "55 Cnc",
];

export const RECOMMENDED = NOTABLE.map((star) => SYSTEMS.get(star)?.planets[0])
  .filter(Boolean)
  .slice(0, 8);

const SEARCH_INDEX = PLANETS.filter((planet) => planet.kind !== "earth").map(
  (planet) => ({
    planet,
    name: planet.name.toLowerCase(),
    star: planet.star.toLowerCase(),
  }),
);

export function searchPlanets(query, limit = 16) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const starts = [];
  const contains = [];
  for (const entry of SEARCH_INDEX) {
    if (entry.name.startsWith(needle) || entry.star.startsWith(needle))
      starts.push(entry.planet);
    else if (entry.name.includes(needle) || entry.star.includes(needle))
      contains.push(entry.planet);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

export const DEFAULT_PLANET =
  BY_NAME.get("TRAPPIST-1 e") ??
  RECOMMENDED[0] ??
  nearbyPlanets(EARTH, 1)[0] ??
  EARTH;

export const DATASET_SIZE = EXOPLANETS.length;
export const SYSTEM_COUNT = SYSTEMS.size;
