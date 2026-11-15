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
- **Age** — the crew, the Earth twin and the locals age through baby → toddler → child → teen →
  adult → elderly → skeleton as accumulated time crosses each threshold.
- **3D star map** — every unique host-star system inside the nearest 150 light-years as a glowing
  point in a real 3D volume: free orbit, zoom and pan, a labelled Solar System origin, projected
  names for the selected and nearby systems, a live light-year scale bar, an orientation axis
  indicator and a reset-camera control. Selecting a star opens its worlds and routes straight into
  the existing departure/destination flow (`Star map` in the header, or from the route stage).
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

`src/data/exoplanets.csv` is the NASA Exoplanet Archive extract and the app's single source of
truth. Columns: `pl_name`, `hostname`, `ra`, `dec`, `sy_dist` (parsecs), `pl_orbsmax` (AU),
`pl_orbper` (days). `src/lib/catalog.js` parses it at load time — no generated JSON and no network
call. Distances are converted from parsecs to light years (1 pc = 3.2616 ly).

The extract carries no radii, masses, temperatures or star properties, so those are **derived**:
stellar mass from Kepler's third law (`M = a³/P²`), radius and luminosity from main-sequence
relations, equilibrium temperature from luminosity and orbital distance, and bulk properties from a
deterministic per-planet estimate. The UI and About dialog label them as estimates. Colours are
likewise inferred, not observed.

## 3D universe map

`src/components/map/` renders the archive as a navigable universe, one glowing point per unique
host-star system. `catalog.js` keeps two coordinate sets per system:

- `position` — the existing equatorial parsec vector `[d·cosδ·cosα, d·cosδ·sinα, d·sinδ]`, used by
  every route and travel-time calculation.
- `mapPosition` — the exact map-frame Cartesian coordinates in light-years for a right-handed,
  Y-up frame with the Solar System at the origin: `x = d·cosδ·cosα`, `y = d·sinδ`,
  `z = d·cosδ·sinα`, where `d` is `sy_dist` converted to light-years.

`src/lib/starMap.js` adds `renderPosition` for the scene. The scale is linear — one world unit is one
light-year — so no visual compression exists and drawn coordinates equal the physical ones. The two
are kept separate so any future compression stays explicit, and every distance shown in the panel or
used for routing is measured from `mapPosition`/`position`, never from what is drawn.

The first version draws only systems within 150 ly. Systems whose archive row has no `sy_dist` are
left out of the map (their `mapPosition` is `null`) but remain searchable and routable, and systems
beyond the region are counted in the map overlay. Names are HTML labels projected from the 3D
positions and capped at 12, because no 3D text library is installed.

### Selecting and navigating

- Hovering a point raises its glow and shows the system's name; clicking it opens a floating card
  with the host star, its distance from the current location, its known exoplanets, **Explore
  System** and **Plan Travel**. Clicking blank space clears the selection.
- The search field matches host stars and individual planets straight from the archive extract,
  limited to the drawn region so every hit has a real position to fly to.
- Selecting a result eases the camera to that system's exact 3D point. **Explore System** glides in
  and opens `/system/:id`; **← Back to Universe** returns with the same star selected and the camera
  framing restored (`SystemView`, `src/lib/router.js`). The selected star carries a cyan halo and a
  dashed distance line to the current location.
- Camera flights interpolate both position and target with an ease-in-out curve, and any manual
  input (drag, wheel, touch) cancels a flight immediately. Zooming the camera never changes the
  mission's current location.

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
  App.jsx                 mission state: route → flight plan → journey → debrief
  data/exoplanets.csv     NASA Exoplanet Archive extract (6,442 planets)
  lib/catalog.js          CSV parsing, systems, 3D positions, route distances, search
  lib/physics.js          time dilation, gravity, formatting
  lib/planet.js           classification, palettes, procedural textures, star colour
  lib/aging.js            biological stages
  lib/simulation.js       localStorage mission log
  lib/labPhysics.js       relativistic helpers, clock formatting, planet frames
  lib/launchPhysics.js    launch integrator: thrust, fuel, phases, proper time, telemetry
  lib/labCatalog.js       lab stations (Earth + archive worlds) and route distances
  lib/starMap.js          map-frame entries, 150 ly region, search, labels, exact map distances
  lib/router.js           pathname routing for /system/:id
  components/             scene, crew figures, HUD, picker, flight plan, journey, debrief
  components/map/         3D universe map: scene, labels, search, system card and page, gizmo
  components/lab/         launch console: scene + camera rigs, controls, config, telemetry, education
```

## Roadmap

- Acceleration/deceleration phases and the twin paradox on a return trip
- Waypoint routes with a map of the whole journey
- Gravitational time dilation around compact objects
- Refreshing the CSV directly from the NASA API at build time

## Credits

Planetary data: [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) — a service of
NASA's Exoplanet Exploration Program.
