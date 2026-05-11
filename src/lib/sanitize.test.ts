import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { parseItalianCurrency, parseItalianDate, parseYesNo } from './sanitize'

// ============================================================================
// SUITE 1: FORMATI ITALIANI COMPLESSI
// ============================================================================

describe('parseItalianCurrency — Formati Italiani', () => {
  it('deve parsare formato italiano base: "1.234,56"', () => {
    const result = parseItalianCurrency('1.234,56')
    expect(result).toBe(1234.56)
  })

  it('deve parsare formato italiano grande: "1.234.567,89 €"', () => {
    const result = parseItalianCurrency('1.234.567,89 €')
    expect(result).toBe(1234567.89)
  })

  it('deve parsare spazi bianchi sporchi: "  10,50  "', () => {
    const result = parseItalianCurrency('  10,50  ')
    expect(result).toBe(10.5)
  })

  it('deve parsare senza separatore migliaia: "567,89"', () => {
    const result = parseItalianCurrency('567,89')
    expect(result).toBe(567.89)
  })

  it('deve parsare con simboli valuta misti: "€ 1.234,56"', () => {
    const result = parseItalianCurrency('€ 1.234,56')
    expect(result).toBe(1234.56)
  })

  it('deve parsare numero intero: "1000"', () => {
    const result = parseItalianCurrency('1000')
    expect(result).toBe(1000)
  })

  it('deve parsare zero: "0,00"', () => {
    const result = parseItalianCurrency('0,00')
    expect(result).toBe(0)
  })

  it('deve parsare numero nativo JavaScript: 1234.56', () => {
    const result = parseItalianCurrency(1234.56)
    expect(result).toBe(1234.56)
  })
})

// ============================================================================
// SUITE 2: NUMERI NEGATIVI (STORNI)
// ============================================================================

describe('parseItalianCurrency — Numeri Negativi', () => {
  it('deve parsare negativo semplice: "-1.234,50"', () => {
    const result = parseItalianCurrency('-1.234,50')
    expect(result).toBe(-1234.5)
  })

  it('deve parsare negativo con simbolo valuta: "-€ 500,00"', () => {
    const result = parseItalianCurrency('-€ 500,00')
    expect(result).toBe(-500)
  })

  it('deve parsare negativo grande: "-1.234.567,89"', () => {
    const result = parseItalianCurrency('-1.234.567,89')
    expect(result).toBe(-1234567.89)
  })

  it('deve parsare numero negativo nativo: -1234.56', () => {
    const result = parseItalianCurrency(-1234.56)
    expect(result).toBe(-1234.56)
  })
})

// ============================================================================
// SUITE 3: TRAPPOLA IEEE 754 (IL TEST SUPREMO)
// ============================================================================

describe('parseItalianCurrency — IEEE 754 Trap (Gold Standard)', () => {
  it('SUPREMO: 0.1 + 0.2 DEVE essere ESATTAMENTE 0.3 (non 0.30000000000000004)', () => {
    // Simula il problema classico IEEE 754
    // In JavaScript puro: 0.1 + 0.2 === 0.30000000000000004 ❌
    // Con parseItalianCurrency + Decimal: DEVE essere 0.3 ✅

    const val1 = parseItalianCurrency('0,10')
    const val2 = parseItalianCurrency('0,20')

    // Somma con Decimal.js per garantire precisione
    const sum = new Decimal(val1).plus(new Decimal(val2))

    // Il test: il risultato deve essere ESATTAMENTE 0.3
    expect(sum.toNumber()).toBe(0.3)
    expect(sum.toString()).toBe('0.3')

    // Verifica che non sia il valore "sporco" di JavaScript
    expect(sum.toNumber()).not.toBe(0.30000000000000004)
  })

  it('deve parsare "0,01" + "0,02" = "0,03" con precisione infinita', () => {
    const val1 = parseItalianCurrency('0,01')
    const val2 = parseItalianCurrency('0,02')
    const sum = new Decimal(val1).plus(new Decimal(val2))

    expect(sum.toNumber()).toBe(0.03)
    expect(sum.toString()).toBe('0.03')
  })

  it('somma di 10 valori "0,10" DEVE essere ESATTAMENTE 1.0', () => {
    let sum = new Decimal(0)
    for (let i = 0; i < 10; i++) {
      sum = sum.plus(parseItalianCurrency('0,10'))
    }

    expect(sum.toNumber()).toBe(1.0)
    expect(sum.toString()).toBe('1')
  })

  it('operazione finanziaria complessa: (1.234,56 + 567,89 - 100,45) DEVE essere precisa', () => {
    const val1 = new Decimal(parseItalianCurrency('1.234,56'))
    const val2 = new Decimal(parseItalianCurrency('567,89'))
    const val3 = new Decimal(parseItalianCurrency('100,45'))

    const result = val1.plus(val2).minus(val3)

    // Risultato atteso: 1702
    expect(result.toNumber()).toBe(1702)
    expect(result.toString()).toBe('1702')
  })
})

// ============================================================================
// SUITE 4: DATI CORROTTI / EDGE CASES
// ============================================================================

describe('parseItalianCurrency — Dati Corrotti & Edge Cases', () => {
  it('deve gestire null senza crashare', () => {
    expect(() => parseItalianCurrency(null)).not.toThrow()
    expect(parseItalianCurrency(null)).toBe(0)
  })

  it('deve gestire undefined senza crashare', () => {
    expect(() => parseItalianCurrency(undefined)).not.toThrow()
    expect(parseItalianCurrency(undefined)).toBe(0)
  })

  it('deve gestire stringa vuota senza crashare', () => {
    expect(() => parseItalianCurrency('')).not.toThrow()
    expect(parseItalianCurrency('')).toBe(0)
  })

  it('deve gestire "N/D" (non disponibile) senza crashare', () => {
    expect(() => parseItalianCurrency('N/D')).not.toThrow()
    expect(parseItalianCurrency('N/D')).toBe(0)
  })

  it('deve gestire "#VALORE!" (errore Excel) senza crashare', () => {
    expect(() => parseItalianCurrency('#VALORE!')).not.toThrow()
    expect(parseItalianCurrency('#VALORE!')).toBe(0)
  })

  it('deve gestire "#DIV/0!" (divisione per zero Excel) senza crashare', () => {
    expect(() => parseItalianCurrency('#DIV/0!')).not.toThrow()
    expect(parseItalianCurrency('#DIV/0!')).toBe(0)
  })

  it('deve gestire "#N/A" senza crashare', () => {
    expect(() => parseItalianCurrency('#N/A')).not.toThrow()
    expect(parseItalianCurrency('#N/A')).toBe(0)
  })

  it('deve gestire Infinity JavaScript senza crashare', () => {
    expect(() => parseItalianCurrency(Infinity)).not.toThrow()
    expect(parseItalianCurrency(Infinity)).toBe(0)
  })

  it('deve gestire NaN JavaScript senza crashare', () => {
    expect(() => parseItalianCurrency(NaN)).not.toThrow()
    expect(parseItalianCurrency(NaN)).toBe(0)
  })

  it('deve gestire testo random senza crashare', () => {
    expect(() => parseItalianCurrency('xyz abc 123')).not.toThrow()
    // Deve estrarre il 123 da "xyz abc 123"
    expect(parseItalianCurrency('xyz abc 123')).toBe(123)
  })

  it('deve gestire spazi bianchi puri', () => {
    expect(() => parseItalianCurrency('   ')).not.toThrow()
    expect(parseItalianCurrency('   ')).toBe(0)
  })

  it('deve gestire parentesi per negativi: "(1.234,56)"', () => {
    // Formato contabile: (1.234,56) = -1234.56
    const result = parseItalianCurrency('(1.234,56)')
    expect(result).toBe(-1234.56)
  })
})

// ============================================================================
// SUITE 5: FORMATI MISTI USA vs ITALIANO
// ============================================================================

describe('parseItalianCurrency — Euristica Formato USA vs Italiano', () => {
  it('deve distinguere USA format: "1,234.56" → 1234.56', () => {
    // Ultimo punto = decimale (formato USA)
    const result = parseItalianCurrency('1,234.56')
    expect(result).toBe(1234.56)
  })

  it('deve distinguere italiano format: "1.234,56" → 1234.56', () => {
    // Ultima virgola = decimale (formato italiano)
    const result = parseItalianCurrency('1.234,56')
    expect(result).toBe(1234.56)
  })

  it('deve preferire formato italiano se ampiamente ambiguo', () => {
    // Con entrambi punti e virgole, predilige italiano (virgola ultima)
    const result = parseItalianCurrency('1.234,56')
    expect(result).toBe(1234.56)
  })
})

// ============================================================================
// SUITE 6: PARSING DATE ITALIANE
// ============================================================================

describe('parseItalianDate', () => {
  it('deve parsare data italiana: "31/12/2024"', () => {
    const result = parseItalianDate('31/12/2024')
    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBeGreaterThan(0)
  })

  it('deve parsare data italiana formato dash: "31-12-2024"', () => {
    const result = parseItalianDate('31-12-2024')
    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBeGreaterThan(0)
  })

  it('deve gestire data invalida restituendo NaN', () => {
    const result = parseItalianDate('99/99/9999')
    expect(Number.isNaN(result)).toBe(true)
  })

  it('deve gestire null restituendo NaN', () => {
    const result = parseItalianDate(null)
    expect(Number.isNaN(result)).toBe(true)
  })
})

// ============================================================================
// SUITE 7: PARSING YES/NO
// ============================================================================

describe('parseYesNo', () => {
  it('deve parsare SI → 1', () => {
    expect(parseYesNo('SI')).toBe(1)
    expect(parseYesNo('sì')).toBe(1)
    expect(parseYesNo('YES')).toBe(1)
  })

  it('deve parsare NO → 0', () => {
    expect(parseYesNo('NO')).toBe(0)
    expect(parseYesNo('no')).toBe(0)
    expect(parseYesNo('FALSE')).toBe(0)
  })

  it('deve parsare valore ignoto → 255 (marker)', () => {
    expect(parseYesNo('FORSE')).toBe(255)
    expect(parseYesNo('xyz')).toBe(255)
  })

  it('deve gestire null → 255 (marker ignoto)', () => {
    expect(parseYesNo(null)).toBe(255)
    expect(parseYesNo(undefined)).toBe(255)
  })
})
