export type Market = 'TW' | 'US'

export type TransactionType = 'buy' | 'sell' | 'dividend' | 'stock_dividend'

export interface Transaction {
  id: string
  ticker: string
  market: Market
  type: TransactionType
  date: string // YYYY-MM-DD
  price: number
  shares: number
  fee: number
  note: string
  createdAt: string
}

export interface SplitEvent {
  id: string
  ticker: string
  market: Market
  effectiveDate: string // YYYY-MM-DD
  ratioFrom: number
  ratioTo: number
  source: 'built_in' | 'user'
  createdAt: string
}

export interface Alert {
  id: string
  ticker: string
  market: Market
  stopLossPrice: number | null
  takeProfitPrice: number | null
  repeat: boolean
  isActive: boolean
  createdAt: string
}

export interface AlertHistory {
  id: string
  alertId: string
  ticker: string
  triggerType: 'stop_loss' | 'take_profit'
  triggerPrice: number
  triggeredAt: string
}

export interface PriceCache {
  ticker: string
  market: Market
  price: number
  priceDate: string // YYYY-MM-DD
  updatedAt: string
}

export interface PriceHistory {
  key: string    // `${ticker}:${market}:${date}`
  ticker: string
  market: Market
  date: string   // YYYY-MM-DD
  open: number
}

/** 持倉計算結果 */
export interface Position {
  ticker: string
  market: Market
  shares: number          // 拆分調整後
  avgCost: number         // 拆分調整後（原幣）
  currentPrice: number
  currentValue: number
  unrealizedPnl: number
  unrealizedPnlPct: number
  isOpen: boolean
}
