import { create } from 'zustand'

export type ModuleId = 'si014' | 'na013' | 'na302' | 'na108'
export type TabId = 'cruscotto' | 'produzione' | 'canalizzazioni' | 'incassi' | 'piani_lavoro' | 'confronta'

export type ColumnArray = string[] | Float64Array | Uint8Array
export type ParsedColumns = Record<string, ColumnArray>
export type FieldTypeMap = Record<string, 'string' | 'number' | 'currency' | 'percent' | 'date' | 'yes_no'>

export interface ValidationError {
  row: number
  field: string
  rawValue: unknown
  reason: string
}

export interface ParsedModule {
  moduleId: ModuleId
  rows: Record<string, unknown>[]   // ricostruite per backward-compat con componenti
  columns: ParsedColumns             // colonne tipizzate per dataEngine/diagnosticEngine
  fieldTypes: FieldTypeMap
  rowCount: number
  columnCount: number
  filename: string
  loadedAt: number
  validationErrors: ValidationError[]
}

export interface GlobalFilters {
  pv: string
  produttore: string
  ramo: string
  period: string
}

export type DiagnosticLevel = 'critical' | 'warning' | 'info' | 'ok'
export interface Diagnostic {
  level: DiagnosticLevel
  metric: string
  value: number
  hint: string
}
export type DiagnosticMap = Record<string, Diagnostic>

interface DashboardState {
  isAuthenticated: boolean
  setAuthenticated: (auth: boolean) => void

  activeTab: TabId
  setActiveTab: (tab: TabId) => void

  isAnalystOpen: boolean
  setAnalystOpen: (open: boolean) => void

  parsedModules: Partial<Record<ModuleId, ParsedModule>>
  setParsedModule: (moduleId: ModuleId, data: ParsedModule) => void
  clearModule: (moduleId: ModuleId) => void

  loadingModuleId: ModuleId | null
  setLoadingModule: (id: ModuleId | null) => void

  moduleErrors: Partial<Record<ModuleId, string>>
  setModuleError: (moduleId: ModuleId, error: string | null) => void

  diagnostics: DiagnosticMap
  setDiagnostics: (map: DiagnosticMap) => void

  filters: GlobalFilters
  setFilter: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void
  resetFilters: () => void

  validationErrorsToShow: ValidationError[]
  setValidationErrors: (errors: ValidationError[]) => void
}

const defaultFilters: GlobalFilters = {
  pv: 'Tutti',
  produttore: 'Tutti',
  ramo: 'Tutti',
  period: 'YTD',
}

export const useDashboardStore = create<DashboardState>((set) => ({
  isAuthenticated: !!localStorage.getItem('control_tower_auth'),
  setAuthenticated: (auth) => set({ isAuthenticated: auth }),

  activeTab: 'cruscotto',
  setActiveTab: (tab) => set({ activeTab: tab }),

  isAnalystOpen: false,
  setAnalystOpen: (open) => set({ isAnalystOpen: open }),

  parsedModules: {},
  setParsedModule: (moduleId, data) =>
    set((state) => ({
      parsedModules: { ...state.parsedModules, [moduleId]: data },
    })),
  clearModule: (moduleId) =>
    set((state) => {
      const next = { ...state.parsedModules }
      delete next[moduleId]
      return { parsedModules: next }
    }),

  loadingModuleId: null,
  setLoadingModule: (id) => set({ loadingModuleId: id }),

  moduleErrors: {},
  setModuleError: (moduleId, error) =>
    set((state) => {
      const next = { ...state.moduleErrors }
      if (error === null) delete next[moduleId]
      else next[moduleId] = error
      return { moduleErrors: next }
    }),

  diagnostics: {},
  setDiagnostics: (map) => set({ diagnostics: map }),

  filters: defaultFilters,
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: defaultFilters }),

  validationErrorsToShow: [],
  setValidationErrors: (errors) => set({ validationErrorsToShow: errors }),
}))
