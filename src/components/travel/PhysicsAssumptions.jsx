/**
 * The scientific limitations, in one accessible panel. Shown on the Flight
 * Plan for both modes so no prediction is presented without its assumptions.
 */
export default function PhysicsAssumptions({ advanced = false, departureName }) {
  return (
    <details className="group rounded-xl border border-line/45 bg-void/40 px-3 py-2 open:bg-void/55">
      <summary className="cursor-pointer list-none text-[9px] tracking-[0.14em] text-ink/50 uppercase transition select-none hover:text-ink/75">
        Physics assumptions
        <span className="ml-1 text-ink/35 group-open:hidden">＋</span>
        <span className="ml-1 hidden text-ink/35 group-open:inline">−</span>
      </summary>
      <ul className="mt-2 space-y-1 text-[9px] leading-relaxed text-ink/45">
        <li>
          Star-system coordinates and distances come from the NASA Exoplanet Archive extract. Departure
          and destination systems are treated as stationary in one approximate inertial frame.
        </li>
        <li>
          Gravitational time dilation, relativistic gravity and spacetime curvature are{' '}
          <span className="text-ink/70">not modelled</span>. This is special relativity only — no
          general-relativistic clock corrections are claimed anywhere in the interface.
        </li>
        <li>
          Detailed orbital motion during interstellar travel is ignored; each leg starts and ends at
          rest relative to its star system.
        </li>
        <li>
          <span className="text-ink/70">Simple SR:</span> the ship reaches the chosen velocity
          instantly, cruises at constant speed, and brakes instantly. Acceleration and braking have
          zero simulated duration.
        </li>
        <li>
          <span className="text-ink/70">Advanced SR:</span> finite acceleration and braking at a
          constant proper acceleration in flat spacetime, via the relativistic rocket equations
          (rapidity), never v = a·t. Braking magnitude equals the departure acceleration.
        </li>
        <li>
          The planetary liftoff check is a local Newtonian surface-gravity approximation with a
          vertical departure; atmospheric drag and detailed launch trajectories are excluded.
        </li>
        <li>
          Spacecraft mass is constant: propellant is counted in the launch mass only. Fuel burn,
          changing vehicle mass and relativistic exhaust velocity are not modelled, so no
          fuel-consumption meter is shown.
        </li>
        <li>
          Thrust and mass are engineering feasibility constraints, not a propulsion simulation.
          {advanced && departureName ? ` Departure body: ${departureName}.` : ''}
        </li>
      </ul>
    </details>
  )
}
