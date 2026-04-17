import { describe, it, expect } from 'vitest'
import { getLatestPrices, checkAlerts } from './alertCheck'
import type { Alert, PriceHistory } from '../types'

// Helper to make a PriceHistory entry
function ph(ticker: string, market: 'TW' | 'US', date: string, open: number): PriceHistory {
  return { key: `${ticker}:${market}:${date}`, ticker, market: market as any, date, open }
}

// Helper to make an Alert
function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: '1', ticker: '0050', market: 'TW',
    stopLossPrice: null, takeProfitPrice: null,
    repeat: false, isActive: true, createdAt: '',
    ...overrides,
  }
}

describe('getLatestPrices', () => {
  it('returns empty object for empty array', () => {
    expect(getLatestPrices([])).toEqual({})
  })

  it('picks the most recent date when same ticker has multiple entries', () => {
    const entries = [
      ph('0050', 'TW', '2024-01-01', 100),
      ph('0050', 'TW', '2024-01-03', 120),
      ph('0050', 'TW', '2024-01-02', 110),
    ]
    expect(getLatestPrices(entries)).toEqual({ '0050:TW': 120 })
  })

  it('returns latest price for each different ticker', () => {
    const entries = [
      ph('0050', 'TW', '2024-01-01', 100),
      ph('AAPL', 'US', '2024-01-02', 180),
    ]
    expect(getLatestPrices(entries)).toEqual({ '0050:TW': 100, 'AAPL:US': 180 })
  })
})

describe('checkAlerts', () => {
  it('skips inactive alerts', () => {
    const alert = makeAlert({ isActive: false, stopLossPrice: 200 })
    expect(checkAlerts({ '0050:TW': 150 }, [alert])).toHaveLength(0)
  })

  it('skips when no price data for ticker', () => {
    const alert = makeAlert({ stopLossPrice: 200 })
    expect(checkAlerts({}, [alert])).toHaveLength(0)
  })

  it('triggers stop_loss when price <= stopLossPrice', () => {
    const alert = makeAlert({ stopLossPrice: 200 })
    const triggers = checkAlerts({ '0050:TW': 190 }, [alert])
    expect(triggers).toHaveLength(1)
    expect(triggers[0].triggerType).toBe('stop_loss')
    expect(triggers[0].triggerPrice).toBe(190)
  })

  it('does not trigger stop_loss when price > stopLossPrice', () => {
    const alert = makeAlert({ stopLossPrice: 200 })
    expect(checkAlerts({ '0050:TW': 201 }, [alert])).toHaveLength(0)
  })

  it('triggers take_profit when price >= takeProfitPrice', () => {
    const alert = makeAlert({ takeProfitPrice: 300 })
    const triggers = checkAlerts({ '0050:TW': 300 }, [alert])
    expect(triggers).toHaveLength(1)
    expect(triggers[0].triggerType).toBe('take_profit')
  })

  it('triggers stop_loss only (not take_profit) when both set and stopLoss fires', () => {
    const alert = makeAlert({ stopLossPrice: 200, takeProfitPrice: 300 })
    // price <= stopLoss, so stop_loss fires; take_profit is else-if so doesn't fire
    const triggers = checkAlerts({ '0050:TW': 150 }, [alert])
    expect(triggers).toHaveLength(1)
    expect(triggers[0].triggerType).toBe('stop_loss')
  })
})
