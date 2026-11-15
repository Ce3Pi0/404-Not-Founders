# Beyond Time — An Interactive Relativity Adventure

A browser-based space exploration game that makes Einstein's relativity something you can fly.
Travel between real star systems, configure a spacecraft, launch, and watch the crew's clock and the
clock you left behind diverge.

Built by **404 Not Founders** for **Hack The Nest** — second playable draft.

## What works in this draft

- **Route anywhere** — every one of the 6,442 archived worlds can be a departure point or a
  destination. Chain hops (Earth → exoplanet → another system → Earth) and trip length is the real
  three-dimensional distance between the two systems' RA/Dec/distance positions.
- **Visualise** — a procedural 3D planet you can orbit and zoom, with the crew figure standing on its
  surface (and a local alien only when you are on an exoplanet). The host star is rendered at its true
  apparent angular size as seen from the planet's orbit.
- **Skeletons** — past 85 years of accumulated time a figure renders as a full skeleton: cranium with
  orbits and teeth, vertebral column, ribcage with sternum, pelvis and two-bone limbs. The alien
  skeleton is anatomically different from the human one.
- **Prepare** — set a cruise speed from 0.05 c to 0.999 c with a slider, numeric input and presets,
  name the spacecraft, and predict both elapsed times before launch.
- **Fly** — a top-down route view: origin marker, dotted route, ship on the line with live speed,
  distance travelled and remaining, two clocks advancing side by side, and the destination planet
  growing as the ship closes in.
- **Go home** — a go-home button (header, planet view and debrief) always returns you to Earth.
- **Learn** — a debrief with elapsed time in both frames, the γ factor, the substitution behind it,
  prediction accuracy, the destination's surface-gravity clock rate, and a persistent mission log.

## Run it

```bash
npm install
npm run dev
```

The app is a static SPA (React + Three.js + Tailwind CSS) with no backend. Mission progress is
stored in `localStorage`.

## Planetary data

`src/data/exoplanets.csv` is the NASA Exoplanet Archive extract and the app's single source of
truth. Columns: `pl_name`, `hostname`, `ra`, `dec`, `sy_dist` (parsecs), `pl_orbsmax` (AU),
`pl_orbper` (days). `src/lib/catalog.js` parses it at load time — no generated JSON and no network
call. Distances are converted from parsecs to light years (1 pc = 3.2616 ly).

The extract carries no radii, masses, temperatures or star properties, so those are **derived**:
stellar mass from Kepler's third law (`M = a³/P²`), radius and luminosity from main-sequence
relations, equilibrium temperature from luminosity and orbital distance, and bulk properties from a
deterministic per-planet estimate. The UI and About dialog label them as estimates. Colours are
likewise inferred, not observed.

## Theme

The interface uses only `#9A0680`, `#79018C`, `#4C0070` and `#160040`, with no gradients anywhere —
depth comes from solid fills, borders and opacity. Tokens live in `src/index.css`.

## Physics model

Units are chosen so that `c = 1 ly/yr`:

```
t_ref   = d / β            (reference frame)
γ       = 1 / √(1 − β²)
t_ship  = t_ref / γ        (crew's proper time)
```

Surface gravity is computed as `g = M/R²` in Earth units, and the gravitational clock-rate factor
`√(1 − rₛ/R)` is shown for context — at these masses it is many orders of magnitude smaller than the
velocity effect.

Simplifications for this draft: one-way legs at constant velocity (no acceleration or braking), no
orbital motion, no gravitational lensing. Speeds and mission profiles are hypothetical; the
destinations are real.

## Project structure

```
src/
  App.jsx                 mission state: route → flight plan → journey → debrief
  data/exoplanets.csv     NASA Exoplanet Archive extract (6,442 planets)
  lib/catalog.js          CSV parsing, systems, 3D positions, route distances, search
  lib/physics.js          time dilation, gravity, formatting
  lib/planet.js           classification, palettes, procedural textures, star colour
  lib/aging.js            biological stages
  lib/simulation.js       localStorage mission log
  components/             scene, crew figures, picker, flight plan, journey, debrief
```

## Roadmap

- Acceleration/deceleration phases and the twin paradox on a return trip
- Waypoint routes with a map of the whole journey
- Gravitational time dilation around compact objects
- Refreshing the CSV directly from the NASA API at build time

## Credits

Planetary data: [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) — a service of
NASA's Exoplanet Exploration Program.
