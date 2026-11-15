import { useCallback, useEffect, useRef } from 'react'
import { CockpitOverlay } from './FlightHud'
import InfoTip from './InfoTip'
import {
  PERSPECTIVES,
  perspectiveById,
} from '../../../lib/flightViews'
import { clampOrbitPitch, clampOrbitZoom, freshOrbit } from './cameraMath'
import { formatYears } from '../../../lib/physics'

const DRAG_SENSITIVITY = 0.007

function ClockChip({ perspective, clock }) {
  const label = perspective === 'cockpit' ? 'SHIP' : 'REF'
  const years = perspective === 'cockpit' ? clock.shipYears : clock.earthYears
  return (
    <span
      className="num shrink-0 rounded-full border border-line/60 bg-void/85 px-2 py-1 text-[10px] text-ink/75 backdrop-blur"
      title={perspective === 'cockpit' ? 'Spacecraft proper time' : 'Departure reference frame'}
    >
      {label} {formatYears(years)}
    </span>
  )
}

/**
 * One panel of the flight stage. It owns no simulation state: the clocks come
 * from the page, the picture comes from the shared scene, and gestures only
 * move this perspective's own orbit so the other panels are unaffected.
 */
export default function FlightViewport({
  view,
  index,
  layout,
  views,
  clock,
  shipName,
  delayed,
  orbitRef,
  registerPanel,
  onAssignPerspective,
}) {
  const meta = perspectiveById(view.perspective)
  const interactive = Boolean(meta?.interactive)
  const assignable = layout === 'split' && Boolean(onAssignPerspective)
  const element = useRef(null)
  const drag = useRef(null)

  const attach = useCallback(
    (node) => {
      element.current = node
      registerPanel(view.key, node)
    },
    [view.key, registerPanel],
  )

  useEffect(
    () => () => {
      registerPanel(view.key, null)
    },
    [view.key, registerPanel],
  )

  // Zoom with the wheel. A native listener keeps preventDefault available.
  useEffect(() => {
    const node = element.current
    if (!node || !interactive) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      const orbit = orbitRef.current[view.perspective]
      if (!orbit) return
      orbit.zoom = clampOrbitZoom(orbit.zoom * Math.exp(event.deltaY * 0.0012))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [interactive, orbitRef, view.perspective])

  const orbit = (deltaYaw, deltaPitch) => {
    const state = orbitRef.current[view.perspective]
    if (!state) return
    state.yaw += deltaYaw
    state.pitch = clampOrbitPitch(state.pitch - deltaPitch)
  }

  const resetView = (event) => {
    event.stopPropagation()
    if (orbitRef.current[view.perspective]) {
      orbitRef.current[view.perspective] = freshOrbit(view.perspective)
    }
  }

  const onPointerDown = (event) => {
    if (!interactive || event.button !== 0) return
    drag.current = { x: event.clientX, y: event.clientY }
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      // Pointer capture is unavailable (synthetic or already-released pointer);
      // dragging still works from the move event.
    }
  }

  const onPointerMove = (event) => {
    if (!drag.current) return
    const deltaX = event.clientX - drag.current.x
    const deltaY = event.clientY - drag.current.y
    drag.current = { x: event.clientX, y: event.clientY }
    orbit(deltaX * DRAG_SENSITIVITY, deltaY * DRAG_SENSITIVITY)
  }

  const onPointerUp = (event) => {
    if (!drag.current) return
    drag.current = null
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    } catch {
      // Nothing to release for a synthetic pointer.
    }
  }

  return (
    <div
      ref={attach}
      role="group"
      aria-label={`${meta?.label ?? view.perspective} view`}
      title={
        interactive
          ? `${meta?.detail ?? ''} Drag to orbit · scroll to zoom · double-click to reset this view.`
          : meta?.detail
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={interactive ? resetView : undefined}
      className={`relative select-none ${interactive ? 'touch-none' : ''}`}
      style={{ cursor: interactive ? 'grab' : 'default' }}
    >
      <div className="pointer-events-none absolute inset-0 border border-line/40 bg-void/10" />

      <div
        className="absolute inset-x-2 top-2 z-20 flex items-start justify-between gap-1.5"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 items-center gap-1">
          {assignable ? (
            <select
              aria-label={`Camera for panel ${index + 1}`}
              value={view.perspective}
              onChange={(event) => onAssignPerspective(index, event.target.value)}
              className="max-w-[150px] truncate rounded-full border border-line/70 bg-void/85 px-2 py-1 text-[10px] text-ink backdrop-blur"
            >
              {PERSPECTIVES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate rounded-full border border-line/70 bg-void/85 px-2 py-1 text-[10px] text-ink backdrop-blur">
              {meta?.label ?? view.perspective}
            </span>
          )}

          {interactive && (
            <button
              type="button"
              onClick={resetView}
              aria-label="Reset this view"
              title="Reset this view"
              className="flex h-5 w-5 items-center justify-center rounded-full border border-line/60 bg-void/85 text-[10px] leading-none text-ink/60 backdrop-blur transition hover:border-ion hover:text-ink"
            >
              ⟲
            </button>
          )}

          {view.perspective === 'observer' && (
            <InfoTip
              label="Why this view can lag behind the simulation"
              align="left"
            >
              Light leaving the ship needs time to reach the departure system, so the image arriving
              there shows where the ship was, not where it is. The white marker sits at the retarded
              position from the mission's own flight time: <em>p / (1 + β)</em>, solved from the
              light-travel equation — not an illustrative guess.
            </InfoTip>
          )}
        </div>

        <ClockChip perspective={view.perspective} clock={clock} />
      </div>

      {view.perspective === 'observer' && delayed && (
        <span className="pointer-events-none absolute top-11 left-2 z-10 rounded-full border border-ion/50 bg-ion/20 px-2 py-0.5 text-[8px] tracking-[0.1em] text-ink/80 uppercase backdrop-blur">
          Delayed light marker
        </span>
      )}

      {view.perspective === 'cockpit' && (
        <CockpitOverlay clock={clock} shipName={shipName} compact={views.length > 1} />
      )}
    </div>
  )
}
