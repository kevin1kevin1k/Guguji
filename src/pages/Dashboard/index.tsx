import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TransactionRepository } from '../../db/TransactionRepository'
import { SplitEventRepository } from '../../db/SplitEventRepository'
import { PriceCacheRepository } from '../../db/PriceCacheRepository'
import { PriceHistoryRepository } from '../../db/PriceHistoryRepository'
import { ExchangeRateRepository } from '../../db/ExchangeRateRepository'
import { calcPositions } from '../../utils/position'
import { calcPortfolioHistory, filterByRange, type ChartPoint } from '../../utils/chartData'
import { refreshPriceHistory } from '../../utils/priceHistory'
import { AlertRepository } from '../../db/AlertRepository'
import { checkAlerts, getLatestPrices } from '../../utils/alertCheck'
import { showAlertNotification } from '../../utils/notification'
import { generateId } from '../../utils/id'
import type { Position, Transaction, SplitEvent } from '../../types'

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function pnlColor(n: number): string {
  if (n > 0) return 'text-green-600'
  if (n < 0) return 'text-red-600'
  return 'text-gray-600'
}

const RANGES = ['1M', '3M', '6M', 'YTD', '1Y', '3Y', 'ALL'] as const
type Range = (typeof RANGES)[number]
type Tab = 'open' | 'closed'

const PIE_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]

export default function Dashboard() {
  const [positions, setPositions] = useState<Position[]>([])
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([])
  const [range, setRange] = useState<Range>('1Y')
  const [tab, setTab] = useState<Tab>('open')
  const [hasHistory, setHasHistory] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const [usdTwdRate, setUsdTwdRate] = useState<number | null>(null)
  const [latestHistPrices, setLatestHistPrices] = useState<Record<string, number>>({})

  const load = useCallback(async (): Promise<Position[]> => {
    const [txs, splits, caches, histEntries, usdTwd] = await Promise.all([
      TransactionRepository.getAll() as Promise<Transaction[]>,
      SplitEventRepository.getAll() as Promise<SplitEvent[]>,
      PriceCacheRepository.getAll(),
      PriceHistoryRepository.getAll(),
      ExchangeRateRepository.getUsdTwd(),
    ])

    const prices: Record<string, number> = {}
    for (const c of caches) {
      prices[`${c.ticker}:${c.market}`] = c.price
    }

    const histMap = new Map<string, number>()
    for (const h of histEntries) {
      histMap.set(h.key, h.open)
    }

    const computed = calcPositions(txs, splits, prices)
    setPositions(computed)
    setChartPoints(calcPortfolioHistory(txs, splits, prices, histMap.size > 0 ? histMap : undefined, usdTwd ?? undefined))
    setHasHistory(histMap.size > 0)
    setUsdTwdRate(usdTwd)
    setLatestHistPrices(getLatestPrices(histEntries))
    return computed
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const freshPositions = await load()
      const openTickers = freshPositions
        .filter((p) => p.isOpen)
        .map((p) => ({ ticker: p.ticker, market: p.market }))
      const { failed } = await refreshPriceHistory(openTickers)
      await load()

      // Alert check using newly fetched price history
      const [histEntries, activeAlerts] = await Promise.all([
        PriceHistoryRepository.getAll(),
        AlertRepository.getAll(),
      ])
      const latestPrices = getLatestPrices(histEntries)
      const triggers = checkAlerts(latestPrices, activeAlerts)
      for (const { alert, triggerType, triggerPrice } of triggers) {
        const threshold = triggerType === 'stop_loss' ? alert.stopLossPrice! : alert.takeProfitPrice!
        await AlertRepository.addHistory({
          id: generateId(),
          alertId: alert.id,
          ticker: alert.ticker,
          triggerType,
          triggerPrice,
          triggeredAt: new Date().toISOString(),
        })
        if (!alert.repeat) {
          await AlertRepository.upsert({ ...alert, isActive: false })
        }
        await showAlertNotification(triggerType, alert.ticker, alert.market, triggerPrice, threshold)
      }

      setLastUpdated(new Date())
      if (failed.length > 0) {
        setRefreshMsg(`更新失敗：${failed.join('、')}`)
        setTimeout(() => setRefreshMsg(null), 5000)
      }
    } finally {
      setRefreshing(false)
    }
  }

  const visible = positions.filter((p) => (tab === 'open' ? p.isOpen : !p.isOpen))
  const twTotal = positions.filter((p) => p.isOpen && p.market === 'TW')
    .reduce((s, p) => s + p.currentValue, 0)
  const usTotal = positions.filter((p) => p.isOpen && p.market === 'US')
    .reduce((s, p) => s + p.currentValue, 0)
  const twPnl = positions.filter((p) => p.isOpen && p.market === 'TW')
    .reduce((s, p) => s + p.unrealizedPnl, 0)
  const usPnl = positions.filter((p) => p.isOpen && p.market === 'US')
    .reduce((s, p) => s + p.unrealizedPnl, 0)
  const totalPnlTwd = usdTwdRate !== null ? twPnl + usPnl * usdTwdRate : null

  const filteredPoints = filterByRange(chartPoints, range)
  const totalTwd = usdTwdRate !== null ? twTotal + usTotal * usdTwdRate : null

  const openPositionsPriced = positions
    .filter((p) => p.isOpen)
    .map((p) => {
      const price = p.currentPrice > 0
        ? p.currentPrice
        : latestHistPrices[`${p.ticker}:${p.market}`] ?? 0
      return { ticker: p.ticker, market: p.market, value: price * p.shares }
    })
    .filter((p) => p.value > 0)
  const hasTwPie = openPositionsPriced.some((p) => p.market === 'TW')
  const hasUsPie = openPositionsPriced.some((p) => p.market === 'US')
  const pieNeedsRate = hasTwPie && hasUsPie
  const canShowPie = openPositionsPriced.length > 0 && (!pieNeedsRate || usdTwdRate !== null)
  const pieCcy: 'TWD' | 'USD' = hasUsPie && !hasTwPie ? 'USD' : 'TWD'
  const pieData = canShowPie
    ? openPositionsPriced
        .map((p) => ({
          name: p.ticker,
          market: p.market,
          value: p.market === 'US' && usdTwdRate !== null
            ? p.value * usdTwdRate
            : p.value,
        }))
        .sort((a, b) => b.value - a.value)
    : []
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0)

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Dashboard</h2>

      {/* Total assets card */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
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
          {totalPnlTwd !== null ? (
            <p className={`text-lg font-semibold ${pnlColor(totalPnlTwd)}`}>
              {totalPnlTwd >= 0 ? '+' : '-'}TWD {fmt(Math.abs(totalPnlTwd), 0)}
            </p>
          ) : (
            <div className="space-y-0.5">
              <p className={`text-sm font-semibold ${pnlColor(twPnl)}`}>
                {twPnl >= 0 ? '+' : '-'}TWD {fmt(Math.abs(twPnl), 0)}
              </p>
              <p className={`text-sm font-semibold ${pnlColor(usPnl)}`}>
                {usPnl >= 0 ? '+' : '-'}USD {fmt(Math.abs(usPnl), 0)}
              </p>
            </div>
          )}
        </div>
        <div className="border rounded-lg p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-gray-500 mb-1">Total (TWD)</p>
          <p className="text-lg font-semibold">
            {totalTwd !== null ? `TWD ${fmt(totalTwd, 0)}` : '—'}
          </p>
        </div>
      </div>

      {/* Portfolio chart + Asset allocation */}
      {(chartPoints.length > 0 || openPositionsPriced.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {chartPoints.length > 0 && (
            <div className={`border rounded-lg p-4 ${openPositionsPriced.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-sm font-medium text-gray-700">
                  Portfolio Value
                  {hasHistory ? ' (historical prices)' : ' (estimated at current prices)'}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="px-2 py-0.5 text-xs rounded border text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                  >
                    {refreshing ? 'Refreshing…' : 'Refresh Prices'}
                  </button>
                  {lastUpdated && (
                    <span className="text-xs text-gray-400">
                      Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <div className="flex gap-1 flex-wrap">
                    {RANGES.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={`px-2 py-0.5 text-xs rounded ${
                          range === r
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {refreshMsg && (
                <p className="text-xs text-red-600 mb-2" role="status">{refreshMsg}</p>
              )}
              {filteredPoints.length < 2 ? (
                <p className="text-sm text-gray-400 text-center py-8">Not enough data for this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={filteredPoints} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => {
                        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
                        if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
                        return String(v)
                      }}
                      width={50}
                    />
                    <Tooltip
                      formatter={(value) => [fmt(Number(value), 0), 'Value']}
                      labelStyle={{ fontSize: 12 }}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#chartGradient)"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
          {openPositionsPriced.length > 0 && (
            <div className={`border rounded-lg p-4 ${chartPoints.length > 0 ? '' : 'lg:col-span-3'}`}>
              <p className="text-sm font-medium text-gray-700 mb-3">Asset Allocation</p>
              {!canShowPie ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  Set USD/TWD rate to view cross-market allocation.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) =>
                        (percent ?? 0) >= 0.03 ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : ''
                      }
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [
                        `${pieCcy} ${fmt(Number(value), 0)} (${((Number(value) / pieTotal) * 100).toFixed(1)}%)`,
                        'Value',
                      ]}
                      labelStyle={{ fontSize: 12 }}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      )}

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
                  <td className="py-2 pr-4 font-medium">
                    <Link
                      to={`/stocks/${pos.ticker}?market=${pos.market}`}
                      className="hover:underline text-blue-700"
                    >
                      {pos.ticker}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{pos.market}</td>
                  <td className="py-2 pr-4 text-right">{fmt(pos.shares, 4)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(pos.avgCost)}</td>
                  <td className="py-2 pr-4 text-right">{hasPrice ? fmt(pos.currentPrice) : '—'}</td>
                  <td className="py-2 pr-4 text-right">
                    {hasPrice ? `${pos.market === 'TW' ? 'TWD' : 'USD'} ${fmt(pos.currentValue, 0)}` : '—'}
                  </td>
                  <td className={`py-2 pr-4 text-right ${hasPrice ? pnlColor(pos.unrealizedPnl) : 'text-gray-400'}`}>
                    {hasPrice
                      ? `${pos.unrealizedPnl >= 0 ? '+' : '-'}${pos.market === 'TW' ? 'TWD' : 'USD'} ${fmt(Math.abs(pos.unrealizedPnl), 0)}`
                      : '—'}
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
