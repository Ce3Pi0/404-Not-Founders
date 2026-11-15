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
- **Plan** — the Travel Planner keeps the 3D star map as its background: a glowing route between
  two host stars, a spacecraft at the departure star carrying a 0.10 c–0.99 c speed slider (default
  0.80 c), and the Lorentz factor, reference-frame time, ship time and aging difference updating as
  the slider moves. Change either endpoint, return to Earth, or launch.

- **Fly** — a cinematic Live Flight scene on the real light-year route between the two systems:
  a spacecraft travelling from departure to arrival on an accelerated timeline and three camera
  perspectives (bird's-eye, departure observer with an optional delayed-signal view, and the
  spacecraft cockpit) in a single, two-way split or three-way split layout, start / pause / resume /
  restart and playback controls, and a relativity HUD whose reference and proper clocks both derive
  from the same progress value. Every panel renders from one shared simulation, so pause, layout
  changes and camera assignment never reset the journey. Arrival offers Explore This System, Choose
  Another Destination, or Return to Earth.
- **Go home** — a go-home button (header, planet view and arrival panel) always returns you to
  Earth.
- **Learn** — Live Flight's relativity HUD and arrival summary show elapsed time in both frames,
  the γ factor and their difference, and every completed trip joins the persistent mission log.
- **Age** — the crew, the Earth twin and the locals age through baby → toddler → child → teen →
  adult → elderly → skeleton as accumulated time crosses each threshold.
- **3D star map** — every unique host-star system inside the nearest 150 light-years as a glowing
  point in a real 3D volume: free orbit, zoom and pan, a labelled Solar System origin, projected
  names for the selected and nearby systems, a live light-year scale bar, an orientation axis
  indicator and a reset-camera control. Selecting a star opens its worlds and routes straight into
  the existing departure/destination flow (`Star map` in the header, or from the route stage).
- **Star System Explorer** — zooming into a host star leaves the light-year map for a separate
  planetary scene in AU: every known world on its archive semi-major axis, orbit rates from the
  archive period, click-to-select with a camera flight, orbit and label toggles, and an adjustable
  simulation clock. Systems are generated from the archive rows, never hardcoded.
- **Two Special-Relativity modes** — the Flight Plan carries an *Advanced Acceleration* switch.
  Off (the default) is **Simple SR**: instantaneous acceleration, constant cruise, instantaneous
  braking. On is **Advanced SR**: finite acceleration at a constant proper acceleration, a cruise
  phase when the distance allows, and automatic braking to rest at the destination — with the
  proper acceleration, spacecraft mass, carried propellant and engine thrust used as launch and
  thrust feasibility checks. The selected mode and parameters persist across Route, Flight Plan,
  Live Flight, Debrief and the Expedition Challenge.

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

The map draws only systems within 150 ly. Systems whose archive row has no `sy_dist` are left out of
the map (their `mapPosition` is `null`) but remain searchable and routable, and systems beyond the
region are counted in the map overlay. Names are HTML labels projected from the 3D positions, capped
at 12, because no 3D text library is installed; a projected label that would land on a
higher-priority one is dropped instead of stacked (`pickVisibleLabels` in `lib/mapLabels.js`).

### The scene

- **Solar System.** A small Sun-coloured star marker at the origin with a thin warm outline and the
  label `Solar System — Home`. Its on-screen size is held constant by the camera (about the size of
  a catalogue marker), so it never implies an astronomical diameter of light-years. No sphere, no
  bloom and no Earth orbit are drawn at this scale.
- **Depth.** Star points take the host star's blackbody colour and shrink with distance from the
  camera; thin rings at 5/10/25/50/100 ly on the reference plane, faint radial spokes and vertical
  stems from nearby systems down to that plane give the cloud a measured volume.
- **Home framing.** `HOME_CAMERA` in `lib/mapCamera.js` is oblique and ~17 ly out, so the nearest
  catalogue systems separate into real empty space instead of collapsing onto the Sun.
- **Route.** The planner's route is drawn as a thin cyan path with a ring at each end and its
  distance in light-years at the midpoint. It is only drawn once asked for (**Frame route** /
  **Line on**), because a line to a destination 40 ly away would otherwise leave the opening view
  before anything was chosen. **Frame route** fits both systems with `framingForRoute`.

### Selecting and navigating

- Hovering a point raises its glow and shows the system's name; clicking it selects the system,
  eases the camera gently toward it and opens a collapsible drawer with the host star, its distance
  from the current location, its known exoplanets, **Explore System** and **Plan Travel**. Clicking
  blank space clears the selection. The navigation rail on the left stays compact (search, current
  location, destination with distance, system count) so the map keeps most of the viewport.
- **Double-clicking** a star dives into it: the Solar System hands over to the Earth orbit scene, an
  exoplanet host opens its local system explorer (`/system/:id`, AU scale). The same dive also runs
  when a pointer leaves the map through the solar marker while zooming in.
- The search field matches host stars and individual planets straight from the archive extract,
  limited to the drawn region so every hit has a real position to fly to.
- Selecting a result eases the camera to that system's exact 3D point. **Explore System** glides in
  and opens `/system/:id`; **← Back to Universe** returns with the same star selected and the camera
  framing restored (`SystemView`, `src/lib/router.js`). The selected star carries a cyan halo and a
  dashed distance line to the current location. **Center on location** re-frames wherever the crew
  actually is and **Reset view** glides home, neither of which touches the route.
- Camera flights interpolate both position and target with an ease-in-out curve, and any manual
  input (drag, wheel, touch) cancels a flight immediately. Zooming the camera never changes the
  mission's current location.

## Travel Planner

`/travel` (`TravelPlanner`, `src/components/travel/SystemPickerDialog.jsx`) uses the same universe
scene as the map. The departure and destination host stars are placed from their exact archive
coordinates, a glowing path joins them, and the spacecraft sits at the departure point with the
speed control attached to it.

- **Distance** is the Euclidean separation of the two systems' NASA RA/Dec Cartesian vectors, in
  light-years — never the subtraction of their catalogue distances.
- **Speed** runs from 0.10 c to 0.99 c, default 0.80 c. The panel reports `γ = 1/√(1−β²)`,
  reference-frame time `d/β`, spacecraft time `reference/γ`, and their difference immediately, so
  every slider move updates the predicted clocks.
- **Endpoints** start at the Solar System and the world selected on the map. **Change Departure** and
  **Change Destination** search every host star with a measured distance, including stars beyond the
  drawn 150-ly region; the camera reframes to the whole route. Clicking a charted star also sets the
  destination.
- **After arrival** the arrived system becomes the current location, so the next mission departs
  from it; **Return to Earth** plans the trip home from wherever the crew is.
- **Launch Spacecraft** opens Live Flight on the calculated route, and **Return to Star Map** goes
  back to the 3D map.
- The model assumes a constant cruise speed, stationary endpoints in the chosen reference frame,
  negligible acceleration, and no gravitational clock corrections during transit. The screen says
  so; `/planet/:id` and the debrief carry the same note.

## Live Flight

`LiveFlight` (`src/components/travel/LiveFlight.jsx`, `flight/FlightStage.jsx`) replaces the old
top-down journey with the animated interstellar run between the Travel Planner's two systems.

- **Route** — the scene draws both host stars at their exact RA/Dec Cartesian positions in
  light-years (one scene unit is one light-year) and flies the spacecraft along the straight
  calculated path. Distances and the mission's reference-frame and proper durations come from the
  mission snapshot taken at launch; nothing in the animation recomputes them.
- **Timeline** — one `requestAnimationFrame` loop advances a single progress fraction from 0 to 1.
  The whole trip takes 24 s at 1× playback; 0.5×, 1×, 2× and 4× only change how fast that fraction
  moves. Both clocks are `progress × total duration`, so they agree at every instant:
  `t_ref = p·d/β`, `t_ship = p·t_ref/γ`, `Δ = p·(t_ref − t_ship)`.
- **Cameras** — *Bird's-eye* follows from outside with the route and both systems in frame;
  *Departure observer* watches from near the origin and offers a delayed-signal view; *Cockpit* is
  a first-person forward view with an onboard clock and speed overlay. Bird's-eye and departure
  observer take independent orbit and zoom gestures; the cockpit is fixed forward.
- **Layouts** — the layout selector at the bottom-right of the HUD switches between one full-size
  view (any perspective), a two-way split with a camera menu on each panel (choosing the
  perspective already in the other panel swaps them), and the three-way split fixed as bird's-eye /
  departure observer / cockpit. One `<Canvas>`, one scene and one set of geometries and textures
  serve every panel: each panel is a scissored viewport rendered from its own camera, so resources
  are shared and panel rectangles are re-measured whenever the layout or window resizes. Switching
  layout keeps the journey, both clocks and each perspective's own framing untouched.
- **Shared simulation** — every panel reads the same `progressRef`, spacecraft position, velocity
  and clock values, so pause/resume and playback speed affect all views at once.
- **Teaching notes** — compact `?` tooltips in the HUD and panels explain reference frames, proper
  time, why the clocks diverge, why faster ships accumulate less proper time and why distant
  observers see delayed light (with the light-travel calculation behind the marker).
- **Fallback** — devices reporting four or fewer cores or little memory draw fewer stars, no
  antialiasing and a capped pixel ratio (noted in the HUD); browsers without WebGL get an
  explanatory panel instead of a blank stage.
- **Delayed signal** — for the constant-speed outbound leg, light emitted at reference time `t_e`
  from distance `β·t_e` reaches the origin at `t_e + β·t_e`. Setting that equal to the observer's
  current time gives `t_e = t/(1+β)`, so the retarded marker sits at progress `p/(1+β)`. This is a
  light-travel-time marker only: the MVP does not claim relativistic visual effects such as Doppler
  colour, aberration, or acceleration.
- **Controls** — Start, Pause, Resume, Restart, a playback selector, the camera selector and
  **Back to Travel Planner**. Restart is disabled once the ship has arrived.
- **Arrival** — a short transition, then the arrival panel marks the journey complete, logs it once,
  makes the destination world the current location, and offers **Explore This System** (the host
  system on the 3D map), **Choose Another Destination** (the route stage from the new location), or
  **Return to Earth** (the Travel Planner with Earth as the destination — no teleporting).
- **Model** — constant cruise speed for the whole leg, stationary endpoints, no acceleration or
  braking, and no gravitational clock corrections in transit.

## Star System Explorer

`/system/:id` (`SystemView`, `PlanetaryScene`, `SystemWorldPanel`) is a separate scene with its own
scale. The universe map stays in light-years; the local system works in **AU** —
`src/lib/planetSystem.js` defines one scene unit as one AU, so `pl_orbsmax` is drawn literally as the
orbital radius and the camera is framed to the system instead of sharing a galactic scale. No
conversion is applied between the two scenes.

Built from the archive rows for that host star:

- The host star sits at the centre, coloured by the derived effective temperature, with an
  exaggerated drawn radius (a real star is ~0.005 AU wide) that still follows the derived stellar
  radius, so a giant reads larger than a red dwarf.
- Every planet with `pl_orbsmax` is placed at that semi-major axis in a circular orbit, and its
  angular rate is `2π / pl_orbper` per simulated day. The simulation clock is a log slider
  (0.05–20 simulated days per real second) with pause. A world with an orbit but no reported period
  is drawn and labelled as not animated.
- Relative sizes follow the radius estimate (`radiusEarth`) through a square root, exaggerated for
  visibility; the extract has no `pl_rade`, so the inspector marks these as estimates and the
  surface texture as an artistic interpretation — never imagery.
- Orbits use deterministic **illustrative** starting phases from the planet name. The extract has no
  epoch or mean anomaly, so the app never claims a present-day planetary position.
- A planet whose row has no `pl_orbsmax` is never given an invented radius: it is listed in the
  inspector with an explicit **"Orbit not fully characterized"** state and stays off the rings.

Interactions: drag or scroll to orbit and zoom the star; click a planet, its projected label, or a
name in the inspector to select it and glide the camera toward it; toggle **Orbits** and **Labels**;
adjust simulation time; **Reset camera**; **View Planet** (`/planet/:id`); **Plan Travel**
(`/travel`); and **← Back to Universe**. The live scale bar reads in AU and an orientation gizmo
tracks the camera. `/planet/:id` is a data record page with a portrait of the world, and both routes
are real URLs, so they survive a reload (`src/lib/router.js`).

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

Simplifications: no orbital motion and no gravitational lensing. Speeds and mission profiles are
hypothetical; the destinations are real. Simple SR treats acceleration and braking as
instantaneous; Advanced SR gives them their real duration and distance (see below).

## Two Special-Relativity modes

Both modes share one physics service (`src/lib/advancedSR.js` + `src/lib/mission.js`), so the
Flight Plan preview, the flight animation, the clocks and the Debrief all read the same numbers.

- **Simple SR — constant velocity (default).** `beta = v/c`, `gamma = 1/sqrt(1 - beta^2)`,
  `earthTime = d / (beta*c)` and `shipTime = earthTime / gamma`. Acceleration and braking have
  zero simulated duration. Normalised burn energy stays `2*(gamma - 1)`.
- **Advanced SR — acceleration + cruise + braking.** One constant proper acceleration `a` for
  both burns. From rest to `beta`:

  ```
  t_acc   = (c/a) * beta * gamma          tau_acc = (c/a) * atanh(beta)
  d_acc   = (c^2/a) * (gamma - 1)         d_brake = d_acc, tau_brake = tau_acc
  ```

  If `d_acc + d_brake > D` the target speed is unreachable: the ship flies one symmetric arc
  with `gamma_peak = 1 + D*a/(2c^2)`, the cruise distance is exactly zero, and the interface
  reports the peak speed it will actually reach. No negative cruise distance is ever produced.
- **Trajectory and clocks.** The animation is driven by the same trajectory function as the
  clocks, via the relativistic rocket equations — `v(tau) = c*tanh(a*tau/c)`,
  `t(tau) = (c/a)*sinh(a*tau/c)`, `x(tau) = (c^2/a)*(cosh(a*tau/c) - 1)` — never `v = a*t`.
  Proper time is integrated through every phase, so the crew clock is not one cruise `gamma`
  applied to the whole trip. Earth-reference progress drives the timeline, so acceleration and
  braking take their real share of the voyage.
- **Launch and thrust feasibility.** `a_max = thrust / (dryMass + propellant)` and, for a
  surface departure, `requestedAcceleration > surfaceGravity` (measured mass and radius only;
  Earth uses the reference constants). The launch is refused with an explanation when either
  fails — a configuration problem, never an expedition-budget failure.
- **Not modelled:** gravitational time dilation, spacetime curvature, general relativity,
  atmospheric drag, fuel burn, changing vehicle mass and relativistic exhaust velocity. The
  interface says so in its "Physics assumptions" panel.

The Expedition Challenge reuses the same engine per leg: each leg gets its own accelerate /
cruise / brake solution, its attained peak speed, and `2*(gamma_peak - 1)` of normalised burn
energy plus the separate Newtonian escape energy. Budgets still fail only during execution.

## Project structure

```
src/
  App.jsx                 mission state: route → travel planner → live flight → arrival
  data/exoplanets.csv     NASA Exoplanet Archive extract (6,442 planets)
  lib/catalog.js          CSV parsing, systems, 3D positions, route distances, search
  lib/physics.js          time dilation, gravity, formatting
  lib/advancedSR.js       advanced-SR trajectory, clocks, energy and launch feasibility
  lib/mission.js          route + mode -> mission (shared by preview, launch and challenge)
  lib/flight.js           Live Flight clocks per mode, playback rate, retarded-signal progress
  lib/planet.js           classification, palettes, procedural textures, star colour
  lib/aging.js            biological stages
  lib/simulation.js       localStorage mission log
  lib/starMap.js          map-frame entries, 150 ly region, search, labels, exact map distances
  lib/planetSystem.js     local AU-scale system model: orbits, phases, sizes, camera framing
  lib/router.js           pathname routing for /system/:id, /planet/:id and /travel
  lib/glowTexture.js      shared star glow and halo sprites
  lib/webgl.js            one-time WebGL availability probe
  components/             scene, crew figures, HUD, picker, travel planner, debrief
  components/travel/      Travel Planner, system picker, Live Flight page and HUD
  components/travel/flight/  Live Flight multi-camera stage, view panels, HUD and camera maths
  components/map/         3D universe map and the AU-scale Star System Explorer scene
  components/PlanetDetailView.jsx  /planet/:id record page and its portrait
  components/lab/Spacecraft.jsx   procedural ship used by the flight scenes
```

## Roadmap

- Acceleration/deceleration phases and the twin paradox on a return trip
- Waypoint routes with a map of the whole journey
- Gravitational time dilation around compact objects
- Refreshing the CSV directly from the NASA API at build time

## Credits

Planetary data: [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) — a service of
NASA's Exoplanet Exploration Program.
