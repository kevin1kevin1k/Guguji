import { describe, it, expect } from 'vitest'
import { transactionsToCSV } from './csv'
import type { Transaction } from '../types'

const tx: Transaction = {
  id: '1',
  ticker: '0050',
  market: 'TW',
  type: 'buy',
  date: '2024-01-15',
  price: 148.5,
  shares: 100,
  fee: 30,
  note: 'first buy',
  createdAt: '',
}

describe('transactionsToCSV', () => {
  it('includes header row', () => {
    const csv = transactionsToCSV([tx])
    expect(csv.startsWith('date,ticker,market,type,price,shares,fee,note')).toBe(true)
  })

  it('outputs one data row per transaction', () => {
    const csv = transactionsToCSV([tx])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2) // header + 1 row
    expect(lines[1]).toBe('2024-01-15,0050,TW,buy,148.5,100,30,first buy')
  })

  it('escapes fields containing commas', () => {
    const csv = transactionsToCSV([{ ...tx, note: 'a, b' }])
    expect(csv).toContain('"a, b"')
  })

  it('escapes fields containing double quotes', () => {
    const csv = transactionsToCSV([{ ...tx, note: 'say "hello"' }])
    expect(csv).toContain('"say ""hello"""')
  })

  it('produces empty output (header only) for empty array', () => {
    const csv = transactionsToCSV([])
    expect(csv).toBe('date,ticker,market,type,price,shares,fee,note')
  })
})
