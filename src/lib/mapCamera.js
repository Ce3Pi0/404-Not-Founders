// Home framing for the 3D universe map, shared with the Earth orbit handoff.
// Kept out of UniverseScene so the scene module exports only its component and
// Fast Refresh keeps working while editing the map.

export const HOME_CAMERA = [18, 12, 26]
export const HOME_TARGET = [0, 0, 0]

/** Camera distance from the Solar origin at which the map hands back to Earth. */
export const EARTH_RETURN_DISTANCE = 2.5
