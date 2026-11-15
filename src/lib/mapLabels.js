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

/** Rough on-screen width of a star label, in CSS pixels, from its text. */
export function labelExtent(name, isHome = false) {
  return Math.max(54, (name?.length ?? 0) * 6.4 + 20 + (isHome ? 34 : 0))
}

/** Axis-aligned overlap test with a breathing margin between labels. */
export function boxesOverlap(a, b, pad = 4) {
  return (
    Math.abs(a.x - b.x) * 2 < a.width + b.width + pad * 2 &&
    Math.abs(a.y - b.y) * 2 < a.height + b.height + pad * 2
  )
}

/**
 * Decide which projected labels can be drawn without colliding. Input order is
 * priority order (mandatory roles first, see `labelSystems`), and a label that
 * would land on a higher-priority one is dropped rather than stacked into an
 * unreadable pile. Pure, so the placement rule is unit-tested.
 */
export function pickVisibleLabels(boxes, pad = 4) {
  const kept = []
  return boxes.map((box) => {
    if (kept.some((other) => boxesOverlap(box, other, pad))) return false
    kept.push(box)
    return true
  })
}
