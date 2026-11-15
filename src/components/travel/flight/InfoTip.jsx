import { useEffect, useRef, useState } from 'react'

/**
 * Compact inline explanation. Click (or keyboard) toggles a small note below
 * the trigger; it never depends on hover, so it works on touch screens too.
 * Panels keep it inside the stage, so nothing is clipped.
 */
export default function InfoTip({ label, children, align = 'left', tone = 'dark' }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (!wrap.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <span ref={wrap} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        onPointerDown={(event) => event.stopPropagation()}
        className={`flex h-4 w-4 items-center justify-center rounded-full border text-[8px] leading-none font-semibold transition ${
          tone === 'dark'
            ? 'border-line/70 bg-void/85 text-ink/60 hover:border-ion hover:text-ink'
            : 'border-line/60 bg-panel/40 text-ink/60 hover:border-ion hover:text-ink'
        } ${open ? 'border-ion text-ink' : ''}`}
      >
        ?
      </button>

      {open && (
        <span
          role="tooltip"
          className={`absolute top-full z-50 mt-1 w-56 rounded-lg border border-line/70 bg-void/98 px-2.5 py-2 text-[9px] leading-relaxed text-ink/70 shadow-xl backdrop-blur ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </span>
      )}
    </span>
  )
}
