const CAMERAS = [
  {
    id: 'first',
    label: 'First-person',
    blurb: 'Inside the cabin',
    detail: 'Pilot-seat view: cockpit instruments, the planet below and the sky ahead.',
    icon: (
      <svg viewBox="0 0 28 28" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="14" cy="14" r="9" opacity="0.55" />
        <circle cx="14" cy="14" r="2.4" />
        <path d="M14 2.5v4M14 21.5v4M2.5 14h4M21.5 14h4" />
      </svg>
    ),
  },
  {
    id: 'second',
    label: 'Second-person',
    blurb: 'Tracking observer',
    detail: 'A nearby observer keeps the ship in frame as it leaves the planet.',
    icon: (
      <svg viewBox="0 0 28 28" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="18.5" cy="9" r="2" />
        <path d="M18.5 11.5 16 16l2 2 1 3.5" opacity="0.8" />
        <path d="M4 20c3.4-3 6.6-4.4 10-4.4 3.2 0 6.2 1 9 3.2" opacity="0.4" />
        <path d="M9.5 9.5 14 7.5l4.5 2-4.5 2.2z" />
        <path d="M14 7.5v8.3M12 16h4" opacity="0.6" />
      </svg>
    ),
  },
  {
    id: 'third',
    label: 'Third-person',
    blurb: 'Chase view',
    detail: 'Watch the whole spacecraft from behind at an adjustable range and angle.',
    icon: (
      <svg viewBox="0 0 28 28" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M14 6.5 18.5 12 14 10.6 9.5 12z" />
        <path d="M14 12v9.5" opacity="0.7" />
        <path d="M10 15.5 6.5 18M18 15.5 21.5 18" opacity="0.45" />
        <path d="M22 5.5h3M22 8.5h2M22 11.5h1" opacity="0.5" />
      </svg>
    ),
  },
  {
    id: 'bird',
    label: "Bird's-eye",
    blurb: 'System map',
    detail: 'Launch site, atmosphere, trajectory and destination from above. Drag to orbit, scroll to zoom.',
    icon: (
      <svg viewBox="0 0 28 28" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.4">
        <ellipse cx="14" cy="14" rx="11" ry="5.4" opacity="0.45" />
        <circle cx="5" cy="14" r="2.1" />
        <circle cx="23" cy="14" r="2.6" />
        <circle cx="15" cy="14" r="1.3" fill="currentColor" stroke="none" />
        <path d="M7 14h5" opacity="0.7" />
      </svg>
    ),
  },
]

export const CAMERA_VIEWS = CAMERAS.map(({ id, label }) => ({ id, label }))
export const cameraLabel = (id) => CAMERAS.find((camera) => camera.id === id)?.label ?? 'Third-person'

function CameraOption({ camera, active, disabled, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) onSelect(camera.id)
      }}
      title={camera.detail}
      className={`group flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${active
          ? 'border-ion/60 bg-ion/[0.08] text-ink shadow-[0_0_30px_-16px_rgba(94,231,255,0.9)]'
          : 'border-line/70 bg-white/[0.015] text-muted hover:border-ion/35 hover:text-ink'
        } ${disabled ? 'cursor-not-allowed opacity-45 hover:border-line/70' : ''}`}
    >
      <span className={active ? 'shrink-0 text-ion' : 'shrink-0 text-muted/80 group-hover:text-ion/80'}>
        {camera.icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold tracking-tight">{camera.label}</span>
          {active && <span className="h-1.5 w-1.5 rounded-full bg-ion" />}
        </span>
        <span className="mt-0.5 block text-[9px] tracking-[0.08em] text-muted/80 uppercase">
          {camera.blurb}
        </span>
      </span>
    </button>
  )
}

function SideSelect({ id, label, value, onChange }) {
  return (
    <label className="flex items-center gap-1.5 text-[9px] tracking-[0.12em] text-muted uppercase">
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-line bg-void/70 px-1.5 py-0.5 text-[10px] tracking-normal text-ink normal-case"
      >
        {CAMERA_VIEWS.map((camera) => (
          <option key={camera.id} value={camera.id}>
            {camera.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function CameraMenu({
  view,
  onChange,
  split,
  onSplitChange,
  viewA,
  viewB,
  onViewAChange,
  onViewBChange,
  chaseDistance,
  onChaseDistanceChange,
  cameraAngle,
  onCameraAngleChange,
}) {
  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="label">Camera</div>
          <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight">Viewing perspective</h2>
        </div>
        <span className="rounded-full border border-line bg-white/[0.02] px-2.5 py-1 text-[10px] text-muted">
          {split ? 'two live views' : 'one active'}
        </span>
      </div>

      <div role="radiogroup" aria-label="Camera perspective" className="mt-2.5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {CAMERAS.map((camera) => (
          <CameraOption
            key={camera.id}
            camera={camera}
            active={!split && camera.id === view}
            disabled={split}
            onSelect={onChange}
          />
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line/70 bg-void/40 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] tracking-[0.14em] text-muted uppercase">Camera distance</span>
            <span className="text-[11px] text-ink">{chaseDistance.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="4"
            max="26"
            step="0.5"
            value={chaseDistance}
            aria-label="Camera distance"
            className="slider mt-2"
            style={{ '--pct': `${((chaseDistance - 4) / 22) * 100}%` }}
            onChange={(event) => onChaseDistanceChange(Number(event.target.value))}
          />
        </div>
        <div className="rounded-xl border border-line/70 bg-void/40 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] tracking-[0.14em] text-muted uppercase">Viewing angle</span>
            <span className="text-[11px] text-ink">{Math.round((cameraAngle * 180) / Math.PI)}°</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="1.35"
            step="0.01"
            value={cameraAngle}
            aria-label="Viewing angle for the chase camera"
            className="slider mt-2"
            style={{ '--pct': `${((cameraAngle - 0.05) / 1.3) * 100}%` }}
            onChange={(event) => onCameraAngleChange(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-line/70 bg-void/40 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold">Split-screen A / B</span>
            <span className="rounded-full border border-violet/40 bg-violet/10 px-1.5 py-0.5 text-[9px] tracking-[0.1em] text-violet uppercase">
              two clocks
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-muted/80">
            Two windows on the same flight: Point A watches the departure, Point B the approach.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={split}
          aria-label="Split-screen A and B"
          onClick={() => onSplitChange(!split)}
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${split ? 'border-ion/70 bg-ion/25' : 'border-line bg-white/[0.05]'
            }`}
        >
          <span
            className={`absolute h-4 w-4 rounded-full transition-all ${split ? 'left-[24px] bg-ion shadow-[0_0_14px_rgba(94,231,255,0.9)]' : 'left-[3px] bg-muted/70'
              }`}
          />
        </button>
      </div>

      {split && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet/25 bg-violet/[0.05] px-3 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <SideSelect id="camera-a" label="A" value={viewA} onChange={onViewAChange} />
            <SideSelect id="camera-b" label="B" value={viewB} onChange={onViewBChange} />
          </div>
          <button type="button" className="btn shrink-0 px-2.5 py-1 text-[11px]" onClick={() => onSplitChange(false)}>
            Full screen
          </button>
        </div>
      )}
    </section>
  )
}
