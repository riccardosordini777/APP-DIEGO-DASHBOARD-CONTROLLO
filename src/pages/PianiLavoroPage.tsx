import { motion } from 'framer-motion'
import { ClipboardList } from 'lucide-react'

export function PianiLavoroPage() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 flex items-center justify-center h-[calc(100vh-80px)]"
    >
      <div className="text-center space-y-4 max-w-md">
        <div className="w-16 h-16 bg-[#1a1a1e] border border-[#27272a] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ClipboardList size={24} className="text-electric" />
        </div>
        <h2 className="text-2xl font-semibold text-white">Piani di Lavoro</h2>
        <p className="text-zinc-400 leading-relaxed">
          Modulo in sviluppo — permetterà di inserire obiettivi annuali per PV e produttore,
          confrontarli con i dati reali e monitorare lo stato di avanzamento.
        </p>
        <div className="flex flex-col gap-2 mt-6 text-base text-zinc-400 text-left bg-[#121214] border border-[#1f1f22] rounded-2xl p-4">
          <p className="font-medium text-zinc-300 mb-1">Features pianificate:</p>
          <p>• Setup target annuali per PV × Ramo</p>
          <p>• Import target da CSV</p>
          <p>• Confronto Obiettivo vs Reale (da NA302/NA108)</p>
          <p>• Storicizzazione per anno</p>
          <p>• Barre progresso per produttore</p>
        </div>
      </div>
    </motion.div>
  )
}
