import type { Transaction, SplitEvent, Position, Market } from '../types'

/**
 * Returns the cumulative split adjustment coefficient for a ticker
 * for all split events that occurred after the given date.
 *
 * adjusted shares = original shares * coefficient
 * adjusted cost   = original cost   / coefficient
 */
export function splitCoefficient(
  ticker: string,
  afterDate: string,
  splitEvents: SplitEvent[],
): number {
  return splitEvents
    .filter((e) => e.ticker === ticker && e.effectiveDate > afterDate)
    .reduce((acc, e) => acc * (e.ratioTo / e.ratioFrom), 1)
}

/**
 * Calculates open/closed positions from all transactions and split events.
 * prices: map of `${ticker}:${market}` -> current price
 */
export function calcPositions(
  transactions: Transaction[],
  splitEvents: SplitEvent[],
  prices: Record<string, number>,
): Position[] {
  const groups = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    const key = `${tx.ticker}:${tx.market}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(tx)
  }

  const positions: Position[] = []

  for (const [key, txs] of groups) {
    const [ticker, market] = key.split(':') as [string, Market]

    let totalShares = 0
    let totalCost = 0

    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date))

    for (const tx of sorted) {
      const coeff = splitCoefficient(ticker, tx.date, splitEvents)
      const adjShares = tx.shares * coeff
      const adjPrice = tx.price / coeff

      if (tx.type === 'buy') {
        totalCost += adjPrice * adjShares + tx.fee
        totalShares += adjShares
      } else if (tx.type === 'sell') {
        const costPerShare = totalShares > 0 ? totalCost / totalShares : 0
        totalCost -= costPerShare * adjShares
        totalShares -= adjShares
      } else if (tx.type === 'stock_dividend') {
        // Stock dividend increases shares; total cost stays the same,
        // so average cost per share decreases proportionally.
        totalShares += adjShares
      }
      // Cash dividend does not affect position calculation.
    }

    const isOpen = totalShares > 0.00001
    const currentPrice = prices[key] ?? 0
    const currentValue = totalShares * currentPrice
    const avgCost = totalShares > 0 ? totalCost / totalShares : 0
    const unrealizedPnl = currentValue - totalCost
    const unrealizedPnlPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0

    positions.push({
      ticker,
      market,
      shares: totalShares,
      avgCost,
      currentPrice,
      currentValue,
      unrealizedPnl,
      unrealizedPnlPct,
      isOpen,
    })
  }

  return positions
}
