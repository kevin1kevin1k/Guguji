import type { PriceHistory } from '../types'

const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseFinmindResponse(data: any, ticker: string): PriceHistory[] {
  const rows: { date: string; open: number }[] = data?.data ?? []
  return rows
    .filter((r) => r.open > 0)
    .map((r) => ({
      key: `${ticker}:TW:${r.date}`,
      ticker,
      market: 'TW' as const,
      date: r.date,
      open: r.open,
    }))
}

export async function fetchFinmindHistory(
  ticker: string,
  token: string,
): Promise<PriceHistory[]> {
  const startDate = new Date()
  startDate.setFullYear(startDate.getFullYear() - 5)
  const start = startDate.toISOString().slice(0, 10)

  const url =
    `${FINMIND_BASE}?dataset=TaiwanStockPrice` +
    `&data_id=${encodeURIComponent(ticker)}` +
    `&start_date=${start}` +
    `&token=${encodeURIComponent(token)}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return parseFinmindResponse(data, ticker)
}
