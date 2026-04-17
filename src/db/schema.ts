import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Transaction, SplitEvent, Alert, AlertHistory, PriceCache, PriceHistory, ExchangeRate } from '../types'

interface GugujiDB extends DBSchema {
  transactions: {
    key: string
    value: Transaction
    indexes: { 'by-ticker': string; 'by-date': string }
  }
  split_events: {
    key: string
    value: SplitEvent
    indexes: { 'by-ticker': string }
  }
  alerts: {
    key: string
    value: Alert
    indexes: { 'by-ticker': string }
  }
  alert_history: {
    key: string
    value: AlertHistory
    indexes: { 'by-ticker': string }
  }
  price_cache: {
    key: string // `${ticker}:${market}`
    value: PriceCache
  }
  price_history: {
    key: string  // `${ticker}:${market}:${date}`
    value: PriceHistory
  }
  exchange_rates: {
    key: string
    value: ExchangeRate
  }
}

const DB_NAME = 'guguji'
const DB_VERSION = 3

let dbPromise: Promise<IDBPDatabase<GugujiDB>> | null = null

export function getDB(): Promise<IDBPDatabase<GugujiDB>> {
  if (!dbPromise) {
    dbPromise = openDB<GugujiDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' })
          txStore.createIndex('by-ticker', 'ticker')
          txStore.createIndex('by-date', 'date')

          const splitStore = db.createObjectStore('split_events', { keyPath: 'id' })
          splitStore.createIndex('by-ticker', 'ticker')

          const alertStore = db.createObjectStore('alerts', { keyPath: 'id' })
          alertStore.createIndex('by-ticker', 'ticker')

          const histStore = db.createObjectStore('alert_history', { keyPath: 'id' })
          histStore.createIndex('by-ticker', 'ticker')

          db.createObjectStore('price_cache', { keyPath: 'ticker' })
        }
        if (oldVersion < 2) {
          db.createObjectStore('price_history', { keyPath: 'key' })
        }
        if (oldVersion < 3) {
          db.createObjectStore('exchange_rates', { keyPath: 'key' })
        }
      },
      // Close this connection when a newer version wants to upgrade
      blocking(_currentVersion, _blockedVersion, event) {
        ;(event.target as IDBOpenDBRequest).result?.close()
        dbPromise = null
      },
    })
  }
  return dbPromise
}
