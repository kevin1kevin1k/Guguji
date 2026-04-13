import { getDB } from './schema'
import type { Transaction } from '../types'

export const TransactionRepository = {
  async add(tx: Transaction): Promise<string> {
    const db = await getDB()
    await db.add('transactions', tx)
    return tx.id
  },

  async update(tx: Transaction): Promise<void> {
    const db = await getDB()
    await db.put('transactions', tx)
  },

  async delete(id: string): Promise<void> {
    const db = await getDB()
    await db.delete('transactions', id)
  },

  async getAll(): Promise<Transaction[]> {
    const db = await getDB()
    return db.getAll('transactions')
  },

  async getByTicker(ticker: string): Promise<Transaction[]> {
    const db = await getDB()
    return db.getAllFromIndex('transactions', 'by-ticker', ticker)
  },
}
