import SolarSystemOrbitScene from './SolarSystemOrbitScene'
import EarthDossier from './EarthDossier'
import EarthHomeBadge from './EarthHomeBadge'

/**
 * The opening experience: the Solar System from just above the ecliptic, with
 * Earth marked as home, under the intro copy. "Explore the universe" hands off
 * to the real 3D star map — the same map the header button and the route
 * planner open — so there is one star map, not two.
 */
export default function EarthOrbitHero({
  onExploreUniverse,
  onStartChallenge,
  onPlanRoute,
}) {
  return (
    <section
      className="screen panel relative overflow-hidden"
      data-testid="earth-orbit-hero"
      aria-label="Solar System — your journey begins on Earth"
    >
      <div className="relative h-[calc(100svh-140px)] max-h-[920px] min-h-[660px] w-full">
        <div className="absolute inset-0 bg-[#04010c]">
          <SolarSystemOrbitScene onZoomOut={onExploreUniverse} />
        </div>

        {/* top HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
          <div>
            <div className="text-[9px] font-semibold tracking-[0.26em] text-white/70 uppercase">
              Solar System
            </div>
            <div className="mt-1 text-[10px] text-white/40">
              Sol system · Earth 1 AU from the Sun · orbit spacing compressed for display
            </div>
          </div>
          <div className="pointer-events-auto">
            <EarthHomeBadge />
          </div>
        </div>

        {/* intro + actions */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div className="pointer-events-auto w-full max-w-[560px] rounded-2xl border border-line/45 bg-[#04010c]/70 p-4 backdrop-blur-md sm:p-6">
            <h1 className="text-4xl leading-none font-semibold tracking-[0.16em] text-white sm:text-5xl lg:text-6xl">
              BEYOND TIME
            </h1>
            <div className="mt-3 text-[10px] font-semibold tracking-[0.3em] text-ion uppercase sm:text-[11px]">
              Your journey begins on Earth
            </div>
            <p className="mt-3 max-w-[440px] text-[12px] leading-relaxed text-white/70 sm:text-[13px]">
              Explore real exoplanets. Cross interstellar distances. Discover how time changes when
              you travel.
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-primary px-4 py-2.5 text-[11px] tracking-[0.16em] uppercase"
                onClick={onExploreUniverse}
                data-testid="explore-universe"
              >
                Explore the universe →
              </button>
              {onStartChallenge && (
                <button
                  type="button"
                  className="btn border-[#5ee7ff]/50 bg-[#5ee7ff]/10 px-4 py-2.5 text-[11px] tracking-[0.16em] text-[#c9f7ff] uppercase hover:border-[#5ee7ff]"
                  onClick={onStartChallenge}
                  data-testid="start-expedition-challenge-orbit"
                >
                  Start expedition challenge
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-white/45">
              <span>Drag to orbit · scroll to zoom · Earth sits 1 AU from the Sun</span>
              <span className="hidden sm:inline">
                Click the scene, then scroll out past the limit for the star map
              </span>
              {onPlanRoute && (
                <button
                  type="button"
                  className="text-white/60 underline decoration-line/70 underline-offset-4 transition hover:text-white"
                  onClick={onPlanRoute}
                >
                  Plan a route ↓
                </button>
              )}
            </div>
          </div>

          <div className="pointer-events-none flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
            <div className="hidden items-center gap-2 rounded-full border border-line/60 bg-[#04010c]/70 px-3 py-1.5 text-[10px] text-white/70 backdrop-blur sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9ad8ff]" />
              Odyssey · holding orbit
            </div>
            <EarthDossier />
          </div>
        </div>
      </div>
    </section>
  )
}
