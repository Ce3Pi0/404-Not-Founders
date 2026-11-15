/** Labelled slider row used by the configuration and mission-control panels. */
export default function LaunchSlider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  hint,
  disabled = false,
  live = false,
  ariaLabel,
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div className={disabled ? 'opacity-55' : ''}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-muted uppercase">
          {label}
          {live && (
            <span className="rounded-full border border-ion/40 px-1 text-[8px] tracking-[0.1em] text-ion">live</span>
          )}
        </span>
        <span className="num text-[12px] font-semibold text-ink">{display}</span>
      </div>
      <input
        type="range"
        className="slider mt-2"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        style={{ '--pct': `${pct}%` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint && <div className="mt-1 text-[10px] leading-relaxed text-muted/70">{hint}</div>}
    </div>
  )
}
