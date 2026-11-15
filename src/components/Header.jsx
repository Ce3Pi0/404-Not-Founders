import { formatYears } from '../lib/physics'
import { STEPS, isStageReachable, useAppStore } from '../store/appStore'

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 48 48" className="h-9 w-9 shrink-0" aria-hidden="true">
        <circle cx="24" cy="24" r="8" fill="#9a0680" />
        <ellipse
          cx="24"
          cy="24"
          rx="20"
          ry="7.5"
          fill="none"
          stroke="#79018c"
          strokeWidth="1.8"
          transform="rotate(-28 24 24)"
        />
        <circle cx="38.5" cy="15" r="2.4" fill="#ffffff" />
      </svg>
      <div className="leading-tight">
        <div className="text-[13px] font-semibold tracking-[0.28em] text-ink uppercase">Beyond Time</div>
        <div className="text-[10px] tracking-[0.14em] text-ink/55 uppercase">Interactive relativity</div>
      </div>
    </div>
  )
}

export default function Header() {
  const step = useAppStore((state) => state.step)
  const sim = useAppStore((state) => state.sim)
  const location = useAppStore((state) => state.location)
  const mission = useAppStore((state) => state.mission)
  const goToStep = useAppStore((state) => state.goToStep)
  const toggleLab = useAppStore((state) => state.toggleLab)
  const openAbout = useAppStore((state) => state.openAbout)
  const reset = useAppStore((state) => state.reset)
  const inLab = step === 'lab'
  const away = location && location.kind !== 'earth'

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-void/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 lg:px-8">
        <Brand />

        {(location || away) && (
          <div className="hidden min-w-0 items-center gap-2 rounded-lg border border-line/60 bg-panel/25 px-3 py-1.5 sm:flex">
            <div className="min-w-0">
              <div className="text-[9px] tracking-[0.16em] text-ink/45 uppercase">Current location</div>
              <div className="truncate text-[11px] text-ink">{location?.name}</div>
            </div>
          </div>
        )}

        <nav aria-label="Mission stages" className="hidden items-center gap-2 md:flex">
          {STEPS.map((entry, index) => {
            const active = entry.id === step
            const passed = STEPS.findIndex((s) => s.id === step) > index
            const reachable = isStageReachable(mission, entry.id)
            return (
              <button
                type="button"
                key={entry.id}
                onClick={() => goToStep(entry.id)}
                disabled={!reachable}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] tracking-[0.12em] uppercase transition enabled:hover:bg-ion/50 enabled:hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'bg-ion! text-white' : passed ? 'text-ink/70' : 'text-ink/40'
                  }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none font-semibold tabular-nums tracking-normal ${active ? 'border-white/70 text-white' : passed ? 'border-ink/40 text-ink/60' : 'border-line/70 text-ink/40'
                    }`}
                >
                  {index + 1}
                </span>
                {entry.label}
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {!inLab && (
            <div className="hidden items-center gap-3 rounded-lg border border-line/70 bg-white/[0.02] px-3 py-1.5 sm:flex">
              <div>
                <div className="text-[9px] tracking-[0.16em] text-muted uppercase">Earth</div>
                <div className="num text-[11px] text-ink">{formatYears(sim.earthYears)}</div>
              </div>
              <div className="h-6 w-px bg-line" />
              <div>
                <div className="text-[9px] tracking-[0.16em] text-muted uppercase">Ship</div>
                <div className="num text-[11px] text-ion">{formatYears(sim.shipYears)}</div>
              </div>
            </div>
          )}
          <button
            type="button"
            className={`btn px-3 py-1.5 text-xs ${inLab ? 'btn-primary' : ''}`}
            onClick={toggleLab}
            aria-pressed={inLab}
          >
            {inLab ? '← Mission' : 'Relativity Lab'}
          </button>
          <button type="button" className="btn px-3 py-1.5 text-xs" onClick={openAbout}>
            About
          </button>
          <button
            type="button"
            className="btn px-3 py-1.5 text-xs"
            onClick={reset}
            disabled={sim.missions.length === 0}
          >
            Reset
          </button>
        </div>
      </div>
    </header>
  )
}
