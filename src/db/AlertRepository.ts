import { getDB } from './schema'
import type { Alert, AlertHistory } from '../types'

export const AlertRepository = {
  async upsert(alert: Alert): Promise<void> {
    const db = await getDB()
    await db.put('alerts', alert)
  },

  async delete(id: string): Promise<void> {
    const db = await getDB()
    await db.delete('alerts', id)
  },

  async getAll(): Promise<Alert[]> {
    const db = await getDB()
    return db.getAll('alerts')
  },

  async addHistory(entry: AlertHistory): Promise<void> {
    const db = await getDB()
    await db.add('alert_history', entry)
  },

  async getAllHistory(): Promise<AlertHistory[]> {
    const db = await getDB()
    return db.getAll('alert_history')
  },
}
