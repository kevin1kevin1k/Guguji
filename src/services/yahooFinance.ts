/** 美股股價 — Yahoo Finance Query API（非官方） */
export interface YahooPrice {
  date: string // YYYY-MM-DD
  open: number
}

export async function fetchUSStockPrice(ticker: string, range = '1y'): Promise<YahooPrice[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${range}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Yahoo Finance API error: ${res.status}`)
  const json = await res.json()

  const result = json?.chart?.result?.[0]
  if (!result) return []

  const timestamps: number[] = result.timestamp ?? []
  const opens: number[] = result.indicators?.quote?.[0]?.open ?? []

  return timestamps.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    open: opens[i],
  }))
}
