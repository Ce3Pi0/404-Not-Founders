import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import UniverseScene from '../map/UniverseScene'
import PlanetStage from '../PlanetStage'
import { EARTH, SYSTEMS } from '../../lib/catalog'
import { REGION_SYSTEMS, SOLAR_SYSTEM } from '../../lib/starMap'
import { CHALLENGE_PATHS, navigate } from '../../lib/router'
import { useChallengeStore, useExpedition } from '../../store/challengeStore'
import { STATUS, expeditionSummary } from '../../lib/challenge/engine'
import {
  formatChallengeYears,
  formatEnergyUnits,
  formatSmallEnergy,
} from '../../lib/challenge/physics'
import { formatNumber } from '../../lib/physics'
import RouteStops from './RouteStops'

function Fact({ label, value, note, tone = 'default' }) {
  const color =
    tone === 'accent' ? 'text-[#5ee7ff]' : tone === 'warn' ? 'text-[#ffb9a0]' : 'text-ink'
  return (
    <div className="rounded-lg border border-line/45 bg-void/55 px-2.5 py-1.5">
      <div className="text-[7.5px] tracking-[0.14em] text-ink/45 uppercase">{label}</div>
      <div className={`num text-[11.5px] ${color}`}>{value}</div>
      {note && <div className="text-[7.5px] leading-tight text-ink/40">{note}</div>}
    </div>
  )
}

function routePathFor(expedition, succeeded) {
  const failureIndex = expedition.failure?.legIndex ?? null
  return expedition.route.legs.map((leg) => {
    let status = 'remaining'
    if (succeeded) status = 'done'
    else if (failureIndex != null && leg.index === failureIndex) status = 'failed'
    else if (failureIndex != null && leg.index < failureIndex) status = 'done'
    return { from: leg.fromPosition, to: leg.toPosition, status }
  })
}

function cameraForRoute(route) {
  const positions = route.stops.map((stop) => stop.position)
  if (positions.length === 0) return { position: [78, 58, 96], target: [0, 0, 0] }
  const center = [
    positions.reduce((sum, p) => sum + p[0], 0) / positions.length,
    positions.reduce((sum, p) => sum + p[1], 0) / positions.length,
    positions.reduce((sum, p) => sum + p[2], 0) / positions.length,
  ]
  const radius = Math.max(
    10,
    ...positions.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2])),
    Math.hypot(center[0], center[1], center[2]),
  )
  return {
    position: [center[0] + radius * 1.9, center[1] + radius * 1.3, center[2] + radius * 2.1],
    target: center,
  }
}

export default function ChallengeResult() {
  const expedition = useExpedition()
  const retry = useChallengeStore((state) => state.retry)
  const reconfigureVelocities = useChallengeStore((state) => state.reconfigureVelocities)
  const chooseDifferentRoute = useChallengeStore((state) => state.chooseDifferentRoute)
  const setPreset = useChallengeStore((state) => state.setPreset)

  const labelsRef = useRef(null)
  const scaleBarRef = useRef(null)
  const scaleTextRef = useRef(null)
  const cameraQuaternionRef = useRef(new THREE.Quaternion())
  const cameraState = useRef({ position: null, target: null })

  const summary = useMemo(
    () => (expedition ? expeditionSummary(expedition) : null),
    [expedition],
  )

  if (!expedition || !summary) return null

  const succeeded = expedition.status === STATUS.SUCCESS
  const failure = expedition.failure
  const route = expedition.route
  const view = cameraForRoute(route)
  const failedSystem = expedition.currentLocation?.systemName
  const failedEntry = failedSystem ? SYSTEMS.get(failedSystem) : null

  const stats = (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      <Fact label="Planets surveyed" value={String(summary.surveyedCount)} tone="accent" />
      <Fact label="Host systems" value={String(summary.systemsVisited)} />
      <Fact label="Distance flown" value={`${formatNumber(summary.distanceLy, 2)} ly`} />
      <Fact label="Earth elapsed" value={formatChallengeYears(summary.earthYears)} />
      <Fact label="Ship proper time" value={formatChallengeYears(summary.shipYears)} />
      <Fact
        label="Relativistic aging gap"
        value={formatChallengeYears(summary.agingGapYears)}
      />
      <Fact
        label="Starting energy"
        value={`${formatEnergyUnits(summary.energyBudget, 3)} mc²`}
      />
      <Fact
        label="Energy consumed"
        value={`${formatEnergyUnits(summary.energySpent, 3)} mc²`}
      />
      <Fact
        label="Gravitational escape"
        value={`${formatSmallEnergy(summary.gravitySpent)} mc²`}
        note="sum of surface departures"
      />
      <Fact
        label="Acceleration"
        value={`${formatEnergyUnits(summary.accelerationSpent, 3)} mc²`}
      />
      <Fact label="Braking" value={`${formatEnergyUnits(summary.brakingSpent, 3)} mc²`} />
      <Fact
        label="Remaining energy"
        value={`${formatEnergyUnits(summary.energyRemaining, 6)} mc²`}
        tone={summary.energyRemaining === 0 ? 'warn' : 'accent'}
      />
      <Fact
        label="Earth-time budget"
        value={`${formatNumber(summary.earthTimeBudget, 0)} yr`}
      />
      <Fact
        label="Remaining Earth time"
        value={formatChallengeYears(summary.earthTimeRemaining)}
        tone={summary.earthTimeRemaining === 0 ? 'warn' : 'accent'}
      />
    </div>
  )

  const buttons = succeeded ? (
    <div className="grid gap-1.5 sm:grid-cols-2">
      <button
        type="button"
        className="btn btn-primary py-2 text-[11.5px]"
        onClick={() => {
          retry()
          navigate(CHALLENGE_PATHS.flight)
        }}
      >
        Replay expedition
      </button>
      <button
        type="button"
        className="btn py-2 text-[11.5px]"
        onClick={() => {
          setPreset('expert')
          chooseDifferentRoute()
          navigate(CHALLENGE_PATHS.intro)
        }}
      >
        Try a harder challenge
      </button>
      <button
        type="button"
        className="btn py-2 text-[11.5px]"
        onClick={() => {
          chooseDifferentRoute()
          navigate(CHALLENGE_PATHS.plan)
        }}
      >
        Plan another expedition
      </button>
      <button
        type="button"
        className="btn py-2 text-[11.5px]"
        onClick={() => navigate('/')}
      >
        Explore universe
      </button>
    </div>
  ) : (
    <div className="grid gap-1.5 sm:grid-cols-2">
      <button
        type="button"
        className="btn btn-primary py-2 text-[11.5px]"
        onClick={() => {
          retry()
          navigate(CHALLENGE_PATHS.flight)
        }}
      >
        Retry same route
      </button>
      <button
        type="button"
        className="btn py-2 text-[11.5px]"
        onClick={() => {
          reconfigureVelocities()
          navigate(CHALLENGE_PATHS.plan)
        }}
      >
        Reconfigure velocities
      </button>
      <button
        type="button"
        className="btn py-2 text-[11.5px]"
        onClick={() => {
          chooseDifferentRoute()
          navigate(CHALLENGE_PATHS.plan)
        }}
      >
        Choose a different route
      </button>
      <button
        type="button"
        className="btn py-2 text-[11.5px]"
        onClick={() => navigate('/')}
      >
        Return to main menu
      </button>
    </div>
  )

  const report = (
    <>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="rounded-xl border border-[#5ee7ff]/50 bg-[#5ee7ff]/8 px-3 py-2">
          <div className="text-[8px] tracking-[0.14em] text-ink/50 uppercase">
            Energy to spare
          </div>
          <div className="num mt-0.5 text-[18px] leading-none text-[#5ee7ff]">
            {formatEnergyUnits(summary.energyRemaining, 3)}
            <span className="ml-1 text-[9px] text-ink/55">mc²</span>
          </div>
        </div>
        <div className="rounded-xl border border-[#5ee7ff]/50 bg-[#5ee7ff]/8 px-3 py-2">
          <div className="text-[8px] tracking-[0.14em] text-ink/50 uppercase">
            Earth time to spare
          </div>
          <div className="num mt-0.5 text-[18px] leading-none text-[#5ee7ff]">
            {formatNumber(summary.earthTimeRemaining, 2)}
            <span className="ml-1 text-[9px] text-ink/55">yr</span>
          </div>
        </div>
      </div>

      {stats}

      <div className="mt-3 rounded-xl border border-line/45 bg-void/50 px-3 py-2">
        <div className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">
          Expedition route
        </div>
        <div className="mt-1">
          <RouteStops
            route={route}
            surveyedIds={summary.surveyedPlanetIds}
            failedLegIndex={
              failure?.reason === 'time' && failure.legIndex != null ? failure.legIndex : null
            }
          />
        </div>
      </div>

      <div className="mt-3">{buttons}</div>
    </>
  )

  return (
    <section className="screen space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">
            Expedition challenge · {succeeded ? 'mission complete' : 'expedition report'}
          </div>
          <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            {succeeded ? 'Home again' : 'Expedition report'}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn px-3 py-1.5 text-[11px]"
            onClick={() => navigate(CHALLENGE_PATHS.plan)}
          >
            Route planner
          </button>
          <button
            type="button"
            className="btn px-3 py-1.5 text-[11px]"
            onClick={() => navigate('/')}
          >
            Free exploration
          </button>
        </div>
      </div>

      {succeeded ? (
        <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="panel overflow-hidden">
            <PlanetStage
              planet={EARTH}
              earthYears={summary.earthYears}
              alienYears={summary.earthYears}
              compact
            />
          </div>

          <div className="panel border-[#5ee7ff]/45 bg-void/92 p-4 sm:p-5">
            <div className="text-[9px] tracking-[0.2em] text-[#5ee7ff] uppercase">
              Arrival · Earth
            </div>
            <h2 className="mt-1 text-[24px] leading-tight font-semibold tracking-tight text-white sm:text-[28px]">
              CONGRATULATIONS, EXPLORER!
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-ink/80">
              Congratulations! You successfully surveyed{' '}
              <span className="num text-[#5ee7ff]">{summary.surveyedCount}</span> exoplanet
              {summary.surveyedCount === 1 ? '' : 's'} across{' '}
              <span className="num text-[#5ee7ff]">{summary.systemsVisited}</span> star{' '}
              {summary.systemsVisited === 1 ? 'system' : 'systems'} and returned safely to Earth.
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink/80">
              You completed your expedition with{' '}
              <span className="num text-[#5ee7ff]">
                {formatEnergyUnits(summary.energyRemaining, 3)}
              </span>{' '}
              mc² energy units and{' '}
              <span className="num text-[#5ee7ff]">
                {formatNumber(summary.earthTimeRemaining, 2)}
              </span>{' '}
              Earth years to spare.
            </p>
            <div className="num mt-3 text-[34px] leading-none font-semibold text-[#5ee7ff]">
              {summary.surveyedCount}
              <span className="ml-2 text-[11px] tracking-[0.14em] text-ink/55 uppercase">
                planets surveyed
              </span>
            </div>
            {report}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="panel overflow-hidden">
            <div className="relative h-[62vh] min-h-[460px] w-full">
              <UniverseScene
                systems={REGION_SYSTEMS}
                pickTargets={[]}
                labels={[]}
                labelsRef={labelsRef}
                scaleBarRef={scaleBarRef}
                scaleTextRef={scaleTextRef}
                cameraQuaternionRef={cameraQuaternionRef}
                selected={null}
                hovered={null}
                resetSignal={0}
                cameraState={cameraState}
                focus={null}
                onSelect={() => {}}
                onHover={() => {}}
                routePath={routePathFor(expedition, false)}
                view={view}
                maxDistance={1200}
              />

              <div className="absolute inset-0 flex items-center justify-center bg-void/40 p-3">
                <div className="panel max-h-full w-full max-w-2xl overflow-y-auto border-[#ff7a45]/60 bg-void/95 p-4">
                  <div className="text-[9px] tracking-[0.2em] text-[#ff9a70] uppercase">
                    Expedition ended
                  </div>
                  <h2 className="mt-1 text-xl leading-tight font-semibold tracking-tight text-[#ffd7c8]">
                    {failure?.reason === 'energy'
                      ? 'EXPEDITION FAILED — ENERGY EXHAUSTED'
                      : failure?.reason === 'time'
                        ? 'EXPEDITION FAILED — EARTH DEADLINE REACHED'
                        : 'EXPEDITION FAILED — NO SURVEY COMPLETED'}
                  </h2>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-ink/75">
                    {failure?.reason === 'energy'
                      ? `Your spacecraft exhausted its propulsion-energy budget during ${(
                          failure.phase ?? 'the manoeuvre'
                        ).toLowerCase()} on the journey from ${
                          route.legs[failure.legIndex]?.fromSystem ?? '—'
                        } to ${route.legs[failure.legIndex]?.toSystem ?? '—'}.`
                      : failure?.reason === 'time'
                        ? 'Your expedition reached Earth’s time limit before you could return home.'
                        : 'The spacecraft reached Earth without completing a single survey, so the expedition does not count as a success.'}
                  </p>
                  <p className="mt-1 text-[11px] text-ink/65">
                    You surveyed {summary.surveyedCount} planet
                    {summary.surveyedCount === 1 ? '' : 's'} across {summary.systemsVisited}{' '}
                    system{summary.systemsVisited === 1 ? '' : 's'} before the expedition ended.
                  </p>

                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <div className="rounded-xl border border-[#ff7a45]/50 bg-[#ff7a45]/10 px-3 py-2">
                      <div className="text-[8px] tracking-[0.14em] text-ink/50 uppercase">
                        Energy remaining
                      </div>
                      <div className="num mt-0.5 text-[16px] leading-none text-[#ffd7c8]">
                        {formatEnergyUnits(summary.energyRemaining, 6)} mc²
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#ff7a45]/50 bg-[#ff7a45]/10 px-3 py-2">
                      <div className="text-[8px] tracking-[0.14em] text-ink/50 uppercase">
                        Earth time remaining
                      </div>
                      <div className="num mt-0.5 text-[16px] leading-none text-[#ffd7c8]">
                        {formatNumber(summary.earthTimeRemaining, 2)} yr
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 rounded-lg border border-line/45 bg-void/50 px-3 py-2 text-[10px] text-ink/65">
                    <div className="flex justify-between gap-2">
                      <span>Stopped at</span>
                      <span className="num text-ink">
                        {summary.currentLocation.systemName}
                        {failedEntry ? ` · ${failedEntry.planets.length} worlds` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Additional resources required</span>
                      <span className="num text-ink">
                        {failure?.reason === 'energy'
                          ? `${formatEnergyUnits(summary.remaining.energy, 3)} mc²`
                          : formatChallengeYears(summary.remaining.earthYears)}
                      </span>
                    </div>
                  </div>

                  {report}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
