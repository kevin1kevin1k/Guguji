import type { PriceHistory, Market } from '../types'
import { PriceHistoryRepository } from '../db/PriceHistoryRepository'

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

// Free CORS proxies tried in order; direct call attempted first
const CORS_PROXIES = [
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
]

function yahooSymbol(ticker: string, market: Market): string {
  return market === 'TW' ? `${ticker}.TW` : ticker
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
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
  const symbol = yahooSymbol(ticker, market)
  const yahooUrl = `${YAHOO_BASE}/${symbol}?interval=1d&range=5y`

  // Try direct, then each proxy in order
  const candidates = [yahooUrl, ...CORS_PROXIES.map((p) => p(yahooUrl))]
  for (const url of candidates) {
    try {
      const data = await fetchJson(url)
      const entries = parseYahooResponse(data, ticker, market)
      if (entries.length > 0) return entries
    } catch {
      // try next
    }
  }
  return []
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
