import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle, TrendingUp, Sparkles, AlertTriangle } from 'lucide-react'
import { useDashboardStore } from '../store/useDashboardStore'
import { col, parseNumber } from '../lib/sanitize'

interface Alert {
  id: string
  type: 'critical' | 'warning' | 'positive'
  title: string
  message: string
}

function useAnalystAlerts(): Alert[] {
  const { parsedModules } = useDashboardStore()
  return useMemo(() => {
    const alerts: Alert[] = []

    // SI014 — Canalizzazioni
    const si014 = parsedModules['si014']
    if (si014 && si014.rows.length > 0) {
      const pvMap: Record<string, { si: number; tot: number }> = {}
      si014.rows.forEach((r) => {
        const pv = col(r, ['pv', 'Punto vendita', 'PV']) || 'N/D'
        if (!pvMap[pv]) pvMap[pv] = { si: 0, tot: 0 }
        pvMap[pv].tot++
        const isCanal = col(r, ['canalizzato', 'Canalizzato']).toUpperCase() === 'SI'
        if (isCanal) pvMap[pv].si++
      })
      Object.entries(pvMap).forEach(([pv, { si, tot }]) => {
        const pct = (si / tot) * 100
        if (pct < 40 && tot >= 10) {
          alerts.push({
            id: `canal-critical-${pv}`,
            type: 'critical',
            title: `Canalizzazione critica — ${pv}`,
            message: `Tasso di canalizzazione: ${pct.toFixed(1)}% (${si}/${tot} sinistri). Soglia minima: 40%.`,
          })
        } else if (pct < 60 && tot >= 10) {
          alerts.push({
            id: `canal-warning-${pv}`,
            type: 'warning',
            title: `Canalizzazione sotto target — ${pv}`,
            message: `Tasso di canalizzazione: ${pct.toFixed(1)}% (${si}/${tot} sinistri). Target: >60%.`,
          })
        }
      })
    }

    // NA302 — Cruscotto confronto AC vs AP
    const na302 = parsedModules['na302']
    if (na302 && na302.rows.length > 0) {
      const pvMap: Record<string, { ac: number; ap: number }> = {}
      na302.rows.forEach((r) => {
        const pv = col(r, ['pv', 'Punto vendita', 'PV']) || 'N/D'
        if (!pvMap[pv]) pvMap[pv] = { ac: 0, ap: 0 }
        pvMap[pv].ac += parseNumber(r['premi'])
        pvMap[pv].ap += parseNumber(r['annioPrecedente'])
      })
      Object.entries(pvMap).forEach(([pv, { ac, ap }]) => {
        if (ap > 0) {
          const delta = ((ac - ap) / ap) * 100
          if (delta < -10) {
            alerts.push({
              id: `produz-drop-${pv}`,
              type: 'critical',
              title: `Calo produzione — ${pv}`,
              message: `Premi AC vs AP: ${delta.toFixed(1)}%. Flessione superiore al 10% rispetto all'anno precedente.`,
            })
          } else if (delta > 10) {
            alerts.push({
              id: `produz-up-${pv}`,
              type: 'positive',
              title: `Crescita produzione — ${pv}`,
              message: `Premi AC vs AP: +${delta.toFixed(1)}%. Ottima performance rispetto all'anno precedente.`,
            })
          }
        }
      })
    }

    if (alerts.length === 0) {
      alerts.push({
        id: 'no-data',
        type: 'warning',
        title: 'Nessun dato da analizzare',
        message: 'Carica i tracciati Excel per attivare il motore di analisi.',
      })
    }

    return alerts.sort((a, b) => {
      const order = { critical: 0, warning: 1, positive: 2 }
      return order[a.type] - order[b.type]
    })
  }, [parsedModules])
}

export function AnalystDrawer() {
  const { isAnalystOpen, setAnalystOpen } = useDashboardStore()
  const alerts = useAnalystAlerts()

  const critical = alerts.filter((a) => a.type === 'critical')
  const warning = alerts.filter((a) => a.type === 'warning')
  const positive = alerts.filter((a) => a.type === 'positive')

  return (
    <AnimatePresence>
      {isAnalystOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAnalystOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full w-[420px] bg-[#121214] border-l border-[#1f1f22] shadow-2xl z-50 flex flex-col"
          >
            <div className="p-6 border-b border-[#1f1f22] flex items-center justify-between sticky top-0 bg-[#121214]/90 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-electric/10 border border-electric/20 flex items-center justify-center text-electric">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="text-zinc-100 font-semibold">Analista Strategico</h2>
                  <p className="text-base text-zinc-400">
                    {alerts.filter((a) => a.type === 'critical').length} alert critici
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAnalystOpen(false)}
                className="p-2 rounded-full hover:bg-[#1a1a1e] text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {critical.length > 0 && (
                <section>
                  <h3 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-red" />
                    Alert Critici ({critical.length})
                  </h3>
                  <div className="space-y-3">
                    {critical.map((a) => (
                      <div key={a.id} className="bg-[#1a1a1e] border border-accent-red/20 rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="text-accent-red shrink-0 mt-0.5" size={16} />
                          <div>
                            <h4 className="text-base font-medium text-zinc-200">{a.title}</h4>
                            <p className="text-base text-zinc-400 mt-1 leading-relaxed">{a.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {warning.length > 0 && (
                <section>
                  <h3 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    Da Monitorare ({warning.length})
                  </h3>
                  <div className="space-y-3">
                    {warning.map((a) => (
                      <div key={a.id} className="bg-[#1a1a1e] border border-yellow-500/20 rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={16} />
                          <div>
                            <h4 className="text-base font-medium text-zinc-200">{a.title}</h4>
                            <p className="text-base text-zinc-400 mt-1 leading-relaxed">{a.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {positive.length > 0 && (
                <section>
                  <h3 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-green" />
                    Performance Ottime ({positive.length})
                  </h3>
                  <div className="space-y-3">
                    {positive.map((a) => (
                      <div key={a.id} className="bg-[#1a1a1e] border border-accent-green/20 rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                          <TrendingUp className="text-accent-green shrink-0 mt-0.5" size={16} />
                          <div>
                            <h4 className="text-base font-medium text-zinc-200">{a.title}</h4>
                            <p className="text-base text-zinc-400 mt-1 leading-relaxed">{a.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
