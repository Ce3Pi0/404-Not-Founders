import { useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import DestinationPicker from './components/DestinationPicker'
import PlanetStage from './components/PlanetStage'
import FlightPlan from './components/FlightPlan'
import JourneyStage from './components/JourneyStage'
import Debrief from './components/Debrief'
import AboutDialog from './components/AboutDialog'
import RelativityLab from './components/lab/RelativityLab'
import StarMapView from './components/map/StarMapView'
import SystemView from './components/map/SystemView'
import PlanetDetailView from './components/PlanetDetailView'
import {
  TRAVEL_PATH,
  isTravelPath,
  navigate,
  planetIdFromPath,
  systemIdFromPath,
  usePathname,
} from './lib/router'
import { systemById, systemId } from './lib/starMap'
import { simulateMission } from './lib/physics'
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
  const [beta, setBeta] = useState(0.9)
  const [shipName, setShipName] = useState('Odyssey')
  const [prediction, setPrediction] = useState({ earth: '', ship: '' })
  const [mission, setMission] = useState(null)
  const [sim, setSim] = useState(loadSimulation)
  const [aboutOpen, setAboutOpen] = useState(false)
  // Selected star + camera framing survive a trip to /system/:id and back.
  const mapViewState = useRef({
    selected: null,
    planetId: null,
    camera: { position: null, target: null },
  })

  // The deep links own their screens: /system/:id, /planet/:id and /travel
  // render even on a cold load or a browser reload, with the step machine for
  // everything else.
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
    navigate('/')
    setStepState(next)
  }

  const launch = () => {
    const result = simulateMission(distanceLy, beta)
    setMission({
      ...result,
      origin: location.name,
      originId: location.id,
      planet: planet.name,
      planetId: planet.id,
      shipName: shipName.trim() || 'Odyssey',
      distanceLy,
      startedAt: Date.now(),
    })
    goTo('journey')
  }

  const arrive = () => {
    if (!mission) return
    setSim((current) => recordMission(current, mission))
    setLocation(planet)
    goTo('debrief')
  }

  const nextMission = () => {
    const here = location
    setMission(null)
    setPrediction({ earth: '', ship: '' })
    if (planet.id === here.id) {
      const replacement = nearbyPlanets(here, 8).find((entry) => entry.id !== here.id)
      if (replacement) setPlanet(replacement)
    }
    goTo('destination')
  }

  const goHome = () => {
    setLocation(EARTH)
    setMission(null)
    setPrediction({ earth: '', ship: '' })
    if (planet.kind === 'earth') {
      const replacement = nearbyPlanets(EARTH, 8).find((entry) => entry.id !== EARTH.id)
      if (replacement) setPlanet(replacement)
    }
    goTo('destination')
  }

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
    setPrediction({ earth: '', ship: '' })
    goTo('destination')
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header
        step={step}
        sim={sim}
        location={location}
        onGoHome={goHome}
        onAbout={() => setAboutOpen(true)}
        onReset={reset}
        inLab={step === 'lab'}
        onOpenLab={() => goTo(step === 'lab' ? 'destination' : 'lab')}
        inMap={step === 'map'}
        onOpenMap={openMap}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4 lg:px-8 lg:py-6">
        {step === 'destination' && (
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
              onOpenMap={() => {
                navigate('/')
                setStepState('map')
              }}
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
              onSetDestination={mapSetDestination}
              onSetOrigin={mapSetOrigin}
              onExplore={exploreSystem}
              onExit={() => goTo('destination')}
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
          <FlightPlan
            origin={location}
            planet={planet}
            distanceLy={distanceLy}
            beta={beta}
            onBetaChange={setBeta}
            shipName={shipName}
            onShipNameChange={setShipName}
            prediction={prediction}
            onPredictionChange={setPrediction}
            onLaunch={launch}
            onBack={() => goTo('destination')}
          />
        )}

        {step === 'journey' && mission && (
          <JourneyStage
            key={mission.startedAt}
            origin={location}
            planet={planet}
            mission={mission}
            shipName={mission.shipName}
            onArrive={arrive}
          />
        )}

        {step === 'lab' && (
          <RelativityLab shipName={shipName} onExit={() => goTo('destination')} />
        )}

        {step === 'debrief' && mission && (
          <Debrief
            mission={mission}
            planet={planet}
            origin={location}
            prediction={prediction}
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

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}
