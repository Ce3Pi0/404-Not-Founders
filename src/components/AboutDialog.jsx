import { useEffect, useRef } from 'react'

const SECTIONS = [
  {
    title: 'What this is',
    body: [
      'Beyond Time turns Einstein\'s relativity into a mission you fly. Choose where you are and where you are going — Earth to an exoplanet, exoplanet to exoplanet, or back home — set a cruise speed, launch, and compare the clock in the crew cabin with the clock you left behind.',
      'This is the second playable draft for Hack The Nest: constant-velocity cruises between any two archived systems, accumulating crew time, and a debrief that shows the arithmetic behind what you just saw.',
    ],
  },
  {
    title: 'Where the planets come from',
    body: [
      'The catalogue is a direct extract of NASA\'s Exoplanet Archive CSV: planet name, host star, right ascension, declination, system distance in parsecs, orbital semi-major axis and orbital period. That file is the single source of truth for the app — 6,442 planets across thousands of systems.',
      'Route lengths come from real three-dimensional positions: each system is placed at its RA/Dec and distance from the Sun, so a trip between two exoplanets is the straight-line distance between those two points. Parsecs are converted to light years (1 pc = 3.2616 ly).',
      'The archive extract does not carry planet radii, masses, temperatures or host-star data, so those are derived: stellar mass follows from Kepler\'s third law using the orbital period and semi-major axis, and equilibrium temperature follows from the resulting luminosity. Those derived values are labelled as estimates.',
    ],
  },
  {
    title: 'How the physics works',
    body: [
      'We use units where c = 1 light-year per year. Earth-frame duration is distance ÷ speed, and the crew\'s proper time is that duration divided by γ = 1/√(1−β²).',
      'The planet itself rests in Earth\'s frame, so its local clock runs at Earth\'s rate; only the traveling crew accumulates less proper time. Surface gravity is computed from mass and radius, and its clock-rate effect is shown in the debrief — it is real, and far smaller than the velocity effect at these speeds.',
      'Simplifications for this draft: no acceleration or braking phases, no orbital motion, no gravitational lensing, and a one-way trip. The spacecraft\'s speed and mission profile are hypothetical; the destinations are not.',
    ],
  },
  {
    title: 'Why planets look the way they do',
    body: [
      'Colour is not in the archive. Each world\'s surface palette is inferred from its estimated equilibrium temperature, radius and density — which is why hot worlds read molten while cold ones read pale and icy. Figures on the planet surface are drawn at a readable scale, not a physically literal one.',
      'The host star is rendered at its true apparent angular size as seen from the planet\'s orbit, so a close-in world gets a sun that fills the sky and a distant one gets a small disc. Treat every surface detail as illustration, not observation.',
    ],
  },
  {
    title: 'Aging stages',
    body: [
      'Everyone in the simulation starts at 25. A clock that has accumulated under 1 year reads baby, then toddler, child, teen, adult, elderly, and finally skeleton past 85 years. Local life on a destination ages at the planet\'s own rate.',
      'Long missions therefore age the Earth twin and the locals far past the crew — the visual version of the time-dilation result.',
    ],
  },
  {
    title: 'Next iterations',
    body: [
      'Acceleration and deceleration phases, return trips and the twin paradox, gravitational time dilation around compact objects, waypoint routes through multiple systems, and a fuller slice of the archive.',
      'Team 404 Not Founders · Hack The Nest · data courtesy of NASA Exoplanet Archive.',
    ],
  },
]

export default function AboutDialog({ open, onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-void/80 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="panel max-h-[86vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label">About the simulation</div>
            <h2 id="about-title" className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              Beyond Time
            </h2>
          </div>
          <button ref={closeRef} type="button" className="btn px-3 py-1.5 text-xs" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="text-[11px] font-semibold tracking-[0.16em] text-ink/70 uppercase">
                {section.title}
              </h3>
              <div className="mt-1.5 space-y-2 text-[12px] leading-relaxed text-muted">
                {section.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
