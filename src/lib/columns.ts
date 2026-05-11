import type { ParsedColumns, FieldTypeMap } from '../store/useDashboardStore'

/**
 * Ricostruisce un array di oggetti dalle colonne tipizzate del worker.
 * Usato per backward-compat con i componenti che leggono `parsedModule.rows`.
 * Le colonne tipizzate restano comunque accessibili in `parsedModule.columns`
 * per il dataEngine (Arquero) e diagnosticEngine.
 */
export function columnsToRows(
  columns: ParsedColumns,
  fieldTypes: FieldTypeMap,
  rowCount: number,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = new Array(rowCount)
  const fieldNames = Object.keys(columns)

  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, unknown> = {}
    for (const field of fieldNames) {
      const col = columns[field]
      const type = fieldTypes[field]

      if (col instanceof Float64Array) {
        const v = col[i]
        if (type === 'date') {
          row[field] = isFinite(v) ? new Date(v).toISOString().split('T')[0] : ''
        } else {
          row[field] = isFinite(v) ? v : 0
        }
      } else if (col instanceof Uint8Array) {
        const v = col[i]
        row[field] = v === 1 ? 'SI' : v === 0 ? 'NO' : ''
      } else {
        row[field] = (col as string[])[i] ?? ''
      }
    }
    rows[i] = row
  }

  return rows
}
