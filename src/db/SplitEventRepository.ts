import { getDB } from './schema'
import type { SplitEvent } from '../types'

export const SplitEventRepository = {
  async add(event: SplitEvent): Promise<string> {
    const db = await getDB()
    await db.add('split_events', event)
    return event.id
  },

  async delete(id: string): Promise<void> {
    const db = await getDB()
    await db.delete('split_events', id)
  },

  async getAll(): Promise<SplitEvent[]> {
    const db = await getDB()
    return db.getAll('split_events')
  },

  async getByTicker(ticker: string): Promise<SplitEvent[]> {
    const db = await getDB()
    return db.getAllFromIndex('split_events', 'by-ticker', ticker)
  },
}
