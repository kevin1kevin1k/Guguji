import { describe, it, expect } from 'vitest'
import { transactionsToCSV, parseTransactionsFromCSV } from './csv'
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

describe('parseTransactionsFromCSV', () => {
  const validCSV = `date,ticker,market,type,price,shares,fee,note
2024-01-15,0050,TW,buy,148.5,100,30,first buy
2024-03-01,AAPL,US,sell,175,50,1.5,partial exit`

  it('parses valid CSV into transactions', () => {
    const { transactions, result } = parseTransactionsFromCSV(validCSV)
    expect(transactions).toHaveLength(2)
    expect(result.imported).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('sets correct field values', () => {
    const { transactions } = parseTransactionsFromCSV(validCSV)
    const first = transactions[0]
    expect(first.ticker).toBe('0050')
    expect(first.market).toBe('TW')
    expect(first.type).toBe('buy')
    expect(first.price).toBe(148.5)
    expect(first.shares).toBe(100)
    expect(first.fee).toBe(30)
    expect(first.note).toBe('first buy')
  })

  it('returns empty array for empty string', () => {
    const { transactions, result } = parseTransactionsFromCSV('')
    expect(transactions).toHaveLength(0)
    expect(result.imported).toBe(0)
  })

  it('returns error for invalid header', () => {
    const { result } = parseTransactionsFromCSV('wrong,header\n2024-01-01,A,TW,buy,1,1,0,')
    expect(result.errors).toContain('Invalid CSV header')
  })

  it('skips rows with invalid date format', () => {
    const csv = `date,ticker,market,type,price,shares,fee,note
01-15-2024,0050,TW,buy,100,10,0,`
    const { transactions, result } = parseTransactionsFromCSV(csv)
    expect(transactions).toHaveLength(0)
    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toMatch(/invalid date/)
  })

  it('skips rows with invalid market', () => {
    const csv = `date,ticker,market,type,price,shares,fee,note
2024-01-01,AAPL,JP,buy,100,10,0,`
    const { result } = parseTransactionsFromCSV(csv)
    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toMatch(/invalid market/)
  })

  it('skips rows with invalid type', () => {
    const csv = `date,ticker,market,type,price,shares,fee,note
2024-01-01,AAPL,US,transfer,100,10,0,`
    const { result } = parseTransactionsFromCSV(csv)
    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toMatch(/invalid type/)
  })

  it('deduplicates rows with identical content', () => {
    const csv = `date,ticker,market,type,price,shares,fee,note
2024-01-01,0050,TW,buy,100,10,0,
2024-01-01,0050,TW,buy,100,10,0,`
    const { transactions, result } = parseTransactionsFromCSV(csv)
    expect(transactions).toHaveLength(1)
    expect(result.skipped).toBe(1)
  })

  it('skips rows that match existing transactions', () => {
    const csv = `date,ticker,market,type,price,shares,fee,note
2024-01-01,0050,TW,buy,100,10,0,`
    const existing = new Set(['2024-01-01|0050|TW|buy|100|10'])
    const { transactions, result } = parseTransactionsFromCSV(csv, existing)
    expect(transactions).toHaveLength(0)
    expect(result.skipped).toBe(1)
  })

  it('parses quoted fields with commas correctly', () => {
    const csv = `date,ticker,market,type,price,shares,fee,note
2024-01-01,0050,TW,buy,100,10,0,"buy on dip, cheap"`
    const { transactions } = parseTransactionsFromCSV(csv)
    expect(transactions[0].note).toBe('buy on dip, cheap')
  })
})
