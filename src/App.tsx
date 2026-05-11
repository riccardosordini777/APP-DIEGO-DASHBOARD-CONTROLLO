import { AnimatePresence, motion } from 'framer-motion'
import { useDashboardStore } from './store/useDashboardStore'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { GlobalFilterBar } from './components/ui/GlobalFilterBar'
import { DashboardHome } from './components/DashboardHome'
import { AnalystDrawer } from './components/AnalystDrawer'
import { ValidationErrorsModal } from './components/ValidationErrorsModal'
import { LoginPage } from './pages/LoginPage'
import { CanalizzazioniPage } from './pages/CanalizzazioniPage'
import { IncassiPage } from './pages/IncassiPage'
import { ProduzionePage } from './pages/ProduzionePage'
import { PianiLavoroPage } from './pages/PianiLavoroPage'
import { ComparaPage } from './pages/ComparaPage'
import { TooltipProvider } from './components/ui/tooltip'
import { useDiagnosticsRunner } from './hooks/useDiagnosticsRunner'

function AppContent() {
  const { activeTab } = useDashboardStore()

  useDiagnosticsRunner()

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-[#050507] overflow-hidden text-[#e4e4e7]">
        <Sidebar />

        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <TopBar />
          <GlobalFilterBar />

          <main className="flex-1 overflow-y-auto bg-surface relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                {activeTab === 'cruscotto'      && <DashboardHome />}
                {activeTab === 'produzione'     && <ProduzionePage />}
                {activeTab === 'canalizzazioni' && <CanalizzazioniPage />}
                {activeTab === 'incassi'        && <IncassiPage />}
                {activeTab === 'piani_lavoro'   && <PianiLavoroPage />}
                {activeTab === 'confronta'      && <ComparaPage />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <AnalystDrawer />
        <ValidationErrorsModal />
      </div>
    </TooltipProvider>
  )
}

export default function App() {
  const { isAuthenticated } = useDashboardStore()
  return isAuthenticated ? <AppContent /> : <LoginPage />
}
