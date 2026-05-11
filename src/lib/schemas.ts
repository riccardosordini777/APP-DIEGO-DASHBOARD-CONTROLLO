import type { ModuleId } from '../store/useDashboardStore'

export type FieldType = 'string' | 'number' | 'currency' | 'percent' | 'date' | 'yes_no'

export interface ColumnSchema {
  aliases: string[]
  required?: boolean
  type?: FieldType
}

export interface ModuleSchema {
  id: ModuleId
  name: string
  columns: Record<string, ColumnSchema>
}

export const SCHEMAS: Record<ModuleId, ModuleSchema> = {
  si014: {
    id: 'si014',
    name: 'Canalizzazioni SI014',
    columns: {
      pv: { aliases: ['Punto vendita', 'PV', 'Punto Vendita', 'punto_vendita', 'Filiale', 'Agenzia'], required: true },
      produttore: { aliases: ['Produttore', 'produttore', 'Nominativo produttore', 'Agente', 'Nome produttore'] },
      tipo: { aliases: ['Tipo sinistro', 'TipoSinistro', 'Tipo Sinistro', 'tipo_sinistro', 'Ramo', 'Categoria'] },
      carrozzeria: { aliases: ['Carrozzeria Convenzionata', 'Carrozzeria', 'carrozzeria', 'Officina', 'Riparatore'] },
      canalizzato: { aliases: ['Sinistro Canalizzato', 'Canalizzato', 'canalizzato', 'Canale', 'Canalizzazione', 'Indirizzo'], type: 'yes_no' },
    },
  },
  na013: {
    id: 'na013',
    name: 'Incassi NA013',
    columns: {
      pv: { aliases: ['Punto Vendita Incasso', 'Punto Vendita Attuale', 'Punto Vendita Originario', 'Punto vendita', 'PV', 'Filiale', 'Punto Vendita', 'Agenzia'], required: true },
      produttore: { aliases: ['Nominativo Produttore Incasso', 'Nominativo Produttore Attuale', 'Produttore', 'Nominativo produttore', 'Agente'] },
      premioLordo: { aliases: ['Premio Lordo Titolo', 'Premio Titolo', 'Premio lordo', 'PremioLordo', 'Premio Lordo', 'Importo', 'Premio', 'Totale'], type: 'currency' },
      scadenza: { aliases: ['Data Scadenza Titolo', 'Scadenza', 'Data scadenza', 'DataScadenza', 'Data Scadenza'], type: 'date' },
      incasso: { aliases: ['Data Incasso', 'Incasso', 'Data incasso', 'DataIncasso'], type: 'date' },
      tipoPagamento: { aliases: ['Tipo Pagamento', 'Tipo pagamento', 'TipoPagamento', 'Metodo pagamento', 'Pagamento', 'Modalità'] },
      provvigioni: { aliases: ['Importo Provvigioni Incasso', 'Importo Provvigioni Acquisto', 'Provvigioni', 'provvigioni', 'Prov.', 'Commissioni'], type: 'currency' },
      ramo: { aliases: ['Ramo Gestionale', 'Settore', 'Ramo', 'ramo', 'Linea', 'Categoria'] },
    },
  },
  na302: {
    id: 'na302',
    name: 'Cruscotto Agenzia NA302',
    columns: {
      pv: { aliases: ['Punto vendita', 'PV', 'Filiale', 'Punto Vendita', 'Agenzia'], required: true },
      produttore: { aliases: ['Produttore', 'Nominativo produttore', 'Agente', 'Nome produttore'] },
      ramo: { aliases: ['Ramo', 'ramo', 'Settore', 'Linea'] },
      premi: { aliases: ['Premi', 'Premio', 'Premio lordo', 'Premi lordi', 'Importo', 'Totale'], type: 'currency' },
      annioPrecedente: { aliases: ['Anno precedente', 'AnnoPrecedente', 'AP', 'PY', 'Anno prec'], type: 'currency' },
    },
  },
  na108: {
    id: 'na108',
    name: 'Produzione NA108',
    columns: {
      pv: { aliases: ['Punto Vendita', 'Punto vendita', 'PV', 'Filiale', 'Agenzia'], required: true },
      produttore: { aliases: ['Produttore', 'Nominativo produttore', 'Agente', 'Nome produttore'] },
      ramo: { aliases: ['Descrizione Ramo', 'Ramo', 'ramo', 'Settore', 'Linea', 'Categoria'] },
      premi: { aliases: ['TOTALE', 'Totale', 'Premi', 'Premio', 'Premio lordo', 'Premi lordi', 'Importo'], type: 'currency' },
      polizze: { aliases: ['Polizze', 'N. Polizze', 'NumPolizze', 'Numero polizze', 'N.Polizze'], type: 'number' },
      cliente: { aliases: ['Denominazione Cliente', 'Cliente', 'Nominativo cliente', 'Intestatario', 'Contraente'] },
    },
  },
}

export function detectModuleFromFilename(filename: string): ModuleId | null {
  const upper = filename.toUpperCase()
  if (upper.includes('SI014')) return 'si014'
  if (upper.includes('NA013')) return 'na013'
  if (upper.includes('NA302')) return 'na302'
  if (upper.includes('NA108')) return 'na108'
  return null
}
