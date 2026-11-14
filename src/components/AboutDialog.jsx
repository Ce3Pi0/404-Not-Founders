import { useEffect, useRef } from 'react'

const SECTIONS = [
  {
    title: 'What this is',
    body: [
      'Beyond Time turns Einstein\'s relativity into a mission you fly. Pick a real exoplanet, set a cruise speed, launch, and compare the clock in the crew cabin with the clock back on Earth.',
      'This is the first playable draft for Hack The Nest: one-way constant-velocity cruises, accumulating crew time, and a debrief that shows the arithmetic behind what you just saw.',
    ],
  },
  {
    title: 'Where the planets come from',
    body: [
      'Every destination comes from NASA\'s Exoplanet Archive, planetary systems composite parameters table. Distances, radii, masses, equilibrium temperatures, orbital geometry and host-star properties are measured or derived values published by the archive.',
      'Parsecs are converted to light years (1 pc = 3.2616 ly). A handful of archive fields are blank for some worlds; those read "—" rather than being invented.',
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
      'Colour is not in the archive. Each world\'s surface palette is inferred from its bulk properties — equilibrium temperature, density, radius and mass — which is why hot Jupiters read banded and amber while cold worlds read pale and icy.',
      'When a world is missing the temperature or radius needed for that inference, the palette is estimated (or randomized as a last resort) and marked with an asterisk in the interface. Treat those colours as illustration, not observation.',
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
              <h3 className="text-[11px] font-semibold tracking-[0.16em] text-ion uppercase">
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
