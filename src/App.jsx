import { useEffect, useState } from 'react'
import Header from './components/Header'
import DestinationPicker from './components/DestinationPicker'
import PlanetStage from './components/PlanetStage'
import FlightPlan from './components/FlightPlan'
import JourneyStage from './components/JourneyStage'
import Debrief from './components/Debrief'
import AboutDialog from './components/AboutDialog'
import { DEFAULT_PLANET } from './lib/catalog'
import { simulateMission } from './lib/physics'
import { emptySimulation, loadSimulation, recordMission, saveSimulation } from './lib/simulation'

export default function App() {
  const [step, setStep] = useState('destination')
  const [planet, setPlanet] = useState(DEFAULT_PLANET)
  const [beta, setBeta] = useState(0.9)
  const [shipName, setShipName] = useState('Odyssey')
  const [prediction, setPrediction] = useState({ earth: '', ship: '' })
  const [mission, setMission] = useState(null)
  const [sim, setSim] = useState(loadSimulation)
  const [aboutOpen, setAboutOpen] = useState(false)

  useEffect(() => {
    saveSimulation(sim)
  }, [sim])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const launch = () => {
    const result = simulateMission(planet.distanceLy, beta)
    setMission({
      ...result,
      planet: planet.name,
      planetId: planet.id,
      shipName: shipName.trim() || 'Odyssey',
      distanceLy: planet.distanceLy,
      startedAt: Date.now(),
    })
    setStep('journey')
  }

  const arrive = () => {
    if (!mission) return
    setSim((current) => recordMission(current, mission))
    setStep('debrief')
  }

  const nextMission = () => {
    setMission(null)
    setPrediction({ earth: '', ship: '' })
    setStep('destination')
  }

  const reset = () => {
    if (sim.missions.length > 0 && !window.confirm('Reset the simulation and clear the mission log?')) {
      return
    }
    setSim(emptySimulation())
    setMission(null)
    setPrediction({ earth: '', ship: '' })
    setStep('destination')
  }

  const alienYears = sim.earthYears

  return (
    <div className="flex min-h-full flex-col">
      <Header step={step} sim={sim} onAbout={() => setAboutOpen(true)} onReset={reset} />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4 lg:px-8 lg:py-6">
        {step === 'destination' && (
          <div className="screen grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="min-w-0 lg:sticky lg:top-[84px] lg:self-start">
              <PlanetStage planet={planet} earthYears={sim.earthYears} alienYears={alienYears} />
            </div>
            <DestinationPicker
              planet={planet}
              onSelect={setPlanet}
              onContinue={() => setStep('flight')}
            />
          </div>
        )}

        {step === 'flight' && (
          <FlightPlan
            planet={planet}
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
            planet={planet}
            mission={mission}
            shipName={mission.shipName}
            onArrive={arrive}
          />
        )}

        {step === 'debrief' && mission && (
          <Debrief
            mission={mission}
            planet={planet}
            prediction={prediction}
            sim={sim}
            onNext={nextMission}
            onReset={reset}
          />
        )}
      </main>

      <footer className="border-t border-line/60 px-4 py-4 lg:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-1 text-[10px] text-muted/70 sm:flex-row">
          <span>404 Not Founders · Hack The Nest · Beyond Time v0.1</span>
          <span>Planetary data: NASA Exoplanet Archive (pscomppars)</span>
        </div>
      </footer>

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}
