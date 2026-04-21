import { describe, it, expect } from 'vitest'
import { calcPortfolioHistory, filterByRange, type ChartFilter } from './chartData'
import type { Transaction } from '../types'

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: '1',
  ticker: '0050',
  market: 'TW',
  type: 'buy',
  date: '2024-01-01',
  price: 100,
  shares: 10,
  fee: 0,
  note: '',
  createdAt: '',
  ...overrides,
})

const prices = { '0050:TW': 120, 'AAPL:US': 200 }

describe('calcPortfolioHistory', () => {
  it('returns empty array when there are no transactions', () => {
    expect(calcPortfolioHistory([], [], prices)).toEqual([])
  })

  it('returns a point for each unique date plus today', () => {
    const txs = [
      tx({ id: '1', date: '2024-01-01' }),
      tx({ id: '2', date: '2024-06-01' }),
    ]
    const points = calcPortfolioHistory(txs, [], prices)
    const today = new Date().toISOString().slice(0, 10)
    const dates = points.map((p) => p.date)
    expect(dates).toContain('2024-01-01')
    expect(dates).toContain('2024-06-01')
    expect(dates).toContain(today)
  })

  it('computes value as shares × current price at each date', () => {
    const txs = [tx({ shares: 10, date: '2024-01-01' })]
    const points = calcPortfolioHistory(txs, [], prices)
    // After buy: 10 shares × 120 = 1200
    const jan = points.find((p) => p.date === '2024-01-01')!
    expect(jan.value).toBeCloseTo(1200)
  })

  it('value increases after a second buy', () => {
    const txs = [
      tx({ id: '1', shares: 10, date: '2024-01-01' }),
      tx({ id: '2', shares: 5, date: '2024-06-01' }),
    ]
    const points = calcPortfolioHistory(txs, [], prices)
    const jan = points.find((p) => p.date === '2024-01-01')!
    const jun = points.find((p) => p.date === '2024-06-01')!
    expect(jun.value).toBeGreaterThan(jan.value)
    expect(jun.value).toBeCloseTo(15 * 120)
  })

  it('value decreases after a sell', () => {
    const txs = [
      tx({ id: '1', type: 'buy', shares: 10, date: '2024-01-01' }),
      tx({ id: '2', type: 'sell', shares: 5, date: '2024-06-01' }),
    ]
    const points = calcPortfolioHistory(txs, [], prices)
    const jan = points.find((p) => p.date === '2024-01-01')!
    const jun = points.find((p) => p.date === '2024-06-01')!
    expect(jun.value).toBeLessThan(jan.value)
    expect(jun.value).toBeCloseTo(5 * 120)
  })

  it('uses historical price when available for the exact date', () => {
    const txs = [tx({ shares: 10, date: '2024-01-01' })]
    // Historical price 130 differs from current price 120
    const histPrices = new Map([['0050:TW:2024-01-01', 130]])
    const points = calcPortfolioHistory(txs, [], prices, histPrices)
    const jan = points.find((p) => p.date === '2024-01-01')!
    expect(jan.value).toBeCloseTo(10 * 130)
  })

  it('falls back to nearest prior day when date is a gap (e.g. weekend)', () => {
    const txs = [tx({ shares: 10, date: '2024-01-01' })]
    // Price available on Dec 31, not Jan 1 (simulates holiday gap)
    const histPrices = new Map([['0050:TW:2023-12-31', 125]])
    const points = calcPortfolioHistory(txs, [], prices, histPrices)
    const jan = points.find((p) => p.date === '2024-01-01')!
    expect(jan.value).toBeCloseTo(10 * 125)
  })

  it('falls back to currentPrices when no historical data within 7 days', () => {
    const txs = [tx({ shares: 10, date: '2024-01-01' })]
    // Price is 8 days old — beyond the 7-day fallback window
    const histPrices = new Map([['0050:TW:2023-12-24', 110]])
    const points = calcPortfolioHistory(txs, [], prices, histPrices)
    const jan = points.find((p) => p.date === '2024-01-01')!
    expect(jan.value).toBeCloseTo(10 * 120) // falls back to currentPrices
  })

  it('behaves identically when historicalPrices is undefined', () => {
    const txs = [tx({ shares: 10, date: '2024-01-01' })]
    const without = calcPortfolioHistory(txs, [], prices)
    const withUndef = calcPortfolioHistory(txs, [], prices, undefined)
    expect(without).toEqual(withUndef)
  })

  describe('filter', () => {
    const mixedTxs = [
      tx({ id: '1', ticker: '0050', market: 'TW', shares: 10, date: '2024-01-01' }),
      tx({ id: '2', ticker: 'AAPL', market: 'US', shares: 5, date: '2024-01-01' }),
    ]
    const mixedPrices = { '0050:TW': 120, 'AAPL:US': 200 }

    it('filter { market: TW } only includes TW positions', () => {
      const points = calcPortfolioHistory(mixedTxs, [], mixedPrices, undefined, undefined, { market: 'TW' })
      const jan = points.find((p) => p.date === '2024-01-01')!
      expect(jan.value).toBeCloseTo(10 * 120)
    })

    it('filter { ticker, market } only includes that single stock', () => {
      const filter: ChartFilter = { ticker: '0050', market: 'TW' }
      const points = calcPortfolioHistory(mixedTxs, [], mixedPrices, undefined, undefined, filter)
      const jan = points.find((p) => p.date === '2024-01-01')!
      expect(jan.value).toBeCloseTo(10 * 120)
    })

    it('filter { market: US } with usdTwdRate converts to TWD', () => {
      const points = calcPortfolioHistory(mixedTxs, [], mixedPrices, undefined, 30, { market: 'US' })
      const jan = points.find((p) => p.date === '2024-01-01')!
      expect(jan.value).toBeCloseTo(5 * 200 * 30)
    })
  })
})

describe('filterByRange', () => {
  const points = [
    { date: '2023-01-01', value: 100 },
    { date: '2024-01-01', value: 200 },
    { date: '2024-06-01', value: 300 },
    { date: '2025-01-01', value: 400 },
  ]

  it('returns all points for ALL', () => {
    expect(filterByRange(points, 'ALL')).toHaveLength(4)
  })

  it('returns empty array for empty input', () => {
    expect(filterByRange([], '1Y')).toEqual([])
  })

  it('excludes points older than 1 year', () => {
    // today is 2026-04-14, cutoff is 2025-04-14
    // all points in our set are before the cutoff, so result should be empty
    const result = filterByRange(points, '1Y')
    expect(result).toHaveLength(0)
  })

  it('includes points within 3 years', () => {
    // today is 2026-04-14, cutoff is 2023-04-14
    // 2023-01-01 is before cutoff, 2024-01-01 onwards are included
    const result = filterByRange(points, '3Y')
    expect(result.map((p) => p.date)).toEqual(['2024-01-01', '2024-06-01', '2025-01-01'])
  })
})
