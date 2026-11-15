import { LAUNCH_STAGES } from '../../lib/launchPhysics'

/** The ten launch stages with the current one highlighted. */
export default function StageProgress({ stage, progress }) {
  return (
    <div className="rounded-xl border border-line/70 bg-void/40 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] tracking-[0.16em] text-muted uppercase">Launch sequence</span>
        <span className="text-[10px] text-ion">
          {stage + 1}/{LAUNCH_STAGES.length} · {Math.round(progress * 100)}%
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-ion/70 duration-150"
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
      </div>
      <ol className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-5">
        {LAUNCH_STAGES.map((item, index) => {
          const state = index === stage ? 'current' : index < stage ? 'done' : 'todo'
          return (
            <li
              key={item.id}
              className={`flex items-center gap-1.5 text-[9px] tracking-[0.06em] uppercase ${state === 'current' ? 'text-ion' : state === 'done' ? 'text-mint/80' : 'text-muted/50'
                }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${state === 'current' ? 'bg-ion' : state === 'done' ? 'bg-mint/70' : 'bg-white/15'
                  }`}
              />
              <span className="truncate font-semibold">{item.label}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
