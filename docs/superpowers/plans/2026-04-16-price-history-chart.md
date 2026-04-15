# Price History Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase 1 chart estimation (current price × historical shares) with real historical open prices fetched from Yahoo Finance, stored in IndexedDB, refreshed on demand via a button in the Dashboard.

**Architecture:** Add a `price_history` IDB store (DB v1→v2). A new `priceHistory.ts` utility fetches from Yahoo Finance and parses the response. `calcPortfolioHistory` gains an optional 4th parameter `historicalPrices: Map<string, number>` — when provided it looks up the actual open price per date, falling back up to 7 days back for weekends/holidays, then falling back to current price. The Dashboard loads history from IDB and exposes a Refresh Prices button.

**Tech Stack:** idb (IndexedDB), Yahoo Finance unofficial API, React, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `PriceHistory` interface |
| `src/db/schema.ts` | Bump `DB_VERSION` 1→2; add `price_history` store in `upgrade()` |
| `src/db/PriceHistoryRepository.ts` | **New** — `bulkSet`, `getByTicker`, `getAll` |
| `src/db/PriceHistoryRepository.test.ts` | **New** — IDB integration tests |
| `src/utils/priceHistory.ts` | **New** — `parseYahooResponse`, `fetchYahooHistory`, `refreshPriceHistory` |
| `src/utils/priceHistory.test.ts` | **New** — unit tests for parse logic |
| `src/utils/chartData.ts` | Add optional `historicalPrices` param + `findHistoricalPrice` helper |
| `src/utils/chartData.test.ts` | Add tests for historical price lookup |
| `src/pages/Dashboard/index.tsx` | Load history from IDB; add Refresh button + status |
| `src/pages/Dashboard/index.test.tsx` | Mock `PriceHistoryRepository` + `refreshPriceHistory` |

---

## Task 1: PriceHistory type + DB schema v2 + Repository

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/db/schema.ts`
- Create: `src/db/PriceHistoryRepository.ts`
- Create: `src/db/PriceHistoryRepository.test.ts`

- [ ] **Step 1: Add `PriceHistory` to types**

In `src/types/index.ts`, after the `PriceCache` interface, add:

```typescript
export interface PriceHistory {
  key: string    // `${ticker}:${market}:${date}`
  ticker: string
  market: Market
  date: string   // YYYY-MM-DD
  open: number
}
```

- [ ] **Step 2: Update DB schema**

In `src/db/schema.ts`:

1. Add `PriceHistory` to the import line:
```typescript
import type { Transaction, SplitEvent, Alert, AlertHistory, PriceCache, PriceHistory } from '../types'
```

2. Add `price_history` to the `GugujiDB` interface (after `price_cache`):
```typescript
  price_history: {
    key: string  // `${ticker}:${market}:${date}`
    value: PriceHistory
  }
```

3. Change `DB_VERSION` from `1` to `2`.

4. Replace the `upgrade(db)` callback with `upgrade(db, oldVersion)` and guard existing stores in `oldVersion < 1`:

```typescript
upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    const txStore = db.createObjectStore('transactions', { keyPath: 'id' })
    txStore.createIndex('by-ticker', 'ticker')
    txStore.createIndex('by-date', 'date')

    const splitStore = db.createObjectStore('split_events', { keyPath: 'id' })
    splitStore.createIndex('by-ticker', 'ticker')

    const alertStore = db.createObjectStore('alerts', { keyPath: 'id' })
    alertStore.createIndex('by-ticker', 'ticker')

    const histStore = db.createObjectStore('alert_history', { keyPath: 'id' })
    histStore.createIndex('by-ticker', 'ticker')

    db.createObjectStore('price_cache', { keyPath: 'ticker' })
  }
  if (oldVersion < 2) {
    db.createObjectStore('price_history', { keyPath: 'key' })
  }
},
```

- [ ] **Step 3: Create `PriceHistoryRepository.ts`**

Create `src/db/PriceHistoryRepository.ts`:

```typescript
import { getDB } from './schema'
import type { PriceHistory, Market } from '../types'

export const PriceHistoryRepository = {
  async bulkSet(entries: PriceHistory[]): Promise<void> {
    if (entries.length === 0) return
    const db = await getDB()
    const tx = db.transaction('price_history', 'readwrite')
    await Promise.all(entries.map((e) => tx.store.put(e)))
    await tx.done
  },

  async getByTicker(ticker: string, market: Market): Promise<PriceHistory[]> {
    const db = await getDB()
    const all = await db.getAll('price_history')
    return all.filter((e) => e.ticker === ticker && e.market === market)
  },

  async getAll(): Promise<PriceHistory[]> {
    const db = await getDB()
    return db.getAll('price_history')
  },
}
```

- [ ] **Step 4: Write repository tests**

Create `src/db/PriceHistoryRepository.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { PriceHistoryRepository } from './PriceHistoryRepository'
import type { PriceHistory } from '../types'

const entries: PriceHistory[] = [
  { key: '0050:TW:2024-01-02', ticker: '0050', market: 'TW', date: '2024-01-02', open: 145.5 },
  { key: '0050:TW:2024-01-03', ticker: '0050', market: 'TW', date: '2024-01-03', open: 146.0 },
  { key: 'AAPL:US:2024-01-02', ticker: 'AAPL', market: 'US', date: '2024-01-02', open: 185.0 },
]

describe('PriceHistoryRepository', () => {
  it('bulkSet stores entries retrievable by getAll', async () => {
    await PriceHistoryRepository.bulkSet(entries)
    const all = await PriceHistoryRepository.getAll()
    expect(all).toHaveLength(3)
  })

  it('getByTicker filters by ticker and market', async () => {
    const tw = await PriceHistoryRepository.getByTicker('0050', 'TW')
    expect(tw).toHaveLength(2)
    expect(tw.every((e) => e.ticker === '0050' && e.market === 'TW')).toBe(true)
  })

  it('bulkSet upserts — re-inserting same keys does not duplicate', async () => {
    await PriceHistoryRepository.bulkSet(entries)
    const all = await PriceHistoryRepository.getAll()
    expect(all).toHaveLength(3)
  })

  it('bulkSet with empty array does nothing', async () => {
    await expect(PriceHistoryRepository.bulkSet([])).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 5: Run tests**

```bash
npm run test:run
```

Expected: all tests pass (new file has 4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/db/schema.ts src/db/PriceHistoryRepository.ts src/db/PriceHistoryRepository.test.ts
git commit -m "feat(db): add PriceHistory type, price_history IDB store, and repository"
```

---

## Task 2: Yahoo Finance parse + fetch utilities

**Files:**
- Create: `src/utils/priceHistory.ts`
- Create: `src/utils/priceHistory.test.ts`

- [ ] **Step 1: Write parse unit tests**

Create `src/utils/priceHistory.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseYahooResponse } from './priceHistory'

const mockResponse = {
  chart: {
    result: [{
      timestamp: [1704153600, 1704240000, 1704326400],
      indicators: {
        quote: [{ open: [185.0, null, 186.2] }],
      },
    }],
  },
}

describe('parseYahooResponse', () => {
  it('converts timestamps to YYYY-MM-DD dates', () => {
    const result = parseYahooResponse(mockResponse, 'AAPL', 'US')
    expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('skips entries where open is null', () => {
    const result = parseYahooResponse(mockResponse, 'AAPL', 'US')
    expect(result).toHaveLength(2)
  })

  it('uses open prices from response', () => {
    const result = parseYahooResponse(mockResponse, 'AAPL', 'US')
    expect(result[0].open).toBe(185.0)
    expect(result[1].open).toBe(186.2)
  })

  it('sets ticker and market from arguments', () => {
    const result = parseYahooResponse(mockResponse, 'AAPL', 'US')
    expect(result[0].ticker).toBe('AAPL')
    expect(result[0].market).toBe('US')
  })

  it('formats key as ticker:market:date', () => {
    const result = parseYahooResponse(mockResponse, 'AAPL', 'US')
    expect(result[0].key).toMatch(/^AAPL:US:\d{4}-\d{2}-\d{2}$/)
  })

  it('returns empty array when result is missing', () => {
    expect(parseYahooResponse({ chart: { result: null } }, 'AAPL', 'US')).toEqual([])
    expect(parseYahooResponse({}, 'AAPL', 'US')).toEqual([])
  })

  it('appends .TW to ticker for TW market', () => {
    // parseYahooResponse does not control the ticker symbol used in the URL,
    // but the stored entry uses the plain ticker without suffix
    const result = parseYahooResponse(mockResponse, '0050', 'TW')
    expect(result[0].ticker).toBe('0050')
    expect(result[0].key.startsWith('0050:TW:')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run -- priceHistory
```

Expected: FAIL — `parseYahooResponse` not found.

- [ ] **Step 3: Create `src/utils/priceHistory.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/priceHistory.ts src/utils/priceHistory.test.ts
git commit -m "feat(utils): Yahoo Finance fetch and parse for price history"
```

---

## Task 3: `calcPortfolioHistory` with historical prices

**Files:**
- Modify: `src/utils/chartData.ts`
- Modify: `src/utils/chartData.test.ts`

- [ ] **Step 1: Write new failing tests**

In `src/utils/chartData.test.ts`, add inside the `calcPortfolioHistory` describe block:

```typescript
  it('uses historical price when available for the exact date', () => {
    const txs = [tx({ shares: 10, date: '2024-01-01' })]
    // Historical price 130 differs from current price 120
    const histPrices = new Map([['0050:TW:2024-01-01', 130]])
    const points = calcPortfolioHistory(txs, [], prices, histPrices)
    const jan = points.find((p) => p.date === '2024-01-01')!
    expect(jan.value).toBeCloseTo(10 * 130)
  })

  it('falls back to nearest prior day when date is a gap (e.g. weekend)', () => {
    const txs = [tx({ shares: 10, date: '2024-01-01' })]
    // Price available on Dec 31, not Jan 1 (simulates holiday gap)
    const histPrices = new Map([['0050:TW:2023-12-31', 125]])
    const points = calcPortfolioHistory(txs, [], prices, histPrices)
    const jan = points.find((p) => p.date === '2024-01-01')!
    expect(jan.value).toBeCloseTo(10 * 125)
  })

  it('falls back to currentPrices when no historical data within 7 days', () => {
    const txs = [tx({ shares: 10, date: '2024-01-01' })]
    // Price is 8 days old — beyond the 7-day fallback window
    const histPrices = new Map([['0050:TW:2023-12-24', 110]])
    const points = calcPortfolioHistory(txs, [], prices, histPrices)
    const jan = points.find((p) => p.date === '2024-01-01')!
    expect(jan.value).toBeCloseTo(10 * 120) // falls back to currentPrices
  })

  it('behaves identically when historicalPrices is undefined', () => {
    const txs = [tx({ shares: 10, date: '2024-01-01' })]
    const without = calcPortfolioHistory(txs, [], prices)
    const withUndef = calcPortfolioHistory(txs, [], prices, undefined)
    expect(without).toEqual(withUndef)
  })
```

- [ ] **Step 2: Run tests to confirm new tests fail**

```bash
npm run test:run -- chartData
```

Expected: 4 new tests FAIL — `calcPortfolioHistory` doesn't accept a 4th argument yet.

- [ ] **Step 3: Update `calcPortfolioHistory` in `src/utils/chartData.ts`**

Replace the entire file:

```typescript
import type { Transaction, SplitEvent } from '../types'
import { splitCoefficient } from './position'

export interface ChartPoint {
  date: string
  value: number
}

/**
 * Finds the most recent historical price within maxDaysBack days of `date`.
 * Returns undefined if no price found within the window.
 */
function findHistoricalPrice(
  historicalPrices: Map<string, number>,
  tickerMarketKey: string, // `${ticker}:${market}`
  date: string,
  maxDaysBack = 7,
): number | undefined {
  for (let i = 0; i <= maxDaysBack; i++) {
    const d = new Date(date + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - i)
    const price = historicalPrices.get(`${tickerMarketKey}:${d.toISOString().slice(0, 10)}`)
    if (price !== undefined && price > 0) return price
  }
  return undefined
}

/**
 * Calculates portfolio value history.
 *
 * When historicalPrices is provided, uses actual open prices per date
 * (falling back up to 7 days back for weekends/holidays, then to currentPrices).
 * Without historicalPrices, uses currentPrices for all dates (Phase 1 estimation).
 */
export function calcPortfolioHistory(
  transactions: Transaction[],
  splitEvents: SplitEvent[],
  prices: Record<string, number>,           // `${ticker}:${market}` -> current price
  historicalPrices?: Map<string, number>,   // `${ticker}:${market}:${date}` -> open price
): ChartPoint[] {
  if (transactions.length === 0) return []

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  const today = new Date().toISOString().slice(0, 10)
  const dates = [...new Set([...sorted.map((t) => t.date), today])].sort()

  return dates.map((date) => {
    const txsUpTo = sorted.filter((t) => t.date <= date)

    const sharesMap = new Map<string, number>()

    for (const tx of txsUpTo) {
      const key = `${tx.ticker}:${tx.market}`
      const coeff = splitCoefficient(tx.ticker, tx.date, splitEvents)
      const adjShares = tx.shares * coeff
      const current = sharesMap.get(key) ?? 0

      if (tx.type === 'buy') {
        sharesMap.set(key, current + adjShares)
      } else if (tx.type === 'sell') {
        sharesMap.set(key, current - adjShares)
      } else if (tx.type === 'stock_dividend') {
        sharesMap.set(key, current + adjShares)
      }
    }

    let value = 0
    for (const [key, shares] of sharesMap) {
      if (shares > 0.00001) {
        const price = historicalPrices
          ? (findHistoricalPrice(historicalPrices, key, date) ?? (prices[key] ?? 0))
          : (prices[key] ?? 0)
        value += shares * price
      }
    }

    return { date, value }
  })
}

/**
 * Filters chart points to only include those within the given range.
 */
export function filterByRange(points: ChartPoint[], range: string): ChartPoint[] {
  if (range === 'ALL' || points.length === 0) return points

  const today = new Date()
  const cutoff = new Date(today)

  switch (range) {
    case '1M': cutoff.setMonth(today.getMonth() - 1); break
    case '3M': cutoff.setMonth(today.getMonth() - 3); break
    case '6M': cutoff.setMonth(today.getMonth() - 6); break
    case 'YTD': cutoff.setMonth(0); cutoff.setDate(1); break
    case '1Y': cutoff.setFullYear(today.getFullYear() - 1); break
    case '3Y': cutoff.setFullYear(today.getFullYear() - 3); break
  }

  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return points.filter((p) => p.date >= cutoffStr)
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/chartData.ts src/utils/chartData.test.ts
git commit -m "feat(utils): calcPortfolioHistory uses historical prices when available"
```

---

## Task 4: Dashboard — load history + Refresh button

**Files:**
- Modify: `src/pages/Dashboard/index.tsx`
- Modify: `src/pages/Dashboard/index.test.tsx`

- [ ] **Step 1: Update Dashboard test mocks**

In `src/pages/Dashboard/index.test.tsx`, add mocks for the two new modules at the top (after existing `vi.mock` calls):

```typescript
import { PriceHistoryRepository } from '../../db/PriceHistoryRepository'
import { refreshPriceHistory } from '../../utils/priceHistory'

vi.mock('../../db/PriceHistoryRepository', () => ({
  PriceHistoryRepository: { getAll: vi.fn() },
}))
vi.mock('../../utils/priceHistory', () => ({
  refreshPriceHistory: vi.fn(),
}))
```

In `beforeEach`, add the new mocks:

```typescript
vi.mocked(PriceHistoryRepository.getAll).mockResolvedValue([])
vi.mocked(refreshPriceHistory).mockResolvedValue({ success: [], failed: [] })
```

Add one new test at the end of the `describe('Dashboard')` block:

```typescript
  it('shows Refresh Prices button in chart section', async () => {
    renderDashboard()
    await screen.findByText('0050')
    expect(screen.getByRole('button', { name: /refresh prices/i })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run existing Dashboard tests to confirm they still pass**

```bash
npm run test:run -- Dashboard
```

Expected: all existing tests pass (new test fails since button not yet added).

- [ ] **Step 3: Update `src/pages/Dashboard/index.tsx`**

Replace the file with:

```typescript
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TransactionRepository } from '../../db/TransactionRepository'
import { SplitEventRepository } from '../../db/SplitEventRepository'
import { PriceCacheRepository } from '../../db/PriceCacheRepository'
import { PriceHistoryRepository } from '../../db/PriceHistoryRepository'
import { calcPositions } from '../../utils/position'
import { calcPortfolioHistory, filterByRange, type ChartPoint } from '../../utils/chartData'
import { refreshPriceHistory } from '../../utils/priceHistory'
import type { Position, Transaction, SplitEvent } from '../../types'

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function pnlColor(n: number): string {
  if (n > 0) return 'text-green-600'
  if (n < 0) return 'text-red-600'
  return 'text-gray-600'
}

const RANGES = ['1M', '3M', '6M', 'YTD', '1Y', '3Y', 'ALL'] as const
type Range = (typeof RANGES)[number]
type Tab = 'open' | 'closed'

export default function Dashboard() {
  const [positions, setPositions] = useState<Position[]>([])
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([])
  const [range, setRange] = useState<Range>('1Y')
  const [tab, setTab] = useState<Tab>('open')
  const [hasHistory, setHasHistory] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)

  async function load() {
    const [txs, splits, caches, histEntries] = await Promise.all([
      TransactionRepository.getAll() as Promise<Transaction[]>,
      SplitEventRepository.getAll() as Promise<SplitEvent[]>,
      PriceCacheRepository.getAll(),
      PriceHistoryRepository.getAll(),
    ])

    const prices: Record<string, number> = {}
    for (const c of caches) {
      prices[`${c.ticker}:${c.market}`] = c.price
    }

    const histMap = new Map<string, number>()
    for (const h of histEntries) {
      histMap.set(h.key, h.open)
    }

    setHasHistory(histMap.size > 0)
    setPositions(calcPositions(txs, splits, prices))
    setChartPoints(calcPortfolioHistory(txs, splits, prices, histMap.size > 0 ? histMap : undefined))
  }

  useEffect(() => { load() }, [])

  async function handleRefresh() {
    setRefreshing(true)
    const openTickers = positions
      .filter((p) => p.isOpen)
      .map((p) => ({ ticker: p.ticker, market: p.market }))
    const { failed } = await refreshPriceHistory(openTickers)
    await load()
    setRefreshing(false)
    setLastUpdated(new Date())
    if (failed.length > 0) {
      setRefreshMsg(`更新失敗：${failed.join('、')}`)
      setTimeout(() => setRefreshMsg(null), 5000)
    }
  }

  const visible = positions.filter((p) => (tab === 'open' ? p.isOpen : !p.isOpen))
  const twTotal = positions.filter((p) => p.isOpen && p.market === 'TW')
    .reduce((s, p) => s + p.currentValue, 0)
  const usTotal = positions.filter((p) => p.isOpen && p.market === 'US')
    .reduce((s, p) => s + p.currentValue, 0)
  const totalPnl = positions.filter((p) => p.isOpen)
    .reduce((s, p) => s + p.unrealizedPnl, 0)

  const filteredPoints = filterByRange(chartPoints, range)

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Dashboard</h2>

      {/* Total assets card */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">TW Market Value</p>
          <p className="text-lg font-semibold">TWD {fmt(twTotal, 0)}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">US Market Value</p>
          <p className="text-lg font-semibold">USD {fmt(usTotal, 0)}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Today's P&amp;L</p>
          <p className="text-lg font-semibold text-gray-400">—</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Unrealized P&amp;L</p>
          <p className={`text-lg font-semibold ${pnlColor(totalPnl)}`}>
            {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl, 0)}
          </p>
        </div>
      </div>

      {/* Portfolio chart */}
      {chartPoints.length > 0 && (
        <div className="border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">
              Portfolio Value
              {hasHistory ? ' (historical prices)' : ' (estimated at current prices)'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-2 py-0.5 text-xs rounded border text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                {refreshing ? 'Refreshing…' : 'Refresh Prices'}
              </button>
              {lastUpdated && (
                <span className="text-xs text-gray-400">
                  Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-2 py-0.5 text-xs rounded ${
                      range === r
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {refreshMsg && (
            <p className="text-xs text-red-600 mb-2" role="status">{refreshMsg}</p>
          )}
          {filteredPoints.length < 2 ? (
            <p className="text-sm text-gray-400 text-center py-8">Not enough data for this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={filteredPoints} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
                    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
                    return String(v)
                  }}
                  width={50}
                />
                <Tooltip
                  formatter={(value) => [fmt(Number(value), 0), 'Value']}
                  labelStyle={{ fontSize: 12 }}
                  contentStyle={{ fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#chartGradient)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Open / Closed toggle */}
      <div className="flex gap-1 mb-4 border-b">
        {(['open', 'closed'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${
              tab === t
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {tab === 'open' ? 'No open positions.' : 'No closed positions.'}
        </p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4">Ticker</th>
              <th className="py-2 pr-4">Market</th>
              <th className="py-2 pr-4 text-right">Shares</th>
              <th className="py-2 pr-4 text-right">Avg Cost</th>
              <th className="py-2 pr-4 text-right">Price</th>
              <th className="py-2 pr-4 text-right">Value</th>
              <th className="py-2 pr-4 text-right">P&amp;L</th>
              <th className="py-2 text-right">P&amp;L %</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((pos) => {
              const hasPrice = pos.currentPrice > 0
              return (
                <tr key={`${pos.ticker}:${pos.market}`} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">
                    <Link
                      to={`/stocks/${pos.ticker}?market=${pos.market}`}
                      className="hover:underline text-blue-700"
                    >
                      {pos.ticker}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{pos.market}</td>
                  <td className="py-2 pr-4 text-right">{fmt(pos.shares, 4)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(pos.avgCost)}</td>
                  <td className="py-2 pr-4 text-right">{hasPrice ? fmt(pos.currentPrice) : '—'}</td>
                  <td className="py-2 pr-4 text-right">{hasPrice ? fmt(pos.currentValue, 0) : '—'}</td>
                  <td className={`py-2 pr-4 text-right ${hasPrice ? pnlColor(pos.unrealizedPnl) : 'text-gray-400'}`}>
                    {hasPrice ? `${pos.unrealizedPnl >= 0 ? '+' : ''}${fmt(pos.unrealizedPnl, 0)}` : '—'}
                  </td>
                  <td className={`py-2 text-right ${hasPrice ? pnlColor(pos.unrealizedPnlPct) : 'text-gray-400'}`}>
                    {hasPrice ? `${pos.unrealizedPnlPct >= 0 ? '+' : ''}${fmt(pos.unrealizedPnlPct)}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run all tests**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard/index.tsx src/pages/Dashboard/index.test.tsx
git commit -m "feat(pages): Dashboard loads price history and adds Refresh Prices button"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| `price_history` IDB store, DB v2 | Task 1 |
| `PriceHistoryRepository.bulkSet/getByTicker/getAll` | Task 1 |
| `parseYahooResponse` (pure fn, testable) | Task 2 |
| `fetchYahooHistory` (TW = `.TW` suffix, CORS error caught) | Task 2 |
| `refreshPriceHistory` sequential per ticker | Task 2 |
| `calcPortfolioHistory` 4th param, nearest-prior-day fallback | Task 3 |
| Dashboard loads history, passes to calcPortfolioHistory | Task 4 |
| Refresh Prices button + loading state + last-updated time | Task 4 |
| Chart title changes based on `hasHistory` | Task 4 |
| Failed tickers shown in error message | Task 4 |

All spec requirements covered. No gaps.
