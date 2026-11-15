import csvText from "../data/exoplanets.csv?raw";
import { EARTH } from "./earth";
import { hashString, mulberry32 } from "./planet";

export const LY_PER_PC = 3.26156;
export const LY_PER_AU = 1 / 63241.077;
const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ *
 * CSV parsing — the archive extract is the single source of truth.
 * Columns: pl_name, hostname, ra, dec, sy_dist (pc), pl_orbsmax (AU),
 * pl_orbper (days).
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

const EXOPLANETS = lines
  .filter((line) => cell(line, "pl_name") && cell(line, "hostname"))
  .map((line, index) => {
    const name = cell(line, "pl_name").trim();
    const star = cell(line, "hostname").trim();
    const ra = num(line, "ra") ?? 0;
    const dec = num(line, "dec") ?? 0;
    const distancePc = num(line, "sy_dist") ?? 0;
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

    return {
      id: `x-${slug(name)}-${index}`,
      name,
      star,
      kind: "exoplanet",
      ra,
      dec,
      distancePc,
      distanceLy: distancePc * LY_PER_PC,
      semiMajorAxisAu,
      orbitalPeriodDays,
      eqTempK: eqTempK == null ? null : Math.round(eqTempK),
      ...starProps,
      ...bulk,
      position: positionVector(ra, dec, distancePc),
    };
  });

export const PLANETS = [...EXOPLANETS];
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
    ra: 0,
    dec: 0,
    planets: [EARTH],
  });
  return map;
})();

/**
 * Worlds normally carry a precomputed `position`, but not every synthetic
 * station does (e.g. Earth). Fall back to building the vector from the
 * catalog coordinates so a missing cache can never break a render.
 */
const vectorOf = (planet) =>
  Array.isArray(planet?.position)
    ? planet.position
    : positionVector(
        planet?.ra ?? 0,
        planet?.dec ?? 0,
        planet?.distancePc ?? 0,
      );

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
  const [ax, ay, az] = vectorOf(from);
  const [bx, by, bz] = vectorOf(to);
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

/** The world offered as the destination before the user picks a route. */
export const DEFAULT_PLANET =
  BY_NAME.get("TRAPPIST-1 e") ??
  RECOMMENDED[0] ??
  nearbyPlanets(EARTH, 1)[0] ??
  EARTH;

export const DATASET_SIZE = EXOPLANETS.length;
export const SYSTEM_COUNT = SYSTEMS.size;
