import { useEffect, useState } from 'react'
import { ExchangeRateRepository } from '../../db/ExchangeRateRepository'
import { fetchUsdTwd } from '../../utils/exchangeRate'
import type { ExchangeRate } from '../../types'

export default function Settings() {
  const [entry, setEntry] = useState<ExchangeRate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ExchangeRateRepository.getEntry().then(setEntry)
  }, [])

  async function handleRefresh() {
    setLoading(true)
    setError(null)
    const rate = await fetchUsdTwd()
    if (rate === null) {
      setError('匯率取得失敗，請稍後再試。')
      setTimeout(() => setError(null), 5000)
    } else {
      await ExchangeRateRepository.set(rate)
      const updated = await ExchangeRateRepository.getEntry()
      setEntry(updated)
    }
    setLoading(false)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">設定</h2>

      <div className="border rounded-lg p-4 max-w-sm">
        <h3 className="text-sm font-medium text-gray-700 mb-3">匯率</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">USD / TWD</span>
          <span className="text-sm font-semibold">
            {entry ? entry.rate.toFixed(4) : '—'}
          </span>
        </div>
        {entry && (
          <p className="text-xs text-gray-400 mb-3">
            更新時間：{new Date(entry.updatedAt).toLocaleString()}
          </p>
        )}
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="w-full px-3 py-1.5 text-sm rounded border text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          {loading ? '更新中…' : '重新整理'}
        </button>
        {error && (
          <p className="text-xs text-red-600 mt-2" role="alert">{error}</p>
        )}
      </div>
    </div>
  )
}
