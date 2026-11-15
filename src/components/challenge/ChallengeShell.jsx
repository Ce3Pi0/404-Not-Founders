import { useEffect } from 'react'
import { CHALLENGE_PATHS, navigate } from '../../lib/router'
import { useChallengeStore } from '../../store/challengeStore'
import { STATUS } from '../../lib/challenge/engine'
import ChallengeIntro from './ChallengeIntro'
import RoutePlanner from './RoutePlanner'
import ExpeditionFlight from './ExpeditionFlight'
import SurveyStop from './SurveyStop'
import ChallengeResult from './ChallengeResult'

const STEPS = [
  { id: 'intro', label: 'Setup', path: CHALLENGE_PATHS.intro },
  { id: 'plan', label: 'Route', path: CHALLENGE_PATHS.plan },
  { id: 'flight', label: 'Flight', path: CHALLENGE_PATHS.flight },
  { id: 'result', label: 'Result', path: CHALLENGE_PATHS.result },
]

function ChallengeBrand() {
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
        <div className="text-[13px] font-semibold tracking-[0.28em] text-ink uppercase">
          Beyond Time
        </div>
        <div className="text-[10px] tracking-[0.14em] text-ink/55 uppercase">
          Expedition challenge
        </div>
      </div>
    </div>
  )
}

/**
 * The challenge mode's own shell. Every screen reads the same persisted store,
 * so moving between planner, flight, survey and result never restarts a run.
 */
export default function ChallengeShell({ route }) {
  const expedition = useChallengeStore((state) => state.expedition)

  // A screen that needs a run redirects to the planner instead of showing an
  // empty shell. The running expedition is never touched by navigation.
  useEffect(() => {
    if (route === 'flight') {
      if (!expedition) {
        navigate(CHALLENGE_PATHS.plan, { replace: true })
        return
      }
      if (expedition.status === STATUS.SURVEYING) {
        navigate(CHALLENGE_PATHS.stop, { replace: true })
        return
      }
      // A failure keeps the frozen flight scene on screen so the player sees
      // exactly where the expedition stopped; only success moves on alone.
      if (expedition.status === STATUS.SUCCESS) {
        navigate(CHALLENGE_PATHS.result, { replace: true })
      }
    }
    if (route === 'stop') {
      if (!expedition) navigate(CHALLENGE_PATHS.plan, { replace: true })
      else if (expedition.status === STATUS.SUCCESS || expedition.status === STATUS.FAILED) {
        navigate(CHALLENGE_PATHS.result, { replace: true })
      } else if (expedition.status !== STATUS.SURVEYING) {
        navigate(CHALLENGE_PATHS.flight, { replace: true })
      }
    }
    if (route === 'result') {
      if (!expedition) navigate(CHALLENGE_PATHS.intro, { replace: true })
      else if (expedition.status !== STATUS.SUCCESS && expedition.status !== STATUS.FAILED) {
        navigate(
          expedition.status === STATUS.SURVEYING ? CHALLENGE_PATHS.stop : CHALLENGE_PATHS.flight,
          { replace: true },
        )
      }
    }
  }, [route, expedition])

  const exitToApp = () => navigate('/')

  const goStep = (id) => {
    if (id === 'flight' && !expedition) return
    if (id === 'result' && !expedition) return
    navigate(STEPS.find((step) => step.id === id)?.path ?? CHALLENGE_PATHS.intro)
  }

  const currentIndex = STEPS.findIndex((step) => step.id === route)

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-void/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 lg:px-8">
          <ChallengeBrand />

          <nav aria-label="Expedition stages" className="hidden items-center gap-2 md:flex">
            {STEPS.map((step, index) => {
              const active = step.id === route
              const passed = currentIndex > index
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goStep(step.id)}
                  aria-current={active ? 'step' : undefined}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] tracking-[0.12em] uppercase transition hover:bg-ion/50 ${
                    active ? 'bg-ion! text-white' : passed ? 'text-ink/70' : 'text-ink/40'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none font-semibold tracking-normal tabular-nums ${
                      active
                        ? 'border-white/70 text-white'
                        : passed
                          ? 'border-ink/40 text-ink/60'
                          : 'border-line/70 text-ink/40'
                    }`}
                  >
                    {index + 1}
                  </span>
                  {step.label}
                </button>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="btn px-3 py-1.5 text-xs" onClick={exitToApp}>
              ← Free exploration
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4 lg:px-8 lg:py-6">
        {route === 'intro' && <ChallengeIntro />}
        {route === 'plan' && <RoutePlanner />}
        {route === 'flight' && expedition && <ExpeditionFlight />}
        {route === 'stop' && expedition && <SurveyStop />}
        {route === 'result' && expedition && <ChallengeResult />}
      </main>

      <footer className="border-t border-line/50 px-4 py-4 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-1 text-[10px] text-ink/45 sm:flex-row">
          <span>404 Not Founders · Beyond Time · Expedition Challenge</span>
          <span>
            Physics: ideal relativistic burns, Newtonian escape energy, special-relativity clocks
          </span>
        </div>
      </footer>
    </div>
  )
}
