import type { Transaction, SplitEvent } from '../types'
import { splitCoefficient } from './position'

export interface ChartPoint {
  date: string
  value: number
}

/**
 * Finds the most recent historical price within maxDaysBack days of `date`.
 * Returns undefined if no price found within the window.
 */
function findHistoricalPrice(
  historicalPrices: Map<string, number>,
  tickerMarketKey: string, // `${ticker}:${market}`
  date: string,
  maxDaysBack = 7,
): number | undefined {
  for (let i = 0; i <= maxDaysBack; i++) {
    const d = new Date(date + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - i)
    const price = historicalPrices.get(`${tickerMarketKey}:${d.toISOString().slice(0, 10)}`)
    if (price !== undefined && price > 0) return price
  }
  return undefined
}

/**
 * Calculates portfolio value history.
 *
 * When historicalPrices is provided, uses actual open prices per date
 * (falling back up to 7 days back for weekends/holidays, then to currentPrices).
 * Without historicalPrices, uses currentPrices for all dates (Phase 1 estimation).
 */
export function calcPortfolioHistory(
  transactions: Transaction[],
  splitEvents: SplitEvent[],
  prices: Record<string, number>,           // `${ticker}:${market}` -> current price
  historicalPrices?: Map<string, number>,   // `${ticker}:${market}:${date}` -> open price
): ChartPoint[] {
  if (transactions.length === 0) return []

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  const today = new Date().toISOString().slice(0, 10)
  const dates = [...new Set([...sorted.map((t) => t.date), today])].sort()

  return dates.map((date) => {
    const txsUpTo = sorted.filter((t) => t.date <= date)

    const sharesMap = new Map<string, number>()

    for (const tx of txsUpTo) {
      const key = `${tx.ticker}:${tx.market}`
      const coeff = splitCoefficient(tx.ticker, tx.date, splitEvents)
      const adjShares = tx.shares * coeff
      const current = sharesMap.get(key) ?? 0

      if (tx.type === 'buy') {
        sharesMap.set(key, current + adjShares)
      } else if (tx.type === 'sell') {
        sharesMap.set(key, current - adjShares)
      } else if (tx.type === 'stock_dividend') {
        sharesMap.set(key, current + adjShares)
      }
    }

    let value = 0
    for (const [key, shares] of sharesMap) {
      if (shares > 0.00001) {
        const price = historicalPrices
          ? (findHistoricalPrice(historicalPrices, key, date) ?? (prices[key] ?? 0))
          : (prices[key] ?? 0)
        value += shares * price
      }
    }

    return { date, value }
  })
}

/**
 * Filters chart points to only include those within the given range.
 */
export function filterByRange(points: ChartPoint[], range: string): ChartPoint[] {
  if (range === 'ALL' || points.length === 0) return points

  const today = new Date()
  const cutoff = new Date(today)

  switch (range) {
    case '1M': cutoff.setMonth(today.getMonth() - 1); break
    case '3M': cutoff.setMonth(today.getMonth() - 3); break
    case '6M': cutoff.setMonth(today.getMonth() - 6); break
    case 'YTD': cutoff.setMonth(0); cutoff.setDate(1); break
    case '1Y': cutoff.setFullYear(today.getFullYear() - 1); break
    case '3Y': cutoff.setFullYear(today.getFullYear() - 3); break
  }

  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return points.filter((p) => p.date >= cutoffStr)
}
