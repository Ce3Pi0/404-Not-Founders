import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import PlanetaryScene from '../map/PlanetaryScene'
import { SYSTEMS, planetById } from '../../lib/catalog'
import { buildPlanetSystem, daysPerSecond, formatAu, systemFraming } from '../../lib/planetSystem'
import { classifyPlanet } from '../../lib/planet'
import { CHALLENGE_PATHS, navigate } from '../../lib/router'
import { useChallengeStore, useExpedition } from '../../store/challengeStore'
import {
  STATUS,
  currentLeg,
  expeditionSummary,
} from '../../lib/challenge/engine'
import {
  BETA_MAX,
  BETA_MIN,
  SURVEY_YEARS,
  departureProfile,
  formatChallengeYears,
  formatEnergyUnits,
  formatSmallEnergy,
} from '../../lib/challenge/physics'
import { formatNumber } from '../../lib/physics'

function Field({ label, value, note }) {
  return (
    <div className="rounded-lg border border-line/45 bg-void/50 px-2.5 py-1.5">
      <div className="text-[7.5px] tracking-[0.14em] text-ink/45 uppercase">{label}</div>
      <div className="num text-[11.5px] text-ink/90">{value}</div>
      {note && <div className="text-[8px] leading-tight text-ink/40">{note}</div>}
    </div>
  )
}

/** One local survey stop: inspect the system, scan worlds, then continue. */
export default function SurveyStop() {
  const expedition = useExpedition()
  const survey = useChallengeStore((state) => state.survey)
  const continueFlight = useChallengeStore((state) => state.continueFlight)
  const pause = useChallengeStore((state) => state.pause)
  const returnToEarthNow = useChallengeStore((state) => state.returnToEarthNow)

  const systemName = expedition?.currentLocation?.systemName ?? 'Solar System'
  const entry = useMemo(() => SYSTEMS.get(systemName) ?? null, [systemName])
  const system = useMemo(() => (entry ? buildPlanetSystem(entry) : null), [entry])
  const framing = useMemo(() => (system ? systemFraming(system) : null), [system])

  const [selectedId, setSelectedId] = useState(expedition?.currentLocation?.planetId ?? null)
  const [focus, setFocus] = useState(null)
  const [showNext, setShowNext] = useState(false)
  const [homeBeta, setHomeBeta] = useState(0.7)
  const [homeOpen, setHomeOpen] = useState(false)

  const labelsRef = useRef(null)
  const scaleBarRef = useRef(null)
  const scaleTextRef = useRef(null)
  const cameraQuaternionRef = useRef(new THREE.Quaternion())
  const focusNonce = useRef(0)

  useEffect(() => {
    if (!expedition) return
    if (expedition.status === STATUS.FAILED || expedition.status === STATUS.SUCCESS) {
      navigate(CHALLENGE_PATHS.result, { replace: true })
    }
  }, [expedition?.status])

  if (!expedition || !entry || !system) {
    return (
      <section className="screen panel p-6">
        <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">Survey stop</div>
        <h1 className="mt-1 text-xl font-semibold">No expedition in progress</h1>
        <button
          type="button"
          className="btn mt-3 px-3 py-1.5 text-[12px]"
          onClick={() => navigate(CHALLENGE_PATHS.plan)}
        >
          ← Route planner
        </button>
      </section>
    )
  }

  const summary = expeditionSummary(expedition)
  const leg = currentLeg(expedition)
  const nextLeg = expedition.route.legs[expedition.currentLegIndex + 1] ?? null
  const selectedPlanet = selectedId ? planetById(selectedId) : null
  const surveyed = new Set(expedition.surveyedPlanetIds)
  const surveyedHere = summary.surveyedCount
  const timeRemaining = summary.earthTimeRemaining
  const surveyAffordable = timeRemaining > SURVEY_YEARS

  const planetsHere = system.bodies.map((body) => body.planet)
  const uncharted = system.uncharted ?? []

  const selectPlanet = (planet) => {
    if (!planet) return
    setSelectedId(planet.id)
    if (system.bodies.some((body) => body.planet.id === planet.id)) {
      focusNonce.current += 1
      setFocus({ id: planet.id, nonce: focusNonce.current })
    }
  }

  const onScan = () => {
    if (!selectedPlanet) return
    survey(selectedPlanet.id)
  }

  const onContinue = () => {
    continueFlight()
    navigate(CHALLENGE_PATHS.flight)
  }

  const toRouteMap = () => {
    pause()
    navigate(CHALLENGE_PATHS.plan)
  }

  const profile = selectedPlanet ? departureProfile(selectedPlanet) : null
  const look = selectedPlanet ? classifyPlanet(selectedPlanet) : null
  const isSurveyed = selectedPlanet ? surveyed.has(selectedPlanet.id) : false
  const plannedSurveysLeft = Math.max(
    0,
    (expedition.route.plannedSurveys ?? 0) - summary.surveyedCount,
  )

  return (
    <section className="screen space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] tracking-[0.18em] text-ink/45 uppercase">
            Expedition challenge · survey stop
          </div>
          <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            {systemName}
          </h1>
          <p className="mt-1 text-[11px] text-ink/65">
            Arrived from {leg?.fromSystem ?? '—'} at {leg?.beta.toFixed(2)}c ·{' '}
            {formatNumber(leg?.distanceLy ?? 0, 2)} ly · Earth clock{' '}
            {formatChallengeYears(summary.earthYears)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line/60 bg-void/60 px-3 py-2">
          <div>
            <div className="text-[7.5px] tracking-[0.14em] text-ink/45 uppercase">
              Earth time left
            </div>
            <div className="num text-[13px] text-ink">
              {formatNumber(timeRemaining, 2)} yr
            </div>
          </div>
          <div className="h-7 w-px bg-line" />
          <div>
            <div className="text-[7.5px] tracking-[0.14em] text-ink/45 uppercase">Energy left</div>
            <div className="num text-[13px] text-ink">
              {formatEnergyUnits(summary.energyRemaining, 4)} mc²
            </div>
          </div>
          <div className="h-7 w-px bg-line" />
          <div>
            <div className="text-[7.5px] tracking-[0.14em] text-ink/45 uppercase">Surveyed</div>
            <div className="num text-[13px] text-[#5ee7ff]">{surveyedHere}</div>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="panel overflow-hidden">
          <div className="relative h-[56vh] min-h-[420px] w-full">
            <PlanetaryScene
              system={system}
              framing={framing}
              selectedId={selectedId}
              focus={focus}
              orbitsOn
              labelsOn={false}
              timeScale={daysPerSecond(0.5)}
              paused={false}
              labelsRef={labelsRef}
              scaleBarRef={scaleBarRef}
              scaleTextRef={scaleTextRef}
              cameraQuaternionRef={cameraQuaternionRef}
              resetSignal={0}
              onSelect={selectPlanet}
            />

            <div className="pointer-events-none absolute top-3 left-3 z-20 rounded-xl border border-line/50 bg-void/88 px-3 py-2 backdrop-blur">
              <div className="text-[8px] tracking-[0.16em] text-ink/45 uppercase">Local system</div>
              <div className="text-[13px] text-ink">{system.star.name}</div>
              <div className="mt-0.5 text-[9px] text-ink/50">
                {systemName} · orbit scale in AU · click a world to inspect
              </div>
            </div>

            <div className="absolute right-3 bottom-3 z-20 flex max-w-[70%] flex-wrap justify-end gap-1.5">
              {[...planetsHere, ...uncharted].map((planet) => {
                const active = planet.id === selectedId
                const done = surveyed.has(planet.id)
                return (
                  <button
                    key={planet.id}
                    type="button"
                    className={`chip ${active ? 'border-[#5ee7ff]/80 text-[#c9f7ff]' : ''} ${
                      done ? 'border-ion/70' : ''
                    }`}
                    onClick={() => selectPlanet(planet)}
                  >
                    {done ? '✓ ' : ''}
                    {planet.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="panel p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[8px] tracking-[0.16em] text-ink/45 uppercase">
                  {isSurveyed ? 'Survey completed' : 'Selected world'}
                </div>
                <h2 className="truncate text-lg leading-tight font-semibold">
                  {selectedPlanet?.name ?? systemName}
                </h2>
                <div className="text-[9.5px] text-ink/50">
                  {selectedPlanet
                    ? `${selectedPlanet.star} · ${look?.label ?? 'world'}`
                    : 'Select a world in the system'}
                </div>
              </div>
              {isSurveyed && (
                <span className="chip border-[#5ee7ff]/70 text-[#c9f7ff]">Surveyed</span>
              )}
            </div>

            {selectedPlanet ? (
              <>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <Field
                    label="Radius"
                    value={
                      selectedPlanet.radiusEarthMeasured != null
                        ? `${formatNumber(selectedPlanet.radiusEarthMeasured, 2)} R⊕`
                        : 'unmeasured'
                    }
                    note={
                      selectedPlanet.radiusEarthMeasured != null
                        ? 'NASA archive pl_rade'
                        : 'no surface modelled'
                    }
                  />
                  <Field
                    label="Mass"
                    value={
                      selectedPlanet.massEarthMeasured != null
                        ? `${formatNumber(selectedPlanet.massEarthMeasured, 2)} M⊕`
                        : 'unmeasured'
                    }
                    note={selectedPlanet.massSource ?? 'no archive value'}
                  />
                  <Field
                    label="Orbital period"
                    value={
                      selectedPlanet.orbitalPeriodDays != null
                        ? `${formatNumber(selectedPlanet.orbitalPeriodDays, 1)} d`
                        : 'unknown'
                    }
                  />
                  <Field
                    label="Orbit"
                    value={
                      selectedPlanet.semiMajorAxisAu != null
                        ? formatAu(selectedPlanet.semiMajorAxisAu)
                        : 'uncharted'
                    }
                  />
                </div>

                <div className="mt-2 rounded-lg border border-line/45 bg-void/50 px-2.5 py-1.5 text-[9px] leading-relaxed text-ink/55">
                  <div className="flex justify-between gap-2">
                    <span>Departure from here</span>
                    <span className="num text-ink/85">
                      {profile?.surface
                        ? `surface · ${formatSmallEnergy(profile.cost)} mc²`
                        : 'orbital · no escape charge'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-ink/40">{profile?.reason}</div>
                  {profile?.surface && selectedPlanet.massIsMinimum && (
                    <div className="mt-0.5 text-[8.5px] text-[#ffb9a0]">
                      Mass is a minimum estimate (M sin i), so this escape cost is a lower bound.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-primary mt-2 w-full py-2 text-[12px]"
                  onClick={onScan}
                  disabled={isSurveyed}
                  data-testid="scan-planet"
                >
                  {isSurveyed ? 'Survey completed' : 'Scan planet'}
                </button>
                <p className="mt-1 text-center text-[9px] text-ink/45">
                  A local survey takes {SURVEY_YEARS} yr on both clocks and no propulsion energy.
                  {!surveyAffordable && (
                    <span className="text-[#ffb9a0]"> Not enough Earth time remains.</span>
                  )}
                </p>
              </>
            ) : (
              <p className="mt-2 text-[10.5px] text-ink/55">
                Pick a planet from the system to inspect it and run a survey.
              </p>
            )}
          </div>

          <div className="panel p-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-[8px] tracking-[0.16em] text-ink/45 uppercase">Next leg</div>
              <span className="text-[9px] text-ink/45">
                {expedition.currentLegIndex + 1} of {expedition.route.legs.length} done
              </span>
            </div>
            {nextLeg ? (
              <div className="mt-1 text-[11px] text-ink">
                {nextLeg.fromSystem} <span className="text-ink/35">→</span>{' '}
                {nextLeg.arrivalPlanetName}{' '}
                <span className="text-ink/45">({nextLeg.toSystem})</span>
                <div className="text-[9px] text-ink/45">
                  {formatNumber(nextLeg.distanceLy, 2)} ly · {nextLeg.beta.toFixed(2)}c ·{' '}
                  {formatChallengeYears(nextLeg.earthYears)} Earth ·{' '}
                  {formatEnergyUnits(nextLeg.totalEnergyCost, 3)} mc²
                </div>
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-ink">This was the final leg.</div>
            )}

            <div className="mt-2 grid gap-1.5">
              <button
                type="button"
                className="btn btn-primary py-2 text-[11.5px]"
                onClick={onContinue}
                disabled={!nextLeg}
                data-testid="continue-expedition"
              >
                Continue expedition
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  className="btn py-1.5 text-[10.5px]"
                  onClick={() => setShowNext((value) => !value)}
                  disabled={!nextLeg}
                >
                  {showNext ? 'Hide next destination' : 'View next destination'}
                </button>
                <button type="button" className="btn py-1.5 text-[10.5px]" onClick={toRouteMap}>
                  Return to route map
                </button>
              </div>
            </div>

            {showNext && nextLeg && (
              <div className="mt-2 rounded-lg border border-line/45 bg-void/50 px-2.5 py-2 text-[9.5px] leading-relaxed text-ink/60">
                <div className="text-[8px] tracking-[0.14em] text-ink/45 uppercase">
                  Upcoming stop
                </div>
                <div className="mt-0.5 text-[11px] text-ink">{nextLeg.toSystem}</div>
                <div>
                  Survey targets:{' '}
                  {nextLeg.surveyPlanetIds
                    .map((id) => planetById(id).name)
                    .join(', ') || 'Earth — return'}
                </div>
                <div>
                  Earth trip time {formatChallengeYears(nextLeg.earthYears)} · crew{' '}
                  {formatChallengeYears(nextLeg.shipYears)}
                </div>
              </div>
            )}

            <div className="mt-3 border-t border-line/40 pt-2">
              <button
                type="button"
                className="chip w-full justify-center"
                onClick={() => setHomeOpen((value) => !value)}
              >
                Return to Earth now (shortens the route)
              </button>
              {homeOpen && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[9px] leading-relaxed text-ink/50">
                    Cancels the remaining itinerary and flies one direct leg home from{' '}
                    {systemName}. Nothing is refunded or teleported.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={BETA_MIN}
                      max={BETA_MAX}
                      step="0.01"
                      value={homeBeta}
                      onChange={(event) => setHomeBeta(Number(event.target.value))}
                      className="lab-slider w-full"
                      aria-label="Return cruise speed"
                    />
                    <span className="num w-[48px] text-right text-[10.5px] text-[#5ee7ff]">
                      {homeBeta.toFixed(2)}c
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn w-full py-1.5 text-[10.5px]"
                    onClick={() => {
                      returnToEarthNow(homeBeta)
                      navigate(CHALLENGE_PATHS.flight)
                    }}
                  >
                    Set course for Earth
                  </button>
                </div>
              )}
            </div>

            <p className="mt-2 text-[8.5px] leading-relaxed text-ink/40">
              {plannedSurveysLeft} planned survey
              {plannedSurveysLeft === 1 ? '' : 's'} outstanding on this route. Only scanned planets
              count toward the discovery total.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
