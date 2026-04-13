import { getDB } from './schema'
import type { PriceCache, Market } from '../types'

export const PriceCacheRepository = {
  async set(entry: PriceCache): Promise<void> {
    const db = await getDB()
    await db.put('price_cache', { ...entry, ticker: `${entry.ticker}:${entry.market}` })
  },

  async get(ticker: string, market: Market): Promise<PriceCache | undefined> {
    const db = await getDB()
    return db.get('price_cache', `${ticker}:${market}`)
  },

  async getAll(): Promise<PriceCache[]> {
    const db = await getDB()
    return db.getAll('price_cache')
  },
}
