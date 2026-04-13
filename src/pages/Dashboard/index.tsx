import { useEffect, useState } from 'react'
import { TransactionRepository } from '../../db/TransactionRepository'
import { SplitEventRepository } from '../../db/SplitEventRepository'
import { PriceCacheRepository } from '../../db/PriceCacheRepository'
import { calcPositions } from '../../utils/position'
import type { Position } from '../../types'

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function pnlColor(n: number): string {
  if (n > 0) return 'text-green-600'
  if (n < 0) return 'text-red-600'
  return 'text-gray-600'
}

type Tab = 'open' | 'closed'

export default function Dashboard() {
  const [positions, setPositions] = useState<Position[]>([])
  const [tab, setTab] = useState<Tab>('open')

  useEffect(() => {
    async function load() {
      const [txs, splits, caches] = await Promise.all([
        TransactionRepository.getAll(),
        SplitEventRepository.getAll(),
        PriceCacheRepository.getAll(),
      ])
      const prices: Record<string, number> = {}
      for (const c of caches) {
        prices[`${c.ticker}:${c.market}`] = c.price
      }
      setPositions(calcPositions(txs, splits, prices))
    }
    load()
  }, [])

  const visible = positions.filter((p) => (tab === 'open' ? p.isOpen : !p.isOpen))

  const twTotal = positions.filter((p) => p.isOpen && p.market === 'TW')
    .reduce((s, p) => s + p.currentValue, 0)
  const usTotal = positions.filter((p) => p.isOpen && p.market === 'US')
    .reduce((s, p) => s + p.currentValue, 0)
  const totalPnl = positions.filter((p) => p.isOpen)
    .reduce((s, p) => s + p.unrealizedPnl, 0)

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Dashboard</h2>

      {/* Total assets card */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">TW Market Value</p>
          <p className="text-lg font-semibold">TWD {fmt(twTotal, 0)}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">US Market Value</p>
          <p className="text-lg font-semibold">USD {fmt(usTotal, 0)}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Today's P&amp;L</p>
          <p className="text-lg font-semibold text-gray-400">—</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Unrealized P&amp;L</p>
          <p className={`text-lg font-semibold ${pnlColor(totalPnl)}`}>
            {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl, 0)}
          </p>
        </div>
      </div>

      {/* Open / Closed toggle */}
      <div className="flex gap-1 mb-4 border-b">
        {(['open', 'closed'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${
              tab === t
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {tab === 'open' ? 'No open positions.' : 'No closed positions.'}
        </p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4">Ticker</th>
              <th className="py-2 pr-4">Market</th>
              <th className="py-2 pr-4 text-right">Shares</th>
              <th className="py-2 pr-4 text-right">Avg Cost</th>
              <th className="py-2 pr-4 text-right">Price</th>
              <th className="py-2 pr-4 text-right">Value</th>
              <th className="py-2 pr-4 text-right">P&amp;L</th>
              <th className="py-2 text-right">P&amp;L %</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((pos) => {
              const hasPrice = pos.currentPrice > 0
              return (
                <tr key={`${pos.ticker}:${pos.market}`} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">{pos.ticker}</td>
                  <td className="py-2 pr-4 text-gray-500">{pos.market}</td>
                  <td className="py-2 pr-4 text-right">{fmt(pos.shares, 4)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(pos.avgCost)}</td>
                  <td className="py-2 pr-4 text-right">{hasPrice ? fmt(pos.currentPrice) : '—'}</td>
                  <td className="py-2 pr-4 text-right">{hasPrice ? fmt(pos.currentValue, 0) : '—'}</td>
                  <td className={`py-2 pr-4 text-right ${hasPrice ? pnlColor(pos.unrealizedPnl) : 'text-gray-400'}`}>
                    {hasPrice ? `${pos.unrealizedPnl >= 0 ? '+' : ''}${fmt(pos.unrealizedPnl, 0)}` : '—'}
                  </td>
                  <td className={`py-2 text-right ${hasPrice ? pnlColor(pos.unrealizedPnlPct) : 'text-gray-400'}`}>
                    {hasPrice ? `${pos.unrealizedPnlPct >= 0 ? '+' : ''}${fmt(pos.unrealizedPnlPct)}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
