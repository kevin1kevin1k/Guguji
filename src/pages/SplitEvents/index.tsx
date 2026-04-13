import { useEffect, useState } from 'react'
import { SplitEventRepository } from '../../db/SplitEventRepository'
import { generateId } from '../../utils/id'
import type { SplitEvent, Market } from '../../types'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function SplitEvents() {
  const [events, setEvents] = useState<SplitEvent[]>([])
  const [ticker, setTicker] = useState('')
  const [market, setMarket] = useState<Market>('TW')
  const [effectiveDate, setEffectiveDate] = useState(today())
  const [ratioFrom, setRatioFrom] = useState('1')
  const [ratioTo, setRatioTo] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const all = await SplitEventRepository.getAll()
    setEvents(all.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)))
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const from = parseFloat(ratioFrom)
    const to = parseFloat(ratioTo)

    if (!ticker.trim()) return setError('Ticker is required.')
    if (isNaN(from) || from <= 0) return setError('Ratio from must be a positive number.')
    if (isNaN(to) || to <= 0) return setError('Ratio to must be a positive number.')

    await SplitEventRepository.add({
      id: generateId(),
      ticker: ticker.trim().toUpperCase(),
      market,
      effectiveDate,
      ratioFrom: from,
      ratioTo: to,
      source: 'user',
      createdAt: new Date().toISOString(),
    })

    setTicker('')
    setRatioFrom('1')
    setRatioTo('')
    setError('')
    await load()
  }

  async function handleDelete(event: SplitEvent) {
    if (!confirm(`Delete split event for ${event.ticker}?`)) return
    await SplitEventRepository.delete(event.id)
    await load()
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Split Events</h2>

      {/* Add form */}
      <div className="border rounded-lg p-4 mb-6 max-w-lg">
        <h3 className="text-sm font-semibold mb-3">Add Custom Split Event</h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="sp-ticker" className="block text-xs font-medium mb-1">Ticker</label>
              <input
                id="sp-ticker"
                className="w-full border rounded px-2 py-1.5 text-sm uppercase"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="e.g. 2330"
              />
            </div>
            <div>
              <label htmlFor="sp-market" className="block text-xs font-medium mb-1">Market</label>
              <select
                id="sp-market"
                className="border rounded px-2 py-1.5 text-sm"
                value={market}
                onChange={(e) => setMarket(e.target.value as Market)}
              >
                <option value="TW">TW</option>
                <option value="US">US</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="sp-date" className="block text-xs font-medium mb-1">Effective Date</label>
            <input
              id="sp-date"
              type="date"
              className="border rounded px-2 py-1.5 text-sm"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <div>
              <label htmlFor="sp-from" className="block text-xs font-medium mb-1">From</label>
              <input
                id="sp-from"
                type="number"
                min="1"
                step="1"
                className="w-20 border rounded px-2 py-1.5 text-sm"
                value={ratioFrom}
                onChange={(e) => setRatioFrom(e.target.value)}
              />
            </div>
            <span className="mt-4 text-gray-500">:</span>
            <div>
              <label htmlFor="sp-to" className="block text-xs font-medium mb-1">To</label>
              <input
                id="sp-to"
                type="number"
                min="1"
                step="1"
                className="w-20 border rounded px-2 py-1.5 text-sm"
                value={ratioTo}
                onChange={(e) => setRatioTo(e.target.value)}
                placeholder="e.g. 4"
              />
            </div>
            <span className="mt-4 text-xs text-gray-500">(1 share → To shares)</span>
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <button
            type="submit"
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Add
          </button>
        </form>
      </div>

      {/* Events list */}
      {events.length === 0 ? (
        <p className="text-gray-500 text-sm">No split events.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4">Ticker</th>
              <th className="py-2 pr-4">Market</th>
              <th className="py-2 pr-4">Effective Date</th>
              <th className="py-2 pr-4">Ratio</th>
              <th className="py-2 pr-4">Source</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id} className="border-b hover:bg-gray-50">
                <td className="py-2 pr-4 font-medium">{ev.ticker}</td>
                <td className="py-2 pr-4 text-gray-500">{ev.market}</td>
                <td className="py-2 pr-4">{ev.effectiveDate}</td>
                <td className="py-2 pr-4">{ev.ratioFrom}:{ev.ratioTo}</td>
                <td className="py-2 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    ev.source === 'built_in'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {ev.source === 'built_in' ? 'built-in' : 'custom'}
                  </span>
                </td>
                <td className="py-2">
                  {ev.source === 'user' && (
                    <button
                      onClick={() => handleDelete(ev)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
