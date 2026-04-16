import type { PriceHistory, Market } from '../types'
import { PriceHistoryRepository } from '../db/PriceHistoryRepository'

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

function yahooSymbol(ticker: string, market: Market): string {
  return market === 'TW' ? `${ticker}.TW` : ticker
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseYahooResponse(data: any, ticker: string, market: Market): PriceHistory[] {
  const result = data?.chart?.result?.[0]
  if (!result) return []

  const timestamps: number[] = result.timestamp ?? []
  const opens: (number | null)[] = result.indicators?.quote?.[0]?.open ?? []

  const entries: PriceHistory[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const open = opens[i]
    if (open == null || open <= 0) continue
    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10)
    entries.push({ key: `${ticker}:${market}:${date}`, ticker, market, date, open })
  }
  return entries
}

export async function fetchYahooHistory(
  ticker: string,
  market: Market,
): Promise<PriceHistory[]> {
  try {
    const symbol = yahooSymbol(ticker, market)
    const url = `${YAHOO_BASE}/${symbol}?interval=1d&range=5y`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return parseYahooResponse(data, ticker, market)
  } catch {
    return []
  }
}

export async function refreshPriceHistory(
  tickers: { ticker: string; market: Market }[],
): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = []
  const failed: string[] = []

  for (const { ticker, market } of tickers) {
    const entries = await fetchYahooHistory(ticker, market)
    if (entries.length > 0) {
      await PriceHistoryRepository.bulkSet(entries)
      success.push(`${ticker}:${market}`)
    } else {
      failed.push(`${ticker}:${market}`)
    }
  }

  return { success, failed }
}
