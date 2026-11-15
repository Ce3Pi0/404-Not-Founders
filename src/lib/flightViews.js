// Camera perspectives and panel layouts for Live Flight.
//
// There is only ever one simulation: one progress fraction, one spacecraft
// position, one pair of clocks. A layout only decides which perspective each
// panel watches; orbit state is keyed by perspective, so re-arranging the
// panels never touches the journey or the camera framing.

export const PERSPECTIVES = [
  {
    id: 'external',
    label: "Bird's-eye",
    blurb: 'Follow from outside',
    detail:
      'Orbit the moving spacecraft from outside the route: both systems, the line already travelled and the ship on it.',
    interactive: true,
  },
  {
    id: 'observer',
    label: 'Departure observer',
    blurb: 'Watch it leave',
    detail:
      'A vantage near the departure system, watching the ship pull away with the reference-frame clock.',
    interactive: true,
  },
  {
    id: 'cockpit',
    label: 'Spacecraft cockpit',
    blurb: 'Forward view',
    detail:
      'First-person view from the ship, fixed forward, with the onboard proper-time clock and speed.',
    interactive: false,
  },
]

export const LAYOUTS = [
  { id: 'single', label: 'Single', blurb: 'One view' },
  { id: 'split', label: 'Split', blurb: 'Two views' },
  { id: 'triple', label: 'Triple', blurb: 'Three views' },
]

const BY_ID = new Map(PERSPECTIVES.map((entry) => [entry.id, entry]))

export function perspectiveById(id) {
  return BY_ID.get(id) ?? null
}

/** Panels for a layout. Multi-panel keys stay stable for the layout's lifetime. */
export function layoutViews(layout, single, split) {
  if (layout === 'split') {
    return [
      { key: 'split-0', perspective: split[0] },
      { key: 'split-1', perspective: split[1] },
    ]
  }
  if (layout === 'triple') {
    return [
      { key: 'triple-0', perspective: 'external' },
      { key: 'triple-1', perspective: 'observer' },
      { key: 'triple-2', perspective: 'cockpit' },
    ]
  }
  return [{ key: 'single', perspective: single }]
}

export function viewsInclude(views, perspective) {
  return views.some((view) => view.perspective === perspective)
}
