# Beyond Time — An Interactive Relativity Adventure

A browser-based space exploration game that makes Einstein's relativity something you can fly.
Pick a real exoplanet from NASA's archive, configure a spacecraft, launch, and watch the crew's
clock and Earth's clock diverge.

Built by **404 Not Founders** for **Hack The Nest** — first playable draft.

## What works in this draft

- **Discover** — search 100 real exoplanets (NASA Exoplanet Archive) by name or host star, with
  recommended worlds and a full fact sheet for each destination (distance, radius, mass,
  equilibrium temperature, orbit, host star, discovery).
- **Visualise** — a procedural 3D planet you can orbit and zoom, lit by its real host star with
  the star's colour and apparent angular size derived from archive data, plus miniature 3D
  "bobble-head" figures for the Earth twin and the local alien.
- **Prepare** — set a cruise speed from 0.05 c to 0.999 c with a slider, numeric input and presets,
  name the spacecraft, and predict both elapsed times before launch.
- **Fly** — a warp-style 3D journey with two clocks advancing side by side.
- **Learn** — a debrief with Earth time vs ship time, the γ factor, the substitution behind it,
  prediction accuracy, the destination's surface-gravity clock rate, and a persistent mission log.
- **Age** — the crew, the Earth twin and the locals age through baby → toddler → child → teen →
  adult → elderly → skeleton as accumulated time crosses each threshold.
- **Relativity Lab** — a flight console with four camera perspectives (first-, second- and
  third-person, plus a bird's-eye system map), a synchronized Point A / Point B split screen, live
  digital clocks, spacecraft and G-force telemetry, and full start / pause / resume / reset control
  over a segmented acceleration–cruise–deceleration flight.

## Run it

```bash
npm install
npm run dev
```

The app is a static SPA (React + Three.js + Tailwind CSS) with no backend. Mission progress is
stored in `localStorage`.

## Planetary data

`src/data/exoplanets.json` was generated from the NASA Exoplanet Archive TAP service,
`pscomppars` (Planetary Systems Composite Parameters) table, for a curated set of well-known and
nearby worlds. Distances are converted from parsecs to light years (1 pc = 3.2616 ly). Fields the
archive does not report are left out and rendered as "—" rather than being invented.

Colour is not an archive field. Each world's surface palette is **inferred** from its equilibrium
temperature, density, radius and mass; when that data is incomplete the palette is marked as
estimated (or randomized as a last resort) with an asterisk in the UI and explained in About.

## Physics model

Units are chosen so that `c = 1 ly/yr`:

```
t_earth = d / β            (Earth frame)
γ       = 1 / √(1 − β²)
t_ship  = t_earth / γ      (crew's proper time)
```

The planet rests in Earth's frame, so its local clock runs at Earth's rate. Surface gravity is
computed as `g = M/R²` in Earth units, and the gravitational clock-rate factor `√(1 − rₛ/R)` is
shown for context — at these masses it is many orders of magnitude smaller than the velocity effect.

Simplifications for this draft: one-way trips at constant velocity (no acceleration or braking),
no orbital motion, no gravitational lensing. Speeds and mission profiles are hypothetical; the
destinations are real.

## Relativity Lab model

The lab is an interactive launch simulation. You configure a craft, launch it from a
planet, and keep changing the mission while it flies.

- **The integrator.** State is advanced step by step in the shared rest frame of the two
  stations. While the ship thrusts, velocity is integrated in rapidity space, which is exact
  for a constant proper acceleration over a step:
  `η₁ = asinh(sinh η₀ + a·dt/c)`, `β = tanh η`, `Δτ = (c/a)(η₁ − η₀)`.
  Nothing is prerecorded: thrust, mass, fuel, target speed, course and the arrival burn all
  change the trajectory the next frame.
- **Ascent.** Newtonian climb at the chosen launch angle through a 100 km atmosphere:
  `dv/dt = a_thrust − g(r)·sin θ`, with `g(r) = g₀(R/r)²` from the planet's mass and radius.
  Below the surface gravity the craft is held on the pad with an explanation instead of
  silently failing.
- **Fuel.** A photon drive (`Isp = c/g₀`), so the burn rate is `thrust/c`; the propellant
  load caps the total burn time. Running dry shuts the engines down and the ship coasts.
- **Clocks.** The ship's proper time is integrated along the path actually flown:
  `dτ = dt · √(1 − v²/c²) · √(1 − rₛ/r)`, with the gravitational factor taken from the launch
  planet's potential while the ship climbs out of it and 1 in deep space. The launch planet
  and destination clocks advance at their own surface rates. G-force is proper acceleration
  ÷ 9.80665 m/s² and never enters the time-dilation integral on its own, so a ship coasting at
  0.74 c reads 0 g while its clock still runs slow.
- **Arrival burn.** With auto-brake on, the ship flips when the remaining distance equals the
  relativistic stopping distance `(c²/a)(cosh η − 1)` and decelerates into the destination.
- **Cameras.** One scene, four synchronized rigs — first-person cockpit, tracking observer,
  chase view with adjustable distance and angle, and a top-down system map you can orbit and
  zoom. Split-screen shows Point A and Point B side by side, each with its own camera and its
  own clock, from the same simulation state.
- **Simplifications, labelled in the app:** a 100 km atmospheric shell, a fixed ship mass, no
  destination gravity well, no orbital motion and no tidal effects. Playback compresses the
  mission timeline (the ascent runs in seconds, the interstellar leg in years) without
  changing the physics, and route length is still the radial separation of the two catalog
  distances from Earth.

## Project structure

```
src/
  App.jsx                 mission state machine: destination → flight plan → journey → debrief
  data/exoplanets.json    NASA-derived dataset (100 worlds)
  lib/physics.js          time dilation, gravity, formatting
  lib/planet.js           classification, palettes, procedural textures, star colour
  lib/aging.js            biological stages
  lib/simulation.js       localStorage mission log
  lib/labPhysics.js       relativistic helpers, clock formatting, planet frames
  lib/launchPhysics.js    launch integrator: thrust, fuel, phases, proper time, telemetry
  lib/labCatalog.js       lab stations (Earth + archive worlds) and route distances
  components/             scene, HUD, picker, flight plan, journey, debrief
  components/lab/         launch console: scene + camera rigs, controls, config, telemetry, education
```

## Roadmap

- Acceleration/deceleration phases and the twin paradox on a return trip
- Gravitational time dilation around compact objects
- Multi-system routes and waypoint missions
- A fuller slice of the archive, refreshed from the NASA API at build time

## Credits

Planetary data: [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) — a service of
NASA's Exoplanet Exploration Program.
