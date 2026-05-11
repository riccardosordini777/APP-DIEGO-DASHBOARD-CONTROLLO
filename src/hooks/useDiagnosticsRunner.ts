import { useEffect } from 'react'
import { useDashboardStore } from '../store/useDashboardStore'
import { runDiagnostics } from '../lib/diagnosticEngine'

/**
 * Ricalcola le diagnostiche (Intelligent Highlighter) ogni volta che:
 *  - un modulo viene caricato/aggiornato/rimosso
 *  - i filtri globali cambiano
 *
 * Va montato una sola volta in App.tsx.
 */
export function useDiagnosticsRunner() {
  const parsedModules = useDashboardStore((s) => s.parsedModules)
  const filters = useDashboardStore((s) => s.filters)
  const setDiagnostics = useDashboardStore((s) => s.setDiagnostics)

  useEffect(() => {
    // Se nessun modulo è caricato, mappa vuota
    if (Object.keys(parsedModules).length === 0) {
      setDiagnostics({})
      return
    }
    const map = runDiagnostics(filters)
    setDiagnostics(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedModules, filters])
}
