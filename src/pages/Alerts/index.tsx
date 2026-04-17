import { useEffect, useState } from 'react'
import { AlertRepository } from '../../db/AlertRepository'
import { generateId } from '../../utils/id'
import type { Alert, Market } from '../../types'

function detectMarket(ticker: string): Market {
  return /^\d+$/.test(ticker.trim()) ? 'TW' : 'US'
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [ticker, setTicker] = useState('')
  const [market, setMarket] = useState<Market>('TW')
  const [marketOverridden, setMarketOverridden] = useState(false)
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [repeat, setRepeat] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setAlerts(await AlertRepository.getAll())
  }

  useEffect(() => { load() }, [])

  function handleTickerChange(value: string) {
    setTicker(value)
    if (!marketOverridden) setMarket(detectMarket(value))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!ticker.trim()) return setError('Ticker is required.')
    const slNum = stopLoss ? parseFloat(stopLoss) : null
    const tpNum = takeProfit ? parseFloat(takeProfit) : null
    if (slNum === null && tpNum === null) return setError('Set at least one price.')
    if (slNum !== null && (isNaN(slNum) || slNum <= 0)) return setError('Stop-loss must be a positive number.')
    if (tpNum !== null && (isNaN(tpNum) || tpNum <= 0)) return setError('Take-profit must be a positive number.')
    await AlertRepository.upsert({
      id: generateId(),
      ticker: ticker.trim().toUpperCase(),
      market,
      stopLossPrice: slNum,
      takeProfitPrice: tpNum,
      repeat,
      isActive: true,
      createdAt: new Date().toISOString(),
    })
    setTicker(''); setMarket('TW'); setMarketOverridden(false)
    setStopLoss(''); setTakeProfit(''); setRepeat(false)
    await load()
  }

  async function handleToggleActive(alert: Alert) {
    await AlertRepository.upsert({ ...alert, isActive: !alert.isActive })
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this alert?')) return
    await AlertRepository.delete(id)
    await load()
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Alerts</h2>

      {/* Add alert form */}
      <div className="border rounded-lg p-4 mb-6 max-w-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-3">New Alert</h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="alert-ticker" className="block text-xs text-gray-500 mb-1">Ticker</label>
              <input
                id="alert-ticker"
                className="w-full border rounded px-3 py-2 text-sm uppercase"
                value={ticker}
                onChange={(e) => handleTickerChange(e.target.value)}
                placeholder="e.g. 0050 or AAPL"
              />
            </div>
            <div>
              <label htmlFor="alert-market" className="block text-xs text-gray-500 mb-1">Market</label>
              <select
                id="alert-market"
                className="border rounded px-3 py-2 text-sm"
                value={market}
                onChange={(e) => { setMarket(e.target.value as Market); setMarketOverridden(true) }}
              >
                <option value="TW">TW</option>
                <option value="US">US</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="stop-loss" className="block text-xs text-gray-500 mb-1">
                Stop-loss ({market === 'TW' ? 'TWD' : 'USD'})
              </label>
              <input
                id="stop-loss"
                type="number"
                min="0"
                step="any"
                className="w-full border rounded px-3 py-2 text-sm"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="take-profit" className="block text-xs text-gray-500 mb-1">
                Take-profit ({market === 'TW' ? 'TWD' : 'USD'})
              </label>
              <input
                id="take-profit"
                type="number"
                min="0"
                step="any"
                className="w-full border rounded px-3 py-2 text-sm"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={repeat}
              onChange={(e) => setRepeat(e.target.checked)}
            />
            Repeat (re-trigger daily)
          </label>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Add Alert
          </button>
        </form>
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <p className="text-gray-500 text-sm">No alerts set.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4">Ticker</th>
              <th className="py-2 pr-4">Market</th>
              <th className="py-2 pr-4 text-right">Stop-loss</th>
              <th className="py-2 pr-4 text-right">Take-profit</th>
              <th className="py-2 pr-4">Repeat</th>
              <th className="py-2 pr-4">Active</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id} className="border-b hover:bg-gray-50">
                <td className="py-2 pr-4 font-medium">{alert.ticker}</td>
                <td className="py-2 pr-4 text-gray-500">{alert.market}</td>
                <td className="py-2 pr-4 text-right">
                  {alert.stopLossPrice !== null ? alert.stopLossPrice.toFixed(2) : '—'}
                </td>
                <td className="py-2 pr-4 text-right">
                  {alert.takeProfitPrice !== null ? alert.takeProfitPrice.toFixed(2) : '—'}
                </td>
                <td className="py-2 pr-4">{alert.repeat ? 'Yes' : 'No'}</td>
                <td className="py-2 pr-4">
                  <button
                    onClick={() => handleToggleActive(alert)}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      alert.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {alert.isActive ? 'On' : 'Off'}
                  </button>
                </td>
                <td className="py-2">
                  <button
                    onClick={() => handleDelete(alert.id)}
                    className="text-red-600 hover:underline text-xs"
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
