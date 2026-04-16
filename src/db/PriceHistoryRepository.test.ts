import { describe, it, expect, beforeEach } from 'vitest'
import { PriceHistoryRepository } from './PriceHistoryRepository'
import type { PriceHistory } from '../types'

beforeEach(async () => {
  // Reset the cached DB connection so the next test opens a fresh IDB
  const schemaModule = await import('./schema')
  // @ts-expect-error accessing module-level private for test reset
  schemaModule.dbPromise = null
  // Create a new in-memory IDB instance (fake-indexeddb)
  const { IDBFactory } = await import('fake-indexeddb')
  globalThis.indexedDB = new IDBFactory()
})

const entries: PriceHistory[] = [
  { key: '0050:TW:2024-01-02', ticker: '0050', market: 'TW', date: '2024-01-02', open: 145.5 },
  { key: '0050:TW:2024-01-03', ticker: '0050', market: 'TW', date: '2024-01-03', open: 146.0 },
  { key: 'AAPL:US:2024-01-02', ticker: 'AAPL', market: 'US', date: '2024-01-02', open: 185.0 },
]

describe('PriceHistoryRepository', () => {
  it('bulkSet stores entries retrievable by getAll', async () => {
    await PriceHistoryRepository.bulkSet(entries)
    const all = await PriceHistoryRepository.getAll()
    expect(all).toHaveLength(3)
  })

  it('getByTicker filters by ticker and market', async () => {
    await PriceHistoryRepository.bulkSet(entries)
    const tw = await PriceHistoryRepository.getByTicker('0050', 'TW')
    expect(tw).toHaveLength(2)
    expect(tw.every((e) => e.ticker === '0050' && e.market === 'TW')).toBe(true)
  })

  it('bulkSet upserts — re-inserting same keys does not duplicate', async () => {
    await PriceHistoryRepository.bulkSet(entries)
    await PriceHistoryRepository.bulkSet(entries) // second insert
    const all = await PriceHistoryRepository.getAll()
    expect(all).toHaveLength(3)
  })

  it('bulkSet with empty array does nothing', async () => {
    await expect(PriceHistoryRepository.bulkSet([])).resolves.toBeUndefined()
  })
})
