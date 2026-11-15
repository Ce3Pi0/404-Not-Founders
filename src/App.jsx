import { useEffect } from 'react'
import Header from './components/Header'
import DestinationPicker from './components/DestinationPicker'
import PlanetStage from './components/PlanetStage'
import FlightPlan from './components/FlightPlan'
import JourneyStage from './components/JourneyStage'
import Debrief from './components/Debrief'
import AboutDialog from './components/AboutDialog'
import RelativityLab from './components/lab/RelativityLab'
import { useAppStore } from './store/appStore'

export default function App() {
  const step = useAppStore((state) => state.step)
  const mission = useAppStore((state) => state.mission)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4 lg:px-8 lg:py-6">
        {step === 'destination' && (
          <div className="screen grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="min-w-0 lg:sticky lg:top-[84px] lg:self-start">
              <PlanetStage />
            </div>
            <DestinationPicker />
          </div>
        )}

        {step === 'flight' && <FlightPlan />}

        {step === 'journey' && mission && <JourneyStage key={mission.startedAt} />}

        {step === 'lab' && <RelativityLab />}

        {step === 'debrief' && mission && <Debrief />}
      </main>

      <footer className="border-t border-line/50 px-4 py-4 lg:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-1 text-[10px] text-ink/45 sm:flex-row">
          <span>404 Not Founders · Hack The Nest · Beyond Time v0.2</span>
          <span>Planetary data: NASA Exoplanet Archive CSV extract (6,442 planets)</span>
        </div>
      </footer>

      <AboutDialog />
    </div>
  )
}
