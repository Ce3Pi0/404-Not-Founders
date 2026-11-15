import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import UniverseScene from '../map/UniverseScene'
import { PICK_TARGETS, REGION_SYSTEMS, SOLAR_SYSTEM } from '../../lib/starMap'
import { CHALLENGE_PATHS, navigate } from '../../lib/router'
import { PRESETS, useChallengeStore } from '../../store/challengeStore'
import {
  BETA_MAX,
  BETA_MIN,
  SURVEY_YEARS,
  formatEnergyUnits,
} from '../../lib/challenge/physics'
import { STATUS } from '../../lib/challenge/engine'

const MODEL_NOTES = [
  'Acceleration consumes propulsion energy; ideal constant-speed cruise consumes none.',
  'Braking consumes the same energy as acceleration in this fictional propulsion model.',
  'Escaping a planet’s gravitational field has an additional energy cost.',
  'Travelling closer to light speed dramatically increases the kinetic-energy requirement.',
  'Faster legs shorten both the Earth-frame trip and the crew’s proper time.',
  'The Earth-time budget is the hard deadline. Ship proper time is shown for comparison.',
]

const CAMERA_VIEW = { position: [78, 58, 96], target: [0, 0, 0] }

export default function ChallengeIntro() {
  const preset = useChallengeStore((state) => state.preset)
  const energyBudget = useChallengeStore((state) => state.energyBudget)
  const earthTimeBudget = useChallengeStore((state) => state.earthTimeBudget)
  const expedition = useChallengeStore((state) => state.expedition)
  const setPreset = useChallengeStore((state) => state.setPreset)
  const setCustomBudgets = useChallengeStore((state) => state.setCustomBudgets)

  const labelsRef = useRef(null)
  const scaleBarRef = useRef(null)
  const scaleTextRef = useRef(null)
  const cameraQuaternionRef = useRef(new THREE.Quaternion())
  const cameraState = useRef({ position: null, target: null })
  const [hovered, setHovered] = useState(null)

  const labels = useMemo(() => [SOLAR_SYSTEM], [])

  const active = expedition
    ? expedition.status === STATUS.SURVEYING
      ? { label: 'Resume survey stop', path: CHALLENGE_PATHS.stop }
      : expedition.status === STATUS.SUCCESS || expedition.status === STATUS.FAILED
        ? { label: 'View expedition report', path: CHALLENGE_PATHS.result }
        : { label: 'Resume expedition', path: CHALLENGE_PATHS.flight }
    : null

  return (
    <section className="screen">
      <div className="panel relative overflow-hidden">
        <div className="absolute inset-0">
          <UniverseScene
            systems={REGION_SYSTEMS}
            pickTargets={PICK_TARGETS}
            labels={labels}
            labelsRef={labelsRef}
            scaleBarRef={scaleBarRef}
            scaleTextRef={scaleTextRef}
            cameraQuaternionRef={cameraQuaternionRef}
            selected={null}
            hovered={hovered}
            resetSignal={0}
            cameraState={cameraState}
            focus={null}
            onSelect={() => {}}
            onHover={setHovered}
            view={CAMERA_VIEW}
            maxDistance={900}
          />
        </div>

        <div className="relative grid min-h-[74vh] grid-cols-1 items-end gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
          <div className="panel max-h-[calc(74vh-2rem)] overflow-y-auto border-line/70 bg-void/92 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip border-ion/60 text-ink/90">Expedition challenge</span>
              <span className="chip">Mode 2 of 2</span>
            </div>

            <h1 className="mt-3 text-[22px] leading-tight font-semibold tracking-tight sm:text-[26px]">
              HOW FAR CAN YOU EXPLORE — AND STILL RETURN TO EARTH?
            </h1>
            <p className="mt-2 text-[12px] leading-relaxed text-ink/70">
              Plan your journey through real exoplanet systems. Balance propulsion energy and the
              passage of time.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-line/60 bg-panel/25 px-3 py-2.5">
                <div className="text-[8px] tracking-[0.16em] text-ink/50 uppercase">
                  Energy budget
                </div>
                <div className="num mt-1 text-[18px] leading-none text-ink">
                  {formatEnergyUnits(energyBudget, 3)}
                  <span className="ml-1 text-[10px] text-ink/55">mc²</span>
                </div>
              </div>
              <div className="rounded-xl border border-line/60 bg-panel/25 px-3 py-2.5">
                <div className="text-[8px] tracking-[0.16em] text-ink/50 uppercase">
                  Earth-time budget
                </div>
                <div className="num mt-1 text-[18px] leading-none text-ink">
                  {formatEnergyUnits(earthTimeBudget, 0)}
                  <span className="ml-1 text-[10px] text-ink/55">years</span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {PRESETS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setPreset(entry.id)}
                  aria-pressed={preset === entry.id}
                  data-testid={`preset-${entry.id}`}
                  className={preset === entry.id ? 'chip border-ion bg-ion/30 text-white' : 'chip'}
                  title={entry.blurb}
                >
                  {entry.name}
                  {entry.id !== 'custom' && (
                    <span className="ml-1 text-ink/45">
                      {entry.energyBudget} mc² · {entry.earthTimeBudget} yr
                    </span>
                  )}
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-[10px] text-ink/60">
                  <span className="mb-1 block tracking-[0.12em] uppercase">Energy (mc²)</span>
                  <input
                    type="number"
                    min="0.1"
                    max="200"
                    step="0.5"
                    value={energyBudget}
                    onChange={(event) => setCustomBudgets({ energyBudget: event.target.value })}
                    data-testid="custom-energy-budget"
                    className="num w-full rounded-lg border border-line/60 bg-void/70 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-ion"
                  />
                </label>
                <label className="block text-[10px] text-ink/60">
                  <span className="mb-1 block tracking-[0.12em] uppercase">
                    Earth time (years)
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    step="5"
                    value={earthTimeBudget}
                    onChange={(event) => setCustomBudgets({ earthTimeBudget: event.target.value })}
                    data-testid="custom-time-budget"
                    className="num w-full rounded-lg border border-line/60 bg-void/70 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-ion"
                  />
                </label>
              </div>
            )}

            <div className="mt-4 space-y-1.5 rounded-xl border border-line/50 bg-void/55 px-3 py-2.5">
              <div className="text-[9px] tracking-[0.16em] text-ink/50 uppercase">
                How the model works
              </div>
              {MODEL_NOTES.map((note) => (
                <p key={note} className="flex gap-1.5 text-[10.5px] leading-relaxed text-ink/65">
                  <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-ion" />
                  {note}
                </p>
              ))}
              <p className="pt-1 text-[9.5px] leading-relaxed text-ink/40">
                Starting point: Earth · initial velocity zero · return destination Earth · cruise
                speeds {BETA_MIN.toFixed(2)}c–{BETA_MAX.toFixed(2)}c · a local survey takes{' '}
                {SURVEY_YEARS} yr on both clocks.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary mt-4 w-full py-2.5 text-[12px] tracking-[0.12em] uppercase"
              onClick={() => navigate(CHALLENGE_PATHS.plan)}
              data-testid="plan-my-expedition"
            >
              Plan my expedition
            </button>

            {active && (
              <button
                type="button"
                className="btn mt-2 w-full py-2 text-[11px]"
                onClick={() => navigate(active.path)}
              >
                {active.label} →
              </button>
            )}
          </div>

          <div className="pointer-events-none flex flex-col items-start gap-1.5 pb-2 lg:items-end">
            <div className="rounded-xl border border-line/60 bg-void/85 px-3 py-2 text-right backdrop-blur">
              <div className="text-[9px] tracking-[0.16em] text-ink/45 uppercase">
                Departure point
              </div>
              <div className="mt-0.5 text-[13px] text-ink">Earth · Solar System</div>
              <div className="mt-0.5 text-[10px] text-ink/55">
                Exoplanet systems extend into the mapped 150 ly neighbourhood
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
