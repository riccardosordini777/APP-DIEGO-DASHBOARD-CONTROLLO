import { useCallback } from 'react'
import { useDashboardStore, type ModuleId, type TabId } from '../store/useDashboardStore'
import { columnsToRows } from '../lib/columns'
import { buildTable } from '../lib/dataEngine'
import type { ParseResult } from '../workers/excelParser.worker'

const MODULE_TO_TAB: Record<ModuleId, TabId> = {
  si014: 'canalizzazioni',
  na013: 'incassi',
  na302: 'cruscotto',
  na108: 'produzione',
}

// Worker singleton — riutilizzato per ogni caricamento (no terminate)
let workerInstance: Worker | null = null

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('../workers/excelParser.worker.ts', import.meta.url),
      { type: 'module' },
    )
  }
  return workerInstance
}

export function useFileParser() {
  const setParsedModule = useDashboardStore((s) => s.setParsedModule)
  const setActiveTab = useDashboardStore((s) => s.setActiveTab)
  const setLoadingModule = useDashboardStore((s) => s.setLoadingModule)
  const setModuleError = useDashboardStore((s) => s.setModuleError)
  const setValidationErrors = useDashboardStore((s) => s.setValidationErrors)

  const parseFile = useCallback(
    (file: File) => {
      return new Promise<void>((resolve) => {
        file.arrayBuffer().then((buffer) => {
          const worker = getWorker()

          const handler = (e: MessageEvent<ParseResult>) => {
            worker.removeEventListener('message', handler)
            const data = e.data

            if (!data.success) {
              console.error('[parseFile]', data.error)
              // TODO Step 7: sostituire con toast Sonner
              alert(data.error)
              setLoadingModule(null)
              resolve()
              return
            }

            // Ricostruisci rows[] per backward-compat con i componenti esistenti
            const rows = columnsToRows(data.columns, data.fieldTypes, data.rowCount)

            // Costruisci la tabella Arquero per dataEngine/diagnosticEngine
            buildTable(data.moduleId, data.columns)

            setParsedModule(data.moduleId, {
              moduleId: data.moduleId,
              rows,
              columns: data.columns,
              fieldTypes: data.fieldTypes,
              rowCount: data.rowCount,
              columnCount: data.columnCount,
              filename: data.filename,
              loadedAt: data.loadedAt,
              validationErrors: data.errors,
            })
            setModuleError(data.moduleId, null)
            setLoadingModule(null)
            setActiveTab(MODULE_TO_TAB[data.moduleId])

            // Se ci sono errori, mostrali in UI
            if (data.errors.length > 0) {
              setValidationErrors(data.errors)
            }

            console.log(
              `[parseFile] ✓ ${data.filename} → ${data.moduleId} (${data.rowCount} righe, ${data.errors.length} errori)`,
            )
            resolve()
          }

          worker.addEventListener('message', handler)
          // Buffer trasferibile: ownership passa al worker, no copy
          worker.postMessage({ buffer, filename: file.name }, [buffer])
        })
      })
    },
    [setParsedModule, setActiveTab, setLoadingModule, setModuleError, setValidationErrors],
  )

  return { parseFile }
}
