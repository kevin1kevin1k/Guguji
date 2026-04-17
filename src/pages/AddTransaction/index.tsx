import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TransactionRepository } from '../../db/TransactionRepository'
import { generateId } from '../../utils/id'
import type { Market, TransactionType } from '../../types'

const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'stock_dividend', label: 'Stock Dividend' },
]

function detectMarket(ticker: string): Market {
  return /^\d+$/.test(ticker.trim()) ? 'TW' : 'US'
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AddTransaction() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [type, setType] = useState<TransactionType>('buy')
  const [ticker, setTicker] = useState('')
  const [market, setMarket] = useState<Market>('TW')
  const [marketOverridden, setMarketOverridden] = useState(false)
  const [date, setDate] = useState(today())
  const [price, setPrice] = useState('')
  const [shares, setShares] = useState('')
  const [fee, setFee] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEdit) return
    TransactionRepository.getAll().then((txs) => {
      const tx = txs.find((t) => t.id === id)
      if (!tx) return
      setType(tx.type)
      setTicker(tx.ticker)
      setMarket(tx.market)
      setMarketOverridden(true)
      setDate(tx.date)
      setPrice(String(tx.price))
      setShares(String(tx.shares))
      setFee(tx.fee ? String(tx.fee) : '')
      setNote(tx.note)
    })
  }, [id, isEdit])

  function handleTickerChange(value: string) {
    setTicker(value)
    if (!marketOverridden) {
      setMarket(detectMarket(value))
    }
  }

  function handleMarketChange(value: Market) {
    setMarket(value)
    setMarketOverridden(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const priceNum = parseFloat(price)
    const sharesNum = parseFloat(shares)
    const feeNum = fee ? parseFloat(fee) : 0

    if (!ticker.trim()) return setError('Ticker is required.')
    if (isNaN(priceNum) || priceNum < 0) return setError('Price must be a non-negative number.')
    if (isNaN(sharesNum) || sharesNum <= 0) return setError('Shares must be a positive number.')
    if (isNaN(feeNum) || feeNum < 0) return setError('Fee must be a non-negative number.')

    const now = new Date().toISOString()

    if (isEdit && id) {
      await TransactionRepository.update({
        id,
        ticker: ticker.trim().toUpperCase(),
        market,
        type,
        date,
        price: priceNum,
        shares: sharesNum,
        fee: feeNum,
        note,
        createdAt: now,
      })
    } else {
      await TransactionRepository.add({
        id: generateId(),
        ticker: ticker.trim().toUpperCase(),
        market,
        type,
        date,
        price: priceNum,
        shares: sharesNum,
        fee: feeNum,
        note,
        createdAt: now,
      })
    }

    navigate('/transactions')
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold mb-4">{isEdit ? 'Edit Transaction' : 'Add Transaction'}</h2>

      {/* Type tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              type === t.value
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="ticker" className="block text-sm font-medium mb-1">Ticker</label>
            <input
              id="ticker"
              className="w-full border rounded px-3 py-2 text-sm uppercase"
              value={ticker}
              onChange={(e) => handleTickerChange(e.target.value)}
              placeholder="e.g. 0050 or AAPL"
            />
          </div>
          <div>
            <label htmlFor="market" className="block text-sm font-medium mb-1">Market</label>
            <select
              id="market"
              className="border rounded px-3 py-2 text-sm"
              value={market}
              onChange={(e) => handleMarketChange(e.target.value as Market)}
            >
              <option value="TW">TW</option>
              <option value="US">US</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium mb-1">Date</label>
          <input
            id="date"
            type="date"
            className="border rounded px-3 py-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="price" className="block text-sm font-medium mb-1">
              {type === 'dividend'
                ? `Amount per share (${market === 'TW' ? 'TWD' : 'USD'})`
                : `Price (${market === 'TW' ? 'TWD' : 'USD'})`}
            </label>
            <input
              id="price"
              type="number"
              min="0"
              step="any"
              className="w-full border rounded px-3 py-2 text-sm"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="shares" className="block text-sm font-medium mb-1">
              {type === 'dividend' ? 'Shares held' : 'Shares'}
            </label>
            <input
              id="shares"
              type="number"
              min="0"
              step="any"
              className="w-full border rounded px-3 py-2 text-sm"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
            />
          </div>
        </div>

        {(type === 'buy' || type === 'sell') && (
          <div>
            <label htmlFor="fee" className="block text-sm font-medium mb-1">
            Fee (optional, {market === 'TW' ? 'TWD' : 'USD'})
          </label>
            <input
              id="fee"
              type="number"
              min="0"
              step="any"
              className="w-full border rounded px-3 py-2 text-sm"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="0"
            />
          </div>
        )}

        <div>
          <label htmlFor="note" className="block text-sm font-medium mb-1">Note (optional)</label>
          <input
            id="note"
            className="w-full border rounded px-3 py-2 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            {isEdit ? 'Save' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/transactions')}
            className="px-4 py-2 text-sm rounded border hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
