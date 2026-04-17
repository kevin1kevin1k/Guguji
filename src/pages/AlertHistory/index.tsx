import { useCallback, useEffect, useState } from 'react'
import { AlertRepository } from '../../db/AlertRepository'
import type { AlertHistory } from '../../types'

const TRIGGER_TYPE_LABELS: Record<AlertHistory['triggerType'], string> = {
  stop_loss: '停損',
  take_profit: '停利',
}

const TRIGGER_TYPE_COLORS: Record<AlertHistory['triggerType'], string> = {
  stop_loss: 'bg-red-100 text-red-800',
  take_profit: 'bg-green-100 text-green-800',
}

export default function AlertHistoryPage() {
  const [history, setHistory] = useState<AlertHistory[]>([])

  const load = useCallback(async () => {
    try {
      const all = await AlertRepository.getAllHistory()
      const sorted = [...all].sort((a, b) =>
        new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
      )
      setHistory(sorted)
    } catch (err) {
      console.error('Failed to load alert history', err)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Alert History</h2>

      {history.length === 0 ? (
        <p className="text-gray-500 text-sm">No alert history.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4">觸發時間</th>
              <th className="py-2 pr-4">Ticker</th>
              <th className="py-2 pr-4">類型</th>
              <th className="py-2 pr-4 text-right">觸發價</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.id} className="border-b hover:bg-gray-50">
                <td className="py-2 pr-4 whitespace-nowrap">
                  {new Date(entry.triggeredAt).toLocaleString()}
                </td>
                <td className="py-2 pr-4 font-medium">{entry.ticker}</td>
                <td className="py-2 pr-4">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${TRIGGER_TYPE_COLORS[entry.triggerType]}`}
                  >
                    {TRIGGER_TYPE_LABELS[entry.triggerType]}
                  </span>
                </td>
                <td className="py-2 pr-4 text-right">
                  {entry.triggerPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
