import { describe, it, expect } from 'vitest'
import { splitCoefficient, calcPositions } from './position'
import type { Transaction, SplitEvent } from '../types'

const baseTx = (overrides: Partial<Transaction>): Transaction => ({
  id: '1',
  ticker: '0050',
  market: 'TW',
  type: 'buy',
  date: '2024-01-01',
  price: 100,
  shares: 10,
  fee: 0,
  note: '',
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

const splitEvent = (overrides: Partial<SplitEvent>): SplitEvent => ({
  id: 's1',
  ticker: '0050',
  market: 'TW',
  effectiveDate: '2024-06-01',
  ratioFrom: 1,
  ratioTo: 4,
  source: 'built_in',
  createdAt: '2024-06-01T00:00:00Z',
  ...overrides,
})

describe('splitCoefficient', () => {
  it('returns 1 when there are no split events', () => {
    expect(splitCoefficient('0050', '2024-01-01', [])).toBe(1)
  })

  it('returns the ratio for a split after the given date', () => {
    const events = [splitEvent({ effectiveDate: '2024-06-01', ratioFrom: 1, ratioTo: 4 })]
    expect(splitCoefficient('0050', '2024-01-01', events)).toBe(4)
  })

  it('ignores splits on or before the given date', () => {
    const events = [splitEvent({ effectiveDate: '2024-01-01' })]
    expect(splitCoefficient('0050', '2024-01-01', events)).toBe(1)
  })

  it('compounds multiple splits', () => {
    const events = [
      splitEvent({ id: 's1', effectiveDate: '2024-06-01', ratioFrom: 1, ratioTo: 2 }),
      splitEvent({ id: 's2', effectiveDate: '2024-09-01', ratioFrom: 1, ratioTo: 3 }),
    ]
    expect(splitCoefficient('0050', '2024-01-01', events)).toBe(6)
  })
})

describe('calcPositions', () => {
  it('calculates a basic buy position', () => {
    const txs = [baseTx({ shares: 10, price: 100 })]
    const [pos] = calcPositions(txs, [], { '0050:TW': 120 })

    expect(pos.shares).toBeCloseTo(10)
    expect(pos.avgCost).toBeCloseTo(100)
    expect(pos.currentValue).toBeCloseTo(1200)
    expect(pos.unrealizedPnl).toBeCloseTo(200)
    expect(pos.isOpen).toBe(true)
  })

  it('calculates weighted average cost across multiple buys', () => {
    const txs = [
      baseTx({ id: '1', shares: 10, price: 100, date: '2024-01-01' }),
      baseTx({ id: '2', shares: 10, price: 200, date: '2024-02-01' }),
    ]
    const [pos] = calcPositions(txs, [], { '0050:TW': 150 })

    expect(pos.shares).toBeCloseTo(20)
    expect(pos.avgCost).toBeCloseTo(150) // (1000 + 2000) / 20
  })

  it('marks position as closed after a full sell', () => {
    const txs = [
      baseTx({ id: '1', type: 'buy', shares: 10, price: 100, date: '2024-01-01' }),
      baseTx({ id: '2', type: 'sell', shares: 10, price: 120, date: '2024-06-01' }),
    ]
    const [pos] = calcPositions(txs, [], {})

    expect(pos.shares).toBeCloseTo(0)
    expect(pos.isOpen).toBe(false)
  })

  it('applies split adjustment to a historical buy', () => {
    const txs = [baseTx({ shares: 10, price: 100, date: '2024-01-01' })]
    const splits = [splitEvent({ effectiveDate: '2024-06-01', ratioFrom: 1, ratioTo: 4 })]
    const [pos] = calcPositions(txs, splits, { '0050:TW': 30 })

    expect(pos.shares).toBeCloseTo(40) // 10 * 4
    expect(pos.avgCost).toBeCloseTo(25) // 100 / 4
    expect(pos.currentValue).toBeCloseTo(1200) // 40 * 30
  })

  it('stock dividend increases shares without changing total cost', () => {
    const txs = [
      baseTx({ id: '1', type: 'buy', shares: 100, price: 50, date: '2024-01-01' }),
      baseTx({ id: '2', type: 'stock_dividend', shares: 10, price: 0, date: '2024-06-01' }),
    ]
    const [pos] = calcPositions(txs, [], { '0050:TW': 50 })

    expect(pos.shares).toBeCloseTo(110)
    expect(pos.avgCost).toBeCloseTo(5000 / 110)
  })
})
