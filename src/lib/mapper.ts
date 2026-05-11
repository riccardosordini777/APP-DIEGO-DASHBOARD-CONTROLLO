import type { ModuleSchema } from './schemas'

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    [i, ...Array(n).fill(0)]
  )
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

export function buildHeaderMap(
  headers: string[],
  schema: ModuleSchema,
): Record<string, string> {
  const map: Record<string, string> = {}
  const normalHeaders = headers.map((h) => h.toLowerCase().trim())

  for (const [fieldName, col] of Object.entries(schema.columns)) {
    // Exact match (case insensitive)
    const exactIdx = normalHeaders.findIndex((h) =>
      col.aliases.some((alias) => alias.toLowerCase() === h),
    )
    if (exactIdx >= 0) {
      map[fieldName] = headers[exactIdx]
      continue
    }

    // Fuzzy match (Levenshtein ≤ 3)
    let best = { dist: 99, header: '' }
    for (let i = 0; i < headers.length; i++) {
      for (const alias of col.aliases) {
        const dist = levenshtein(alias.toLowerCase(), normalHeaders[i])
        if (dist < best.dist) best = { dist, header: headers[i] }
      }
    }
    if (best.dist <= 3 && best.header) map[fieldName] = best.header
  }

  return map
}
