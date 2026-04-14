import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TransactionRepository } from '../../db/TransactionRepository'
import { transactionsToCSV, downloadCSV, parseTransactionsFromCSV } from '../../utils/csv'
import type { Transaction, TransactionType } from '../../types'

const TYPE_LABELS: Record<TransactionType, string> = {
  buy: 'Buy',
  sell: 'Sell',
  dividend: 'Dividend',
  stock_dividend: 'Stock Div',
}

const TYPE_COLORS: Record<TransactionType, string> = {
  buy: 'bg-green-100 text-green-800',
  sell: 'bg-red-100 text-red-800',
  dividend: 'bg-blue-100 text-blue-800',
  stock_dividend: 'bg-purple-100 text-purple-800',
}

export default function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filterTicker, setFilterTicker] = useState('')
  const [filterType, setFilterType] = useState<TransactionType | ''>('')
  const [importMsg, setImportMsg] = useState<string | null>(null)

  async function load() {
    const all = await TransactionRepository.getAll()
    setTransactions(all.sort((a, b) => b.date.localeCompare(a.date)))
  }

  useEffect(() => { load() }, [])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const text = await file.text()
    const existing = await TransactionRepository.getAll()
    const existingKeys = new Set(
      existing.map((tx) => `${tx.date}|${tx.ticker}|${tx.market}|${tx.type}|${tx.price}|${tx.shares}`),
    )
    const { transactions, result } = parseTransactionsFromCSV(text, existingKeys)

    for (const tx of transactions) {
      await TransactionRepository.add(tx)
    }
    await load()

    const parts = [`匯入 ${result.imported} 筆`]
    if (result.skipped > 0) parts.push(`略過 ${result.skipped} 筆`)
    if (result.errors.length > 0) parts.push(`錯誤：${result.errors.slice(0, 3).join('；')}`)
    setImportMsg(parts.join('，'))
    setTimeout(() => setImportMsg(null), 5000)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this transaction?')) return
    await TransactionRepository.delete(id)
    await load()
  }

  const filtered = transactions.filter((tx) => {
    if (filterTicker && !tx.ticker.toLowerCase().includes(filterTicker.toLowerCase())) return false
    if (filterType && tx.type !== filterType) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Transactions</h2>
        <div className="flex gap-2">
          <label className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50 cursor-pointer">
            Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Import CSV"
              onChange={handleImport}
            />
          </label>
          <button
            onClick={() => {
              const date = new Date().toISOString().slice(0, 10)
              downloadCSV(transactionsToCSV(transactions), `guguji_export_${date}.csv`)
            }}
            className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50"
          >
            Export CSV
          </button>
          <Link
            to="/transactions/new"
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            + Add
          </Link>
        </div>
      </div>

      {importMsg && (
        <p className="mb-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2" role="status">
          {importMsg}
        </p>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          className="border rounded px-3 py-1.5 text-sm"
          placeholder="Filter by ticker"
          value={filterTicker}
          onChange={(e) => setFilterTicker(e.target.value)}
          aria-label="Filter by ticker"
        />
        <select
          className="border rounded px-3 py-1.5 text-sm"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as TransactionType | '')}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
          <option value="dividend">Dividend</option>
          <option value="stock_dividend">Stock Dividend</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm">No transactions found.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Ticker</th>
              <th className="py-2 pr-4">Market</th>
              <th className="py-2 pr-4 text-right">Shares</th>
              <th className="py-2 pr-4 text-right">Price</th>
              <th className="py-2 pr-4 text-right">Fee</th>
              <th className="py-2 pr-4">Note</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => (
              <tr key={tx.id} className="border-b hover:bg-gray-50">
                <td className="py-2 pr-4 whitespace-nowrap">{tx.date}</td>
                <td className="py-2 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[tx.type]}`}>
                    {TYPE_LABELS[tx.type]}
                  </span>
                </td>
                <td className="py-2 pr-4 font-medium">{tx.ticker}</td>
                <td className="py-2 pr-4 text-gray-500">{tx.market}</td>
                <td className="py-2 pr-4 text-right">{tx.shares}</td>
                <td className="py-2 pr-4 text-right">{tx.price}</td>
                <td className="py-2 pr-4 text-right">{tx.fee || '—'}</td>
                <td className="py-2 pr-4 text-gray-500 max-w-xs truncate">{tx.note}</td>
                <td className="py-2 whitespace-nowrap">
                  <Link
                    to={`/transactions/${tx.id}/edit`}
                    className="text-blue-600 hover:underline mr-3"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
