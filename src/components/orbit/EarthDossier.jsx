import { useState } from 'react'
import { EARTH } from '../../lib/catalog'
import { classifyPlanet, describeStar } from '../../lib/planet'
import { formatNumber, surfaceGravity } from '../../lib/physics'

/**
 * Earth's scientific details, folded away so the opening screen stays an
 * experience rather than a data sheet.
 */
export default function EarthDossier() {
  const [open, setOpen] = useState(false)
  const look = classifyPlanet(EARTH)
  const star = describeStar(EARTH)
  const gravity = surfaceGravity(EARTH.massEarth, EARTH.radiusEarth)

  const rows = [
    ['Classification', look.label],
    ['Host star', `${star.name} · ${star.spectral}`],
    ['Distance from Sun', '1.00 AU · 8.3 light-min'],
    ['Orbital period', '365.25 days'],
    ['Radius', '1.00 R⊕ · 6,371 km'],
    ['Surface gravity', gravity != null ? `${formatNumber(gravity, 2)} g` : '1.00 g'],
    ['Mean temperature', '288 K · 15 °C'],
    ['Atmosphere', 'N₂ / O₂ · breathable'],
  ]

  return (
    <div className="pointer-events-auto flex w-full max-w-[320px] flex-col items-stretch gap-2 sm:items-end">
      {open && (
        <div
          className="w-full rounded-xl border border-line/50 bg-[#04010c]/85 p-3 backdrop-blur-md"
          data-testid="earth-dossier-panel"
        >
          <div className="label text-[9px]">Earth · astronomical record</div>
          <dl className="mt-2 divide-y divide-line/25">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 py-1">
                <dt className="text-[10px] text-ink/45">{label}</dt>
                <dd className="text-right text-[11px] text-ink/85">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 border-t border-line/25 pt-2 text-[9px] leading-relaxed text-ink/40">
            Background: mapped systems sit at their catalogue RA/Dec directions; the dimmer filler
            stars and the Milky Way veil are illustrative, not precise positions.
          </p>
        </div>
      )}
      <button
        type="button"
        className="btn bg-[#04010c]/70 px-3 py-1.5 text-[11px] backdrop-blur"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        data-testid="earth-dossier-toggle"
      >
        {open ? 'Hide Earth details' : 'Earth details'}
      </button>
    </div>
  )
}
