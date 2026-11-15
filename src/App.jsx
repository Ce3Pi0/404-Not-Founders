import { useEffect, useState } from 'react'
import Header from './components/Header'
import DestinationPicker from './components/DestinationPicker'
import PlanetStage from './components/PlanetStage'
import FlightPlan from './components/FlightPlan'
import JourneyStage from './components/JourneyStage'
import Debrief from './components/Debrief'
import AboutDialog from './components/AboutDialog'
import RelativityLab from './components/lab/RelativityLab'
import StarMapView from './components/map/StarMapView'
import { simulateMission } from './lib/physics'
import { emptySimulation, loadSimulation, recordMission, saveSimulation } from './lib/simulation'
import { DEFAULT_PLANET, EARTH, distanceLyBetween, nearbyPlanets } from './lib/catalog'


export default function App() {
  const [step, setStep] = useState('destination')
  const [location, setLocation] = useState(EARTH)
  const [planet, setPlanet] = useState(DEFAULT_PLANET)
  const [beta, setBeta] = useState(0.9)
  const [shipName, setShipName] = useState('Odyssey')
  const [prediction, setPrediction] = useState({ earth: '', ship: '' })
  const [mission, setMission] = useState(null)
  const [sim, setSim] = useState(loadSimulation)
  const [aboutOpen, setAboutOpen] = useState(false)

  const distanceLy = distanceLyBetween(location, planet)

  useEffect(() => {
    saveSimulation(sim)
  }, [sim])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

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
    setStep('journey')
  }

  const arrive = () => {
    if (!mission) return
    setSim((current) => recordMission(current, mission))
    setLocation(planet)
    setStep('debrief')
  }

  const nextMission = () => {
    const here = location
    setMission(null)
    setPrediction({ earth: '', ship: '' })
    if (planet.id === here.id) {
      const replacement = nearbyPlanets(here, 8).find((entry) => entry.id !== here.id)
      if (replacement) setPlanet(replacement)
    }
    setStep('destination')
  }

  const goHome = () => {
    setLocation(EARTH)
    setMission(null)
    setPrediction({ earth: '', ship: '' })
    if (planet.kind === 'earth') {
      const replacement = nearbyPlanets(EARTH, 8).find((entry) => entry.id !== EARTH.id)
      if (replacement) setPlanet(replacement)
    }
    setStep('destination')
  }

  // The 3D map edits the same origin/destination state as the picker.
  const mapSetDestination = (next) => {
    if (!next || next.id === location.id) return
    setPlanet(next)
    setStep('destination')
  }

  const mapSetOrigin = (next) => {
    if (!next) return
    setLocation(next)
    if (next.id === planet.id) {
      const replacement = nearbyPlanets(next, 6).find((entry) => entry.id !== next.id)
      if (replacement) setPlanet(replacement)
    }
    setStep('destination')
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
    setStep('destination')
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
        onOpenLab={() => setStep(step === 'lab' ? 'destination' : 'lab')}
        inMap={step === 'map'}
        onOpenMap={() => setStep(step === 'map' ? 'destination' : 'map')}
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
              onContinue={() => setStep('flight')}
              onGoHome={goHome}
              onOpenMap={() => setStep('map')}
            />
          </div>
        )}

        {step === 'map' && (
          <StarMapView
            origin={location}
            planet={planet}
            onSetDestination={mapSetDestination}
            onSetOrigin={mapSetOrigin}
            onExit={() => setStep('destination')}
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
            onBack={() => setStep('destination')}
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
          <RelativityLab shipName={shipName} onExit={() => setStep('destination')} />
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
