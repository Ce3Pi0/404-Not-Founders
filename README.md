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

The lab solves a one-way trip between two stations that share one inertial frame:

- The ship leaves Point A at rest, holds a constant **proper acceleration** until it reaches the
  requested cruise speed (or half the route, whichever comes first), coasts, then decelerates
  symmetrically into Point B. Coordinate time, distance and velocity come from the closed-form
  hyperbolic-motion solution; the ship's proper time is integrated along the worldline.
- Gravitational time dilation uses the weak-field clock rate `√(1 − rₛ/r)` and is integrated while
  the ship climbs out of, and settles into, each planet's potential well. Deep-space cruise uses 1.
- Acceleration is **not** treated as a direct cause of time dilation: it alters the ship's proper
  time only through the velocity it produces and the potential it traverses. G-force is reported
  separately as `a / 9.80665 m/s²` (current, maximum and flight average).
- Points A and B are modelled at rest relative to each other, so their clocks differ only by the
  gravitational rate at each surface. The split screen shows the same mission from both ends of the
  route — the ship recedes at A, approaches at B — with each observer's elapsed time, distance,
  light-travel lag and relativistic Doppler factor.
- Changing the start, destination, speed, acceleration or duration re-solves the profile and replays
  the flight. Route length is the radial separation of the two catalog distances from Earth (the
  smallest possible separation); true separations need sky positions the archive export lacks.

## Project structure

```
src/
  App.jsx                 mission state machine: destination → flight plan → journey → debrief
  data/exoplanets.json    NASA-derived dataset (100 worlds)
  lib/physics.js          time dilation, gravity, formatting
  lib/planet.js           classification, palettes, procedural textures, star colour
  lib/aging.js            biological stages
  lib/simulation.js       localStorage mission log
  lib/labPhysics.js       Relativity Lab flight solver, proper-time integration, telemetry
  lib/labCatalog.js       lab stations (Earth + archive worlds) and route distances
  components/             scene, HUD, picker, flight plan, journey, debrief
  components/lab/         flight console: cameras, split screen, dashboard, controls
```

## Roadmap

- Acceleration/deceleration phases and the twin paradox on a return trip
- Gravitational time dilation around compact objects
- Multi-system routes and waypoint missions
- A fuller slice of the archive, refreshed from the NASA API at build time

## Credits

Planetary data: [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) — a service of
NASA's Exoplanet Exploration Program.
