import type { Transaction } from '../types'

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

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
