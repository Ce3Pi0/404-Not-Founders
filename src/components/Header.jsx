import { formatYears } from '../lib/physics'

const STEPS = [
  { id: 'destination', label: 'Destination' },
  { id: 'flight', label: 'Flight plan' },
  { id: 'journey', label: 'Journey' },
  { id: 'debrief', label: 'Debrief' },
]

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 48 48" className="h-9 w-9 shrink-0" aria-hidden="true">
        <circle cx="24" cy="24" r="8" fill="#5ee7ff" opacity="0.9" />
        <circle cx="24" cy="24" r="8" fill="none" stroke="#5ee7ff" strokeWidth="1" opacity="0.4" />
        <ellipse
          cx="24"
          cy="24"
          rx="20"
          ry="7.5"
          fill="none"
          stroke="#ffb35c"
          strokeWidth="1.5"
          transform="rotate(-28 24 24)"
          opacity="0.9"
        />
        <circle cx="38.5" cy="15" r="2" fill="#ffb35c" />
      </svg>
      <div className="leading-tight">
        <div className="text-[13px] font-semibold tracking-[0.28em] text-ink uppercase">Beyond Time</div>
        <div className="text-[10px] tracking-[0.14em] text-muted uppercase">Interactive relativity</div>
      </div>
    </div>
  )
}

export default function Header({ step, sim, onAbout, onReset, inLab = false, onOpenLab }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-void/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 lg:px-8">
        <Brand />

        <nav aria-label="Mission stages" className="hidden items-center gap-1 md:flex">
          {STEPS.map((entry, index) => {
            const active = entry.id === step
            const passed = STEPS.findIndex((s) => s.id === step) > index
            return (
              <div
                key={entry.id}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] tracking-[0.12em] uppercase transition ${
                  active
                    ? 'bg-ion/10 text-ion'
                    : passed
                      ? 'text-ink/70'
                      : 'text-muted/60'
                }`}
              >
                <span
                  className={`num flex h-4 w-4 items-center justify-center rounded-full border text-[9px] ${
                    active ? 'border-ion/70 text-ion' : passed ? 'border-ink/30 text-ink/60' : 'border-line text-muted/60'
                  }`}
                >
                  {index + 1}
                </span>
                {entry.label}
              </div>
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
            onClick={onOpenLab}
            aria-pressed={inLab}
          >
            {inLab ? '← Mission' : 'Relativity Lab'}
          </button>
          <button type="button" className="btn px-3 py-1.5 text-xs" onClick={onAbout}>
            About
          </button>
          <button
            type="button"
            className="btn px-3 py-1.5 text-xs"
            onClick={onReset}
            disabled={sim.missions.length === 0}
          >
            Reset
          </button>
        </div>
      </div>
    </header>
  )
}
