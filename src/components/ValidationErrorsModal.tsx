import { X, AlertTriangle, Download } from 'lucide-react'
import { useDashboardStore, type ValidationError } from '../store/useDashboardStore'

export function ValidationErrorsModal() {
  const errors = useDashboardStore((s) => s.validationErrorsToShow)
  const setErrors = useDashboardStore((s) => s.setValidationErrors)

  if (errors.length === 0) return null

  const downloadErrors = () => {
    const csv = ['row,field,rawValue,reason']
      .concat(errors.map((e) => `${e.row},"${e.field}","${e.rawValue}","${e.reason}"`))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `errori_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1e] border border-[#27272a] rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={20} className="text-accent-red" />
          <h2 className="text-lg font-bold text-white">⚠️ {errors.length} Errori Trovati</h2>
          <button
            onClick={() => setErrors([])}
            className="ml-auto text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mb-4 space-y-2">
          {errors.slice(0, 50).map((e, i) => (
            <div key={i} className="bg-[#2a2a2e] border border-[#3f3f46] rounded p-3 text-base">
              <div className="text-zinc-300">
                <span className="font-semibold">Riga {e.row}</span> •{' '}
                <span className="text-accent-red">{e.field}</span>
              </div>
              <div className="text-zinc-400 mt-1">
                Valore: <code className="bg-black/40 px-1 rounded">{String(e.rawValue)}</code>
              </div>
              <div className="text-zinc-400 mt-1">{e.reason}</div>
            </div>
          ))}
          {errors.length > 50 && (
            <p className="text-center text-zinc-400 py-2">
              +{errors.length - 50} altri errori...
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={downloadErrors}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-base transition"
          >
            <Download size={14} />
            Scarica CSV Errori
          </button>
          <button
            onClick={() => setErrors([])}
            className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-white text-base transition"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
