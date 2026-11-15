// Which star systems get a name label on the 3D universe map.
//
// Pure on purpose (no catalog import): the map scene owns the entries, so this
// module only decides their order and which ones survive the cap. That keeps
// the label rules unit-testable without Vite's `?raw` CSV loader.
//
// Rules, in priority order:
//   1. mandatory labels — the inspected system, the hovered system, the route's
//      origin and destination, the Solar System when it is the focus, and the
//      persistent names below. These are never dropped by the cap.
//   2. nearby systems fill whatever slots are left.
// A system is named at most once, however many roles it plays.

/** Cap on how many labels the map draws at once. */
export const LABEL_LIMIT = 12

/**
 * Systems that stay labelled whenever they are inside the drawn region, so a
 * hover on any other star cannot hide them. GJ 1061 is the closest system to
 * the Solar origin in the catalogue and the map's natural first landmark.
 */
export const PERSISTENT_LABEL_NAMES = ['GJ 1061']

/**
 * @param {object}   roles
 * @param {object[]} roles.selected    inspected system entry
 * @param {object[]} roles.hovered     hovered system entry
 * @param {object[]} roles.origin      route origin entry
 * @param {object[]} roles.destination route destination entry
 * @param {boolean}  roles.focusIsSolar true when the focused entry is the Sun's
 * @param {object[]} roles.nearby      nearest systems, used as fill
 * @param {object[]} roles.persistent  entries that are always labelled
 * @param {number}   roles.limit       label cap; mandatory labels ignore it
 */
export function labelSystems({
  selected = null,
  hovered = null,
  origin = null,
  destination = null,
  focusIsSolar = false,
  nearby = [],
  persistent = [],
  limit = LABEL_LIMIT,
} = {}) {
  const out = []
  const seen = new Set()

  const push = (entry, mandatory) => {
    if (!entry || seen.has(entry.name)) return
    if (!mandatory && out.length >= limit) return
    seen.add(entry.name)
    out.push(entry)
  }

  // Mandatory first, in reading order: where we are, what is inspected, what is
  // under the cursor, then the route's two ends and the persistent landmarks.
  push(selected, true)
  push(hovered, true)
  push(origin, true)
  push(destination, true)
  for (const entry of persistent) push(entry, true)

  for (const entry of nearby) push(entry, false)

  return out
}
