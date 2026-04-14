import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { TransactionRepository } from '../../db/TransactionRepository'
import { SplitEventRepository } from '../../db/SplitEventRepository'
import { PriceCacheRepository } from '../../db/PriceCacheRepository'
import { calcPositions } from '../../utils/position'
import type { Transaction, Position, TransactionType } from '../../types'

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function pnlColor(n: number): string {
  if (n > 0) return 'text-green-600'
  if (n < 0) return 'text-red-600'
  return 'text-gray-600'
}

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

export default function StockDetail() {
  const { ticker } = useParams<{ ticker: string }>()
  const [searchParams] = useSearchParams()
  const market = searchParams.get('market') ?? ''

  const [txs, setTxs] = useState<Transaction[]>([])
  const [position, setPosition] = useState<Position | null>(null)

  useEffect(() => {
    if (!ticker) return
    async function load() {
      const [allTxs, allSplits, caches] = await Promise.all([
        TransactionRepository.getByTicker(ticker!),
        SplitEventRepository.getAll(),
        PriceCacheRepository.getAll(),
      ])
      const filtered = market
        ? allTxs.filter((t) => t.market === market)
        : allTxs
      const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))
      setTxs(sorted)

      const prices: Record<string, number> = {}
      for (const c of caches) {
        prices[`${c.ticker}:${c.market}`] = c.price
      }
      const positions = calcPositions(filtered, allSplits, prices)
      const key = `${ticker}:${market}`
      setPosition(positions.find((p) => `${p.ticker}:${p.market}` === key) ?? positions[0] ?? null)
    }
    load()
  }, [ticker, market])

  if (!ticker) return null

  const hasPrice = !!position && position.currentPrice > 0

  return (
    <div>
      <div className="mb-4">
        <Link to="/" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
      </div>

      {/* Header */}
      <div className="flex items-baseline gap-3 mb-6">
        <h2 className="text-2xl font-bold">{ticker}</h2>
        {market && <span className="text-sm text-gray-500 border rounded px-1.5 py-0.5">{market}</span>}
        {hasPrice && (
          <span className="text-xl font-semibold">
            {fmt(position!.currentPrice)}
          </span>
        )}
      </div>

      {/* Position summary */}
      {position ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Shares</p>
            <p className="text-lg font-semibold">{fmt(position.shares, 4)}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Avg Cost</p>
            <p className="text-lg font-semibold">{fmt(position.avgCost)}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Market Value</p>
            <p className="text-lg font-semibold">{hasPrice ? fmt(position.currentValue, 0) : '—'}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Unrealized P&amp;L</p>
            <p className={`text-lg font-semibold ${hasPrice ? pnlColor(position.unrealizedPnl) : 'text-gray-400'}`}>
              {hasPrice
                ? `${position.unrealizedPnl >= 0 ? '+' : ''}${fmt(position.unrealizedPnl, 0)} (${position.unrealizedPnlPct >= 0 ? '+' : ''}${fmt(position.unrealizedPnlPct)}%)`
                : '—'}
            </p>
          </div>
        </div>
      ) : (
        txs.length === 0 && (
          <p className="text-gray-500 text-sm mb-6">No transactions found.</p>
        )
      )}

      {/* Transaction history */}
      {txs.length > 0 && (
        <>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Transaction History</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4 text-right">Shares</th>
                <th className="py-2 pr-4 text-right">Price</th>
                <th className="py-2 pr-4 text-right">Fee</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((tx) => (
                <tr key={tx.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 whitespace-nowrap">{tx.date}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[tx.type]}`}>
                      {TYPE_LABELS[tx.type]}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right">{fmt(tx.shares, 4)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(tx.price)}</td>
                  <td className="py-2 pr-4 text-right">{tx.fee || '—'}</td>
                  <td className="py-2 text-gray-500 max-w-xs truncate">{tx.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
