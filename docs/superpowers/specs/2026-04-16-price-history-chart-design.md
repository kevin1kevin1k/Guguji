# Design: 走勢圖歷史數據精確化（Issue #10）

**Date:** 2026-04-16  
**Status:** Approved

---

## Overview

目前走勢圖使用 Phase 1 估算法（現價 × 歷史持股數），本功能改為串接 Yahoo Finance 非官方 API 拉取真實歷史開盤價，存入 IndexedDB，讓走勢圖數據更精確。

台股與美股統一使用 Yahoo Finance（台股代號加 `.TW`），不依賴 FinMind token。

---

## Decisions

| 問題 | 決議 |
|------|------|
| API 來源 | Yahoo Finance 非官方 API（台股 + 美股） |
| CORS 策略 | 直接呼叫，失敗時 catch 並 fallback，不使用 proxy |
| 觸發方式 | 手動 Refresh 按鈕（Dashboard） |
| 儲存方式 | 新增 `price_history` IDB store，按日期逐筆存 |

---

## 1. Data Layer

### 1.1 新 IDB Store：`price_history`

- **DB version：** 1 → 2（需 schema migration）
- **Key：** `${ticker}:${market}:${date}`（compound string key）
- **Value：**

```typescript
interface PriceHistory {
  ticker: string
  market: Market       // 'TW' | 'US'
  date: string         // YYYY-MM-DD
  open: number         // 開盤價（原幣）
}
```

### 1.2 新 Repository：`PriceHistoryRepository`

`src/db/PriceHistoryRepository.ts`

```typescript
PriceHistoryRepository.bulkSet(entries: PriceHistory[]): Promise<void>
PriceHistoryRepository.getByTicker(ticker: string, market: Market): Promise<PriceHistory[]>
PriceHistoryRepository.getAll(): Promise<PriceHistory[]>
```

- `bulkSet` 使用 IDB transaction 批次 `put`（upsert）

---

## 2. Fetch Layer

### 2.1 Yahoo Finance API

`src/utils/priceHistory.ts`

**台股：**
```
GET https://query1.finance.yahoo.com/v8/finance/chart/0050.TW?interval=1d&range=5y
```

**美股：**
```
GET https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=5y
```

Response 解析：
- `chart.result[0].timestamp[]`：Unix timestamp 陣列，轉為 `YYYY-MM-DD`
- `chart.result[0].indicators.quote[0].open[]`：開盤價陣列，與 timestamp 一一對應
- 跳過 `open` 為 `null` 的項目（假日等非交易日）

**函式簽名：**

```typescript
// 拉取單支股票的歷史，失敗回傳空陣列（不拋錯）
fetchYahooHistory(ticker: string, market: Market): Promise<PriceHistory[]>

// 批次刷新多支股票，回傳成功/失敗清單
refreshPriceHistory(
  tickers: { ticker: string; market: Market }[]
): Promise<{ success: string[]; failed: string[] }>
```

- `refreshPriceHistory` 依序（非並行）呼叫 `fetchYahooHistory`，避免 API rate limit
- 成功拿到資料後呼叫 `PriceHistoryRepository.bulkSet`

---

## 3. Chart Calculation

### 3.1 修改 `calcPortfolioHistory`

`src/utils/chartData.ts`

新增選用第四個參數：

```typescript
calcPortfolioHistory(
  transactions: Transaction[],
  splitEvents: SplitEvent[],
  currentPrices: Record<string, number>,
  historicalPrices?: Map<string, number>, // key: `${ticker}:${market}:${date}`
): ChartPoint[]
```

計算每個 date 的股票價格邏輯（優先順序）：

1. `historicalPrices.get(`${ticker}:${market}:${date}`)` — 精確歷史價
2. 往前找最近一筆有資料的日期（處理假日、空缺） — 最多往前找 7 天
3. `currentPrices[`${ticker}:${market}`]` — fallback 現價

不傳 `historicalPrices` 時行為與現在完全相同（向下相容）。

---

## 4. UI Changes

### 4.1 Dashboard

`src/pages/Dashboard/index.tsx`

**載入：**
- `useEffect` 中同時載入 `PriceHistoryRepository.getAll()`
- 轉成 `Map<string, number>` 傳給 `calcPortfolioHistory`

**Refresh 按鈕：**
- 位置：走勢圖區塊右上角（時間範圍按鈕旁）
- 狀態：idle / loading / done（顯示「上次更新 HH:MM」）
- 點擊流程：
  1. 收集所有持倉中 ticker（`positions.filter(p => p.isOpen)`）
  2. 呼叫 `refreshPriceHistory`
  3. 重新載入 `price_history` 並重算 chart
  4. 顯示成功/失敗摘要（小提示，5 秒後消失）

**CORS 失敗處理：**
- fetch 錯誤只記錄到 `failed[]`，不中斷整體流程
- 圖表繼續使用現有快取資料（可能仍是 Phase 1 估算）

---

## 5. Files Changed

| 檔案 | 變更 |
|------|------|
| `src/db/schema.ts` | DB version 1→2，新增 `price_history` store |
| `src/db/PriceHistoryRepository.ts` | 新建 |
| `src/utils/priceHistory.ts` | 新建（fetch + refresh 邏輯） |
| `src/utils/priceHistory.test.ts` | 新建（解析邏輯 unit test） |
| `src/utils/chartData.ts` | `calcPortfolioHistory` 加第四參數 |
| `src/utils/chartData.test.ts` | 補 historicalPrices 相關測試 |
| `src/pages/Dashboard/index.tsx` | 載入 history、Refresh 按鈕 |

---

## 6. Out of Scope

- StockDetail 個股走勢圖（架構相容，後續直接可用）
- 自動更新（App 啟動時）
- CORS proxy
- FinMind 台股 API
