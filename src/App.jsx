import { useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import DestinationPicker from './components/DestinationPicker'
import PlanetStage from './components/PlanetStage'
import TravelPlanner from './components/TravelPlanner'
import LiveFlight from './components/travel/LiveFlight'
import Debrief from './components/Debrief'
import AboutDialog from './components/AboutDialog'
import StarMapView from './components/map/StarMapView'
import SystemView from './components/map/SystemView'
import PlanetDetailView from './components/PlanetDetailView'
import EarthOrbitHero from './components/orbit/EarthOrbitHero'
import ChallengeShell from './components/challenge/ChallengeShell'
import {
  CHALLENGE_PATHS,
  TRAVEL_PATH,
  challengeRouteFromPath,
  isTravelPath,
  navigate,
  planetIdFromPath,
  systemIdFromPath,
  usePathname,
} from './lib/router'
import { systemById, systemId } from './lib/starMap'
import { missionPhysics, planMission, readPhysicsConfig } from './lib/mission'
import { usePhysicsStore } from './store/physicsStore'
import { emptySimulation, loadSimulation, recordMission, saveSimulation } from './lib/simulation'
import { DEFAULT_PLANET, EARTH, distanceLyBetween, nearbyPlanets, planetById } from './lib/catalog'

export default function App() {
  const pathname = usePathname()
  const [stepState, setStepState] = useState('destination')
  const [location, setLocation] = useState(EARTH)
  const [planet, setPlanet] = useState(() => {
    const id = planetIdFromPath(window.location.pathname)
    return id ? planetById(id) : DEFAULT_PLANET
  })
  const [beta, setBeta] = useState(0.8)
  const [shipName, setShipName] = useState('Odyssey')
  const [mission, setMission] = useState(null)
  // The debrief only exists once the ship has actually arrived; until then its
  // clocks are the planned voyage, not time that has elapsed.
  const [missionArrived, setMissionArrived] = useState(false)
  const [sim, setSim] = useState(loadSimulation)
  const [aboutOpen, setAboutOpen] = useState(false)
  // Set when the map is entered from Earth orbit, so it opens on the Solar
  // System and pulls the camera back out instead of jumping straight to home.
  const [mapArrival, setMapArrival] = useState(null)
  // Full-screen cover used for the Earth <-> star map handoff.
  const [warp, setWarp] = useState(null)
  const warpTimer = useRef(null)
  const transitioning = useRef(false)
  // A journey records its mission exactly once, when the ship actually arrives.
  const recordedMission = useRef(null)
  // Selected star + camera framing survive a trip to /system/:id and back.
  const mapViewState = useRef({
    selected: null,
    planetId: null,
    camera: { position: null, target: null },
  })

  // The deep links own their screens: /system/:id, /planet/:id and /travel
  // render even on a cold load or a browser reload, with the step machine for
  // everything else.
  const challengeRoute = challengeRouteFromPath(pathname)
  const pathSystem = systemById(systemIdFromPath(pathname))
  const pathPlanetId = planetIdFromPath(pathname)
  const step = pathSystem
    ? 'map'
    : pathPlanetId
      ? 'planet'
      : isTravelPath(pathname)
        ? 'flight'
        : stepState

  const distanceLy = distanceLyBetween(location, planet)

  useEffect(() => {
    saveSimulation(sim)
  }, [sim])

  useEffect(() => () => clearTimeout(warpTimer.current), [])

  /** A planet deep link selects that world, so its page and travel share it. */
  useEffect(() => {
    if (!pathPlanetId) return
    const found = planetById(pathPlanetId)
    if (found && found.id !== planet.id) setPlanet(found)
  }, [pathPlanetId, planet.id])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  /** Every step transition leaves a deep link, so the URL never lies. */
  const goTo = (next) => {
    if (next === 'journey') setMissionArrived(false)
    navigate('/')
    setStepState(next)
  }

  const launch = () => {
    const { advanced, config } = readPhysicsConfig()
    const plan = planMission({
      origin: location,
      destination: planet,
      distanceLy,
      beta,
      advanced,
      config,
    })
    // An impossible launch never starts: the planner keeps the flight plan open
    // with its feasibility warnings.
    if (plan.mode === 'advanced' && plan.feasibility && !plan.feasibility.ok) return
    setMission({
      ...missionPhysics(plan),
      origin: location.name,
      originId: location.id,
      planet: planet.name,
      planetId: planet.id,
      shipName: shipName.trim() || 'Odyssey',
      distanceLy,
      // Snapshot both ends so the flight scene keeps the exact systems the
      // mission launched with, even after the arrival updates the current system.
      originPlanet: location,
      destinationPlanet: planet,
      startedAt: Date.now(),
    })
    goTo('journey')
  }

  /** The ship reached its destination: log the trip once, then move the crew. */
  const arrive = () => {
    if (!mission || recordedMission.current === mission.startedAt) return
    recordedMission.current = mission.startedAt
    setMissionArrived(true)
    setSim((current) => recordMission(current, mission))
    usePhysicsStore.getState().recordResult(mission)
    setLocation(mission.destinationPlanet ?? planet)
  }

  /** Live Flight → Travel Planner, abandoning the run in progress. */
  const backToPlanner = () => {
    setMission(null)
    setMissionArrived(false)
    navigate(TRAVEL_PATH)
    setStepState('flight')
  }

  /** Arrival: open the destination's host system on the 3D map. */
  const exploreArrival = () => {
    const arrival = mission?.destinationPlanet
    if (!arrival) return
    mapViewState.current.planetId = arrival.id
    setPlanet(arrival)
    setMission(null)
    setMissionArrived(false)
    exploreSystem({ name: arrival.star })
  }

  /**
   * Arrival: "Return to Earth" plans the trip home from the current system —
   * the crew is never teleported between stars.
   */
  const returnToEarthFromFlight = () => {
    const here = location
    setMission(null)
    setMissionArrived(false)
    if (here.kind === 'earth') {
      goTo('destination')
      return
    }
    setPlanet(EARTH)
    goTo('flight')
  }

  const nextMission = () => {
    const here = location
    setMission(null)
    setMissionArrived(false)
    if (planet.id === here.id) {
      // The next hop crosses to another host system, not a sibling world.
      const replacement = nearbyPlanets(here, 12).find(
        (entry) => entry.id !== here.id && entry.star !== here.star,
      )
      if (replacement) setPlanet(replacement)
    }
    goTo('destination')
  }

  const goHome = () => {
    setLocation(EARTH)
    setMission(null)
    setMissionArrived(false)
    if (planet.kind === 'earth') {
      const replacement = nearbyPlanets(EARTH, 8).find((entry) => entry.id !== EARTH.id)
      if (replacement) setPlanet(replacement)
    }
    goTo('destination')
  }

  /**
   * The Earth orbit scene and the star map are separate renders at separate
   * scales. This is the handoff: a cover fades in over the running scene, the
   * next screen mounts underneath it, and the cover lifts on the other side.
   */
  const beginTransition = (label, run) => {
    if (transitioning.current) return
    transitioning.current = true
    setWarp(label)
    clearTimeout(warpTimer.current)
    warpTimer.current = setTimeout(() => {
      run()
      setWarp(null)
      transitioning.current = false
    }, 640)
  }

  /** Earth orbit → the real star map, opening from the Solar System outward. */
  const exploreUniverse = () =>
    beginTransition(
      location.kind === 'earth' ? 'Leaving Earth orbit' : `Leaving ${location.name}`,
      () => {
        // Only an Earth departure starts the map on the Solar System.
        setMapArrival(location.kind === 'earth' ? Date.now() : null)
        goTo('map')
      },
    )

  /** Zooming into the Solar System → back into the Earth orbital scene. */
  const returnToEarthOrbit = () =>
    beginTransition('Entering Earth orbit', () => {
      setMapArrival(null)
      goTo('destination')
    })

  // The 3D map edits the same origin/destination state as the picker.
  const mapSetDestination = (next) => {
    if (!next || next.id === location.id) return
    setPlanet(next)
    goTo('destination')
  }

  const mapSetOrigin = (next) => {
    if (!next) return
    setLocation(next)
    if (next.id === planet.id) {
      const replacement = nearbyPlanets(next, 6).find((entry) => entry.id !== next.id)
      if (replacement) setPlanet(replacement)
    }
    goTo('destination')
  }

  const openMap = () => {
    if (step === 'map') {
      goTo('destination')
      return
    }
    navigate('/')
    setStepState('map')
  }

  const exploreSystem = (entry) => {
    if (!entry) return
    // Coming back from a system page restores its framing, not the solar entry.
    setMapArrival(null)
    setStepState('map')
    navigate(`/system/${systemId(entry)}`)
  }

  /** "← Back to Universe" always returns to the 3D star map, not the picker. */
  const backToUniverse = () => {
    navigate('/')
    setStepState('map')
  }

  // Star System Explorer deep links.
  const viewPlanet = (next) => {
    if (!next) return
    setPlanet(next)
    mapViewState.current.planetId = next.id
    navigate(`/planet/${next.id}`)
    setStepState('planet')
  }

  const planTravel = (next) => {
    if (!next) return
    setPlanet(next)
    navigate(TRAVEL_PATH)
    setStepState('flight')
  }

  // Travel Planner endpoints. The current location is the departure; changing
  // either side leaves the rest of the mission state untouched.
  const planChangeDeparture = (next) => {
    if (!next) return
    setLocation(next)
  }

  const planChangeDestination = (next) => {
    if (!next) return
    setPlanet(next)
  }

  const planReturnToEarth = () => {
    if (location.id !== EARTH.id) setPlanet(EARTH)
  }

  const backToSystem = (next) => {
    if (!next) return
    mapViewState.current.planetId = next.id
    navigate(`/system/${systemId({ name: next.star })}`)
    setStepState('map')
  }

  const reset = () => {
    if (sim.missions.length > 0 && !window.confirm('Reset the simulation and clear the mission log?')) {
      return
    }
    setSim(emptySimulation())
    setLocation(EARTH)
    setPlanet(DEFAULT_PLANET)
    setMission(null)
    setMissionArrived(false)
    goTo('destination')
  }

  // Expedition Challenge is its own mode with its own shell and store.
  if (challengeRoute) return <ChallengeShell route={challengeRoute} />

  return (
    <div className="flex min-h-full flex-col">
      <Header
        step={step}
        sim={sim}
        location={location}
        onGoHome={goHome}
        onAbout={() => setAboutOpen(true)}
        onReset={reset}
        canDebrief={Boolean(mission) && missionArrived}
        onSelectStep={(target) => {
          // Journey needs a launched mission; the debrief needs an arrival.
          if (target === 'journey' && !mission) return
          if (target === 'debrief' && !(mission && missionArrived)) return
          goTo(target)
        }}
        inMap={step === 'map'}
        onOpenMap={openMap}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4 lg:px-8 lg:py-6">
        {step === 'destination' && location.kind === 'earth' && (
          <div className="space-y-4">
            <EarthOrbitHero
              onExploreUniverse={exploreUniverse}
              onSelectPlanet={viewPlanet}
              onStartChallenge={() => navigate(CHALLENGE_PATHS.intro)}
              onPlanRoute={() =>
                document.getElementById('route-planner')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }
            />
            <section id="route-planner" className="screen mx-auto w-full max-w-3xl scroll-mt-24">
              <DestinationPicker
                origin={location}
                planet={planet}
                distanceLy={distanceLy}
                onOriginChange={setLocation}
                onSelect={setPlanet}
                onContinue={() => goTo('flight')}
                onGoHome={goHome}
                onOpenMap={exploreUniverse}
                onStartChallenge={() => navigate(CHALLENGE_PATHS.intro)}
              />
            </section>
          </div>
        )}

        {/* Away from Earth the orbit scene becomes a portrait of where the crew
            actually is, with the same route planner beside it. */}
        {step === 'destination' && location.kind !== 'earth' && (
          <div className="screen grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="min-w-0 lg:sticky lg:top-[84px] lg:self-start">
              <PlanetStage
                planet={location}
                earthYears={sim.earthYears}
                alienYears={sim.earthYears}
                onGoHome={goHome}
              />
            </div>
            <DestinationPicker
              origin={location}
              planet={planet}
              distanceLy={distanceLy}
              onOriginChange={setLocation}
              onSelect={setPlanet}
              onContinue={() => goTo('flight')}
              onGoHome={goHome}
              onOpenMap={exploreUniverse}
              onStartChallenge={() => navigate(CHALLENGE_PATHS.intro)}
            />
          </div>
        )}

        {step === 'map' &&
          (pathSystem ? (
            <SystemView
              entry={pathSystem}
              origin={location}
              initialPlanetId={mapViewState.current.planetId}
              onBack={backToUniverse}
              onViewPlanet={viewPlanet}
              onPlanTravel={planTravel}
            />
          ) : (
            <StarMapView
              origin={location}
              planet={planet}
              viewState={mapViewState}
              arrival={mapArrival}
              onSetDestination={mapSetDestination}
              onSetOrigin={mapSetOrigin}
              onExplore={exploreSystem}
              onExit={() => goTo('destination')}
              onReturnToEarth={returnToEarthOrbit}
              onStartChallenge={() => navigate(CHALLENGE_PATHS.intro)}
            />
          ))}

        {step === 'planet' && (
          <PlanetDetailView
            planet={planet}
            origin={location}
            distanceLy={distanceLy}
            onBack={backToUniverse}
            onBackToSystem={() => backToSystem(planet)}
            onPlanTravel={planTravel}
          />
        )}

        {step === 'flight' && (
          <TravelPlanner
            origin={location}
            destination={planet}
            distanceLy={distanceLy}
            beta={beta}
            onBetaChange={setBeta}
            shipName={shipName}
            onShipNameChange={setShipName}
            onLaunch={launch}
            onChangeDeparture={planChangeDeparture}
            onChangeDestination={planChangeDestination}
            onReturnToEarth={planReturnToEarth}
            onReturnToMap={backToUniverse}
          />
        )}

        {step === 'journey' && mission && (
          <LiveFlight
            key={mission.startedAt}
            mission={mission}
            origin={mission.originPlanet ?? location}
            destination={mission.destinationPlanet ?? planet}
            shipName={mission.shipName}
            onArrive={arrive}
            onBack={backToPlanner}
            onExplore={exploreArrival}
            onChooseDestination={nextMission}
            onReturnToEarth={returnToEarthFromFlight}
            onDebrief={() => goTo('debrief')}
          />
        )}

        {step === 'debrief' && mission && missionArrived && (
          <Debrief
            mission={mission}
            planet={planet}
            origin={location}
            sim={sim}
            onNext={nextMission}
            onReset={reset}
            onGoHome={goHome}
          />
        )}
      </main>

      <footer className="border-t border-line/50 px-4 py-4 lg:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-1 text-[10px] text-ink/45 sm:flex-row">
          <span>404 Not Founders · Hack The Nest · Beyond Time v0.2</span>
          <span>Planetary data: NASA Exoplanet Archive CSV extract (6,442 planets)</span>
        </div>
      </footer>

      {warp && (
        <div
          className="warp-fade fixed inset-0 z-[60] flex items-center justify-center bg-[#04010c]"
          data-testid="earth-orbit-transition"
          role="status"
          aria-live="polite"
        >
          <div className="text-center">
            <div className="text-[9px] font-semibold tracking-[0.3em] text-white/40 uppercase">
              Sol system
            </div>
            <div className="mt-2 text-[12px] tracking-[0.28em] text-white/85 uppercase">{warp}</div>
          </div>
        </div>
      )}

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}
