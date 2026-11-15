import { useEffect, useMemo, useRef, useState } from 'react'
import FlightStage from '../travel/flight/FlightStage'
import { layoutViews, LAYOUTS, PERSPECTIVES } from '../../lib/flightViews'
import { CHALLENGE_PATHS, navigate } from '../../lib/router'
import { useChallengeStore } from '../../store/challengeStore'
import {
  FAILURE_LABEL,
  PHASE_LABEL,
  STATUS,
  advanceExpedition,
  expeditionSummary,
  pauseExpedition,
  resumeExpedition,
} from '../../lib/challenge/engine'
import {
  formatChallengeYears,
  formatEnergyUnits,
} from '../../lib/challenge/physics'
import { formatNumber } from '../../lib/physics'
import ExpeditionHud from './ExpeditionHud'

const PUBLISH_INTERVAL_MS = 90

function FailurePanel({ expedition, summary, onRetry, onReconfigure, onDifferentRoute, onMenu, onReport }) {
  const failure = expedition.failure ?? {}
  const leg = expedition.route.legs[failure.legIndex ?? expedition.currentLegIndex] ?? null
  const energyFailure = failure.reason === 'energy'
  const heading = energyFailure
    ? 'EXPEDITION FAILED — ENERGY EXHAUSTED'
    : failure.reason === 'time'
      ? 'EXPEDITION FAILED — EARTH DEADLINE REACHED'
      : 'EXPEDITION FAILED — NO SURVEY COMPLETED'

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-void/80 p-3">
      <div className="panel max-h-full w-full max-w-2xl overflow-y-auto border-[#ff7a45]/60 bg-void/95 p-4 sm:p-5">
        <div className="text-[9px] tracking-[0.2em] text-[#ff9a70] uppercase">
          Expedition ended · {FAILURE_LABEL[failure.reason] ?? 'Failure'}
        </div>
        <h2 className="mt-1 text-lg leading-tight font-semibold tracking-tight text-[#ffd7c8] sm:text-xl">
          {heading}
        </h2>

        <p className="mt-2 text-[11.5px] leading-relaxed text-ink/75">
          {energyFailure ? (
            <>
              Your spacecraft exhausted its propulsion-energy budget during{' '}
              <span className="text-ink">
                {(PHASE_LABEL[failure.phase] ?? 'the manoeuvre').toLowerCase()}
              </span>{' '}
              on the journey from <span className="text-ink">{leg?.fromSystem ?? '—'}</span> to{' '}
              <span className="text-ink">{leg?.toSystem ?? '—'}</span>.
            </>
          ) : failure.reason === 'time' ? (
            <>
              Your expedition reached Earth’s time limit before you could return home, during{' '}
              <span className="text-ink">
                {(PHASE_LABEL[failure.phase] ?? 'the journey').toLowerCase()}
              </span>{' '}
              on the leg from <span className="text-ink">{leg?.fromSystem ?? '—'}</span> to{' '}
              <span className="text-ink">{leg?.toSystem ?? '—'}</span>.
            </>
          ) : (
            <>The spacecraft reached Earth without completing a single survey.</>
          )}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-line/50 bg-void/60 px-2.5 py-1.5">
            <div className="text-[7.5px] tracking-[0.14em] text-ink/45 uppercase">Surveyed</div>
            <div className="num text-[14px] text-[#5ee7ff]">{summary.surveyedCount}</div>
          </div>
          <div className="rounded-lg border border-line/50 bg-void/60 px-2.5 py-1.5">
            <div className="text-[7.5px] tracking-[0.14em] text-ink/45 uppercase">Distance flown</div>
            <div className="num text-[12px] text-ink">{formatNumber(summary.distanceLy, 2)} ly</div>
          </div>
          <div className="rounded-lg border border-line/50 bg-void/60 px-2.5 py-1.5">
            <div className="text-[7.5px] tracking-[0.14em] text-ink/45 uppercase">Energy left</div>
            <div className="num text-[12px] text-ink">
              {formatEnergyUnits(summary.energyRemaining, 6)} mc²
            </div>
          </div>
          <div className="rounded-lg border border-line/50 bg-void/60 px-2.5 py-1.5">
            <div className="text-[7.5px] tracking-[0.14em] text-ink/45 uppercase">Earth time left</div>
            <div className="num text-[12px] text-ink">
              {formatNumber(summary.earthTimeRemaining, 2)} yr
            </div>
          </div>
        </div>

        <div className="mt-2 space-y-1 rounded-lg border border-line/45 bg-void/50 px-3 py-2 text-[10px] text-ink/65">
          <div className="flex justify-between gap-3">
            <span>Current location</span>
            <span className="num text-ink">{summary.currentLocation.systemName}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Failed on</span>
            <span className="num text-ink">
              leg {Math.min((failure.legIndex ?? 0) + 1, expedition.route.legs.length)} of{' '}
              {expedition.route.legs.length} · {PHASE_LABEL[failure.phase] ?? '—'} ·{' '}
              {formatNumber((expedition.legProgress ?? 0) * 100, 1)}% of the leg
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Energy consumed</span>
            <span className="num text-ink">
              {formatEnergyUnits(summary.energySpent, 3)} of{' '}
              {formatEnergyUnits(summary.energyBudget, 3)} mc²
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Earth time elapsed</span>
            <span className="num text-ink">
              {formatNumber(summary.earthYears, 2)} of {formatNumber(summary.earthTimeBudget, 0)} yr
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Spacecraft proper time</span>
            <span className="num text-ink">{formatChallengeYears(summary.shipYears)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>
              Additional {energyFailure ? 'energy' : 'Earth time'} to finish the planned route
            </span>
            <span className="num text-[#ffb9a0]">
              {energyFailure
                ? `${formatEnergyUnits(summary.remaining.energy, 3)} mc²`
                : formatChallengeYears(summary.remaining.earthYears)}
            </span>
          </div>
        </div>

        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          <button type="button" className="btn btn-primary py-2 text-[11.5px]" onClick={onRetry}>
            Retry same route
          </button>
          <button type="button" className="btn py-2 text-[11.5px]" onClick={onReconfigure}>
            Reconfigure velocities
          </button>
          <button type="button" className="btn py-2 text-[11.5px]" onClick={onDifferentRoute}>
            Choose a different route
          </button>
          <button type="button" className="btn py-2 text-[11.5px]" onClick={onReport}>
            Full expedition report
          </button>
          <button type="button" className="btn py-2 text-[11.5px] sm:col-span-2" onClick={onMenu}>
            Return to main menu
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Live expedition. One requestAnimationFrame clock advances the single engine
 * state; the ship, the HUD and both clocks read from it. Playback time is
 * wall-clock seconds, so pausing freezes everything together.
 */
export default function ExpeditionFlight() {
  const expedition = useChallengeStore((state) => state.expedition)
  const retry = useChallengeStore((state) => state.retry)
  const reconfigureVelocities = useChallengeStore((state) => state.reconfigureVelocities)
  const chooseDifferentRoute = useChallengeStore((state) => state.chooseDifferentRoute)

  const engineRef = useRef(expedition)
  const publishedRef = useRef(expedition)
  const progressRef = useRef(expedition?.legProgress ?? 0)
  const [snapshot, setSnapshot] = useState(expedition)
  const [layout, setLayout] = useState('single')
  const [singleView, setSingleView] = useState('external')
  const [splitViews, setSplitViews] = useState(['external', 'observer'])
  const [delayed, setDelayed] = useState(true)

  const summary = useMemo(() => expeditionSummary(snapshot), [snapshot])
  const leg = snapshot?.route?.legs?.[snapshot.currentLegIndex] ?? null

  const publish = (next) => {
    publishedRef.current = next
    setSnapshot(next)
    useChallengeStore.setState({ expedition: next })
  }

  // A paused, resumed or retried run arriving from the store replaces the ref.
  useEffect(() => {
    if (!expedition || expedition === publishedRef.current) return
    publishedRef.current = expedition
    engineRef.current = expedition
    progressRef.current = expedition.legProgress ?? 0
    setSnapshot(expedition)
  }, [expedition])

  // The single simulation loop. It advances only while the expedition is active.
  useEffect(() => {
    if (snapshot?.status !== STATUS.ACTIVE) return undefined
    let frame
    let last = performance.now()
    let lastPublish = 0

    const loop = (now) => {
      const dt = Math.min(0.12, Math.max(0, (now - last) / 1000))
      last = now
      const current = engineRef.current
      const next = advanceExpedition(current, dt)
      if (next !== current) {
        engineRef.current = next
        progressRef.current = next.legProgress
        if (now - lastPublish > PUBLISH_INTERVAL_MS || next.status !== STATUS.ACTIVE) {
          lastPublish = now
          publish(next)
        }
      }
      if (engineRef.current.status === STATUS.ACTIVE) frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.status])

  // A completed stop or a successful return leaves the flight screen.
  useEffect(() => {
    if (!snapshot) return
    if (snapshot.status === STATUS.SURVEYING) navigate(CHALLENGE_PATHS.stop)
    else if (snapshot.status === STATUS.SUCCESS) navigate(CHALLENGE_PATHS.result)
  }, [snapshot?.status])

  if (!snapshot) return null

  const views = layoutViews(layout, singleView, splitViews)
  const originEntry = leg
    ? { name: leg.fromSystem, renderPosition: leg.fromPosition }
    : null
  const destinationEntry = leg
    ? { name: leg.toSystem, renderPosition: leg.toPosition }
    : null

  const clock = {
    earthYears: snapshot.earthTimeElapsed,
    shipYears: snapshot.shipTimeElapsed,
  }

  const paused = snapshot.status === STATUS.PAUSED
  const tone = (id) => (layout === id ? 'border-ion bg-ion/30 text-white' : '')

  const togglePause = () => {
    if (snapshot.status === STATUS.ACTIVE) publish(pauseExpedition(engineRef.current))
    else if (snapshot.status === STATUS.PAUSED) publish(resumeExpedition(engineRef.current))
  }

  const assignPerspective = (index, perspective) => {
    if (layout === 'single') {
      setSingleView(perspective)
      return
    }
    if (layout !== 'split') return
    setSplitViews((current) => {
      const next = [...current]
      const other = index === 0 ? 1 : 0
      if (next[other] === perspective) next[other] = next[index]
      next[index] = perspective
      return next
    })
  }

  return (
    <section className="screen space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">
            Expedition challenge · live flight
          </div>
          <h1 className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
            <span className="truncate">{leg?.fromSystem ?? 'Earth'}</span>
            <span className="text-ink/35">→</span>
            <span className="truncate">{leg?.toSystem ?? 'Earth'}</span>
          </h1>
          <p className="mt-1 text-[11px] text-ink/60">
            {leg ? (
              <>
                leg {snapshot.currentLegIndex + 1} of {snapshot.route.legs.length} ·{' '}
                {formatNumber(leg.distanceLy, 2)} ly · {leg.beta.toFixed(2)}c ·{' '}
                {PHASE_LABEL[snapshot.currentPhase]}
              </>
            ) : (
              'Preparing the expedition'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn px-3 py-1.5 text-[11px]"
            onClick={togglePause}
            disabled={!leg || snapshot.status === STATUS.FAILED}
            data-testid="flight-pause"
          >
            {snapshot.status === STATUS.ACTIVE ? 'Pause' : 'Resume'}
          </button>
          <button
            type="button"
            className="btn px-3 py-1.5 text-[11px]"
            onClick={() => {
              if (snapshot.status === STATUS.ACTIVE) publish(pauseExpedition(engineRef.current))
              navigate(CHALLENGE_PATHS.plan)
            }}
          >
            Route map
          </button>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="relative h-[64vh] min-h-[460px] w-full">
          <FlightStage
            views={views}
            layout={layout}
            origin={originEntry}
            destination={destinationEntry}
            beta={leg?.beta ?? 0.6}
            progressRef={progressRef}
            delayed={delayed}
            clock={clock}
            shipName={snapshot.shipName}
            onAssignPerspective={assignPerspective}
          />

          <ExpeditionHud expedition={snapshot} summary={summary} />

          {paused && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <div className="rounded-xl border border-line/60 bg-void/85 px-4 py-2 text-center backdrop-blur">
                <div className="text-[9px] tracking-[0.2em] text-ink/50 uppercase">Paused</div>
                <div className="mt-0.5 text-[13px] text-ink">Every clock is frozen</div>
              </div>
            </div>
          )}

          {snapshot.status === STATUS.FAILED && (
            <FailurePanel
              expedition={snapshot}
              summary={summary}
              onRetry={() => retry()}
              onReconfigure={() => {
                reconfigureVelocities()
                navigate(CHALLENGE_PATHS.plan)
              }}
              onDifferentRoute={() => {
                chooseDifferentRoute()
                navigate(CHALLENGE_PATHS.plan)
              }}
              onMenu={() => navigate('/')}
              onReport={() => navigate(CHALLENGE_PATHS.result)}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line/50 px-3 py-2">
          <span className="text-[8px] tracking-[0.16em] text-ink/45 uppercase">Layout</span>
          {LAYOUTS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`chip ${tone(entry.id)}`}
              onClick={() => setLayout(entry.id)}
            >
              {entry.label}
            </button>
          ))}

          <span className="ml-2 text-[8px] tracking-[0.16em] text-ink/45 uppercase">Camera</span>
          {PERSPECTIVES.map((entry) => {
            const selected =
              layout === 'single' ? singleView === entry.id : splitViews.includes(entry.id)
            return (
              <button
                key={entry.id}
                type="button"
                className={`chip ${selected ? 'border-[#5ee7ff]/70 text-[#c9f7ff]' : ''}`}
                onClick={() => assignPerspective(0, entry.id)}
                title={entry.detail}
              >
                {entry.label}
              </button>
            )
          })}

          <label className="ml-auto flex items-center gap-1.5 text-[10px] text-ink/60">
            <input
              type="checkbox"
              checked={delayed}
              onChange={(event) => setDelayed(event.target.checked)}
            />
            Delayed observer view
          </label>
        </div>
      </div>

      <p className="text-[9px] leading-relaxed text-ink/40">
        Burn sequences are a visualisation of idealised, short manoeuvres. Interstellar duration and
        crew proper time use the constant-speed equations for the selected velocity; the animation
        is not a relativistic acceleration trajectory. One simulation drives every camera panel.
      </p>
    </section>
  )
}
