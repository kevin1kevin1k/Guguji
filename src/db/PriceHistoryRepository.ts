import { getDB } from './schema'
import type { PriceHistory, Market } from '../types'

export const PriceHistoryRepository = {
  async bulkSet(entries: PriceHistory[]): Promise<void> {
    if (entries.length === 0) return
    const db = await getDB()
    const tx = db.transaction('price_history', 'readwrite')
    await Promise.all(entries.map((e) => tx.store.put(e)))
    await tx.done
  },

  async getByTicker(ticker: string, market: Market): Promise<PriceHistory[]> {
    const db = await getDB()
    const all = await db.getAll('price_history')
    return all.filter((e) => e.ticker === ticker && e.market === market)
  },

  async getAll(): Promise<PriceHistory[]> {
    const db = await getDB()
    return db.getAll('price_history')
  },
}
