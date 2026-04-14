import type { Transaction, TransactionType, Market } from '../types'
import { generateId } from './id'

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

const CSV_HEADERS = ['date', 'ticker', 'market', 'type', 'price', 'shares', 'fee', 'note']

function escapeField(value: string | number): string {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function transactionsToCSV(transactions: Transaction[]): string {
  const rows = transactions.map((tx) =>
    [tx.date, tx.ticker, tx.market, tx.type, tx.price, tx.shares, tx.fee, tx.note]
      .map(escapeField)
      .join(','),
  )
  return [CSV_HEADERS.join(','), ...rows].join('\n')
}

/**
 * Parses a single CSV line, handling quoted fields (RFC 4180).
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current)
  return fields
}

const VALID_TYPES = new Set<string>(['buy', 'sell', 'dividend', 'stock_dividend'])
const VALID_MARKETS = new Set<string>(['TW', 'US'])

/**
 * Parses CSV text into Transaction objects.
 * Skips rows with validation errors and returns an ImportResult summary.
 */
export function parseTransactionsFromCSV(
  csv: string,
  existingIds: Set<string> = new Set(),
): { transactions: Transaction[]; result: ImportResult } {
  const lines = csv.split('\n').map((l) => l.trimEnd()).filter(Boolean)
  if (lines.length === 0) {
    return { transactions: [], result: { imported: 0, skipped: 0, errors: [] } }
  }

  // Validate header
  const header = lines[0].toLowerCase()
  if (!header.startsWith('date,ticker,market,type,price,shares,fee,note')) {
    return {
      transactions: [],
      result: { imported: 0, skipped: 0, errors: ['Invalid CSV header'] },
    }
  }

  const transactions: Transaction[] = []
  const errors: string[] = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const row = i + 1
    const fields = parseCSVLine(lines[i])

    if (fields.length < 8) {
      errors.push(`Row ${row}: expected 8 columns, got ${fields.length}`)
      skipped++
      continue
    }

    const [date, ticker, market, type_, priceStr, sharesStr, feeStr, note] = fields

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`Row ${row}: invalid date "${date}"`)
      skipped++
      continue
    }
    if (!ticker.trim()) {
      errors.push(`Row ${row}: ticker is empty`)
      skipped++
      continue
    }
    if (!VALID_MARKETS.has(market)) {
      errors.push(`Row ${row}: invalid market "${market}"`)
      skipped++
      continue
    }
    if (!VALID_TYPES.has(type_)) {
      errors.push(`Row ${row}: invalid type "${type_}"`)
      skipped++
      continue
    }

    const price = parseFloat(priceStr)
    const shares = parseFloat(sharesStr)
    const fee = parseFloat(feeStr) || 0

    if (isNaN(price) || price < 0) {
      errors.push(`Row ${row}: invalid price "${priceStr}"`)
      skipped++
      continue
    }
    if (isNaN(shares) || shares <= 0) {
      errors.push(`Row ${row}: invalid shares "${sharesStr}"`)
      skipped++
      continue
    }

    const tx: Transaction = {
      id: generateId(),
      ticker: ticker.trim().toUpperCase(),
      market: market as Market,
      type: type_ as TransactionType,
      date,
      price,
      shares,
      fee,
      note: note ?? '',
      createdAt: new Date().toISOString(),
    }

    // Deduplicate by content (same date+ticker+market+type+price+shares)
    const contentKey = `${tx.date}|${tx.ticker}|${tx.market}|${tx.type}|${tx.price}|${tx.shares}`
    if (existingIds.has(contentKey)) {
      skipped++
      continue
    }
    existingIds.add(contentKey)

    transactions.push(tx)
  }

  return {
    transactions,
    result: { imported: transactions.length, skipped, errors },
  }
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
