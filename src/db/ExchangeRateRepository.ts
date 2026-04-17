import { getDB } from './schema'
import type { ExchangeRate } from '../types'

export const ExchangeRateRepository = {
  async set(rate: number): Promise<void> {
    const db = await getDB()
    await db.put('exchange_rates', {
      key: 'USD:TWD',
      from: 'USD',
      to: 'TWD',
      rate,
      updatedAt: new Date().toISOString(),
    })
  },

  async getUsdTwd(): Promise<number | null> {
    const db = await getDB()
    return (await db.get('exchange_rates', 'USD:TWD'))?.rate ?? null
  },

  async getEntry(): Promise<ExchangeRate | null> {
    const db = await getDB()
    return (await db.get('exchange_rates', 'USD:TWD')) ?? null
  },
}
