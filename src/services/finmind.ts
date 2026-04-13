/** 台股股價與拆分事件 — FinMind API */
const BASE_URL = 'https://api.finmindtrade.com/api/v4/data'

export interface FinMindPrice {
  date: string
  stock_id: string
  open: number
  close: number
}

export async function fetchTWStockPrice(
  ticker: string,
  startDate: string,
  endDate: string,
  token: string,
): Promise<FinMindPrice[]> {
  const url = new URL(BASE_URL)
  url.searchParams.set('dataset', 'TaiwanStockPrice')
  url.searchParams.set('data_id', ticker)
  url.searchParams.set('start_date', startDate)
  url.searchParams.set('end_date', endDate)
  url.searchParams.set('token', token)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`FinMind API error: ${res.status}`)
  const json = await res.json()
  return json.data as FinMindPrice[]
}
