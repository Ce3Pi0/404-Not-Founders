// The lab needs a fixed departure station, so Earth joins the exoplanet
// catalog as a station with no interstellar distance.
export const EARTH = {
  id: "earth",
  name: "Earth",
  star: "Sol",
  distanceLy: 0,
  distancePc: 0,
  ra: 0,
  dec: 0,
  position: [0, 0, 0],
  radiusEarth: 1,
  massEarth: 1,
  eqTempK: 288,
  semiMajorAxisAu: 1,
  orbitalPeriodDays: 365.25,
  starTeffK: 5778,
  starRadiusSun: 1,
  starMassSun: 1,
  spectralType: "G2 V",
  starsInSystem: 1,
  densityGcc: 5.51,
  isOrigin: true,
};
