import { CAREER_CONTRACTS, CAREER_SHIPS } from '../lib/simulation'

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-line/50 bg-void/45 p-4">
      <div className="text-[9px] uppercase tracking-[0.16em] text-ink/45">{label}</div>
      <div className="num mt-1 text-2xl font-semibold text-ink">{value}</div>
    </div>
  )
}

export default function CareerMode({ sim, shipName, onSelectShip, onBack }) {
  const career = sim.career ?? { credits: 0, completedContracts: [], selectedShip: 'odyssey' }
  const completed = career.completedContracts ?? []
  const missions = sim.missions.length
  const rank = missions >= 6 ? 'Interstellar Pioneer' : missions >= 3 ? 'Deep-Space Navigator' : missions >= 1 ? 'Flight Cadet' : 'Recruit'
  const nextShip = CAREER_SHIPS.find((ship) => missions < ship.requirement)

  return (
    <section className="screen space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-ion">Command Headquarters</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">Career Command</h1>
          <p className="mt-1 text-sm text-ink/60">Build your flight record, complete contracts, and earn access to advanced spacecraft.</p>
        </div>
        <button className="btn btn-primary" onClick={onBack}>Return to mission planning →</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Available credits" value={career.credits.toLocaleString()} />
        <Metric label="Completed missions" value={missions} />
        <Metric label="Command rank" value={rank} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-ink/45">Contract board</div>
          <h2 className="mt-1 text-xl font-semibold text-ink">Expedition objectives</h2>
          <div className="mt-3 space-y-2">
            {CAREER_CONTRACTS.map((contract) => {
              const done = completed.includes(contract.id)
              return (
                <div key={contract.id} className="flex items-center justify-between gap-3 rounded-lg border border-line/50 bg-void/35 p-3">
                  <div>
                    <div className="text-sm font-medium text-ink">{contract.title} {done && <span className="ml-1 text-ion">✓</span>}</div>
                    <div className="mt-0.5 text-xs text-ink/55">{contract.detail}</div>
                    <div className="mt-1 text-[10px] text-ion">{contract.reward.toLocaleString()} credits</div>
                  </div>
                  <span className="shrink-0 rounded-md border border-line/60 px-2 py-1 text-[9px] uppercase tracking-wider text-ink/55">{done ? 'Complete' : 'Active'}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-ink/40">Contracts are awarded automatically when a mission arrives. Flight pay is based on distance; each contract pays once.</p>
        </section>

        <section className="panel p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-ink/45">Ship registry</div>
          <h2 className="mt-1 text-xl font-semibold text-ink">Available spacecraft</h2>
          <div className="mt-3 space-y-2">
            {CAREER_SHIPS.map((ship) => {
              const unlocked = missions >= ship.requirement
              const selected = career.selectedShip === ship.id
              return (
                <div key={ship.id} className="rounded-lg border border-line/50 bg-void/35 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-ink">{ship.name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-ink/45">{ship.className}</div>
                    </div>
                    {unlocked ? (
                      <button className={selected ? 'btn btn-primary' : 'btn'} onClick={() => onSelectShip(ship)}>{selected ? 'Selected' : 'Select'}</button>
                    ) : <span className="text-[10px] text-ink/45">🔒 {ship.requirement} missions</span>}
                  </div>
                  <p className="mt-2 text-xs text-ink/55">{ship.description}</p>
                </div>
              )
            })}
          </div>
          {nextShip && <p className="mt-3 text-[10px] text-ion">Next unlock: {nextShip.name} after {nextShip.requirement} completed missions.</p>}
          <p className="mt-3 text-[10px] text-ink/40">Current flight callsign: {shipName}</p>
        </section>
      </div>
    </section>
  )
}
