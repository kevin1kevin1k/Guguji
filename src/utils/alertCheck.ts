import type { Alert, PriceHistory } from '../types'

export interface AlertTrigger {
  alert: Alert
  triggerType: 'stop_loss' | 'take_profit'
  triggerPrice: number
}

/** Extract the most recent open price per ticker:market from PriceHistory entries */
export function getLatestPrices(entries: PriceHistory[]): Record<string, number> {
  const map: Record<string, { date: string; open: number }> = {}
  for (const e of entries) {
    const key = `${e.ticker}:${e.market}`
    if (!map[key] || e.date > map[key].date) {
      map[key] = { date: e.date, open: e.open }
    }
  }
  const result: Record<string, number> = {}
  for (const [key, val] of Object.entries(map)) {
    result[key] = val.open
  }
  return result
}

/** Check active alerts against latest prices, return list of triggers */
export function checkAlerts(
  latestPrices: Record<string, number>,
  alerts: Alert[],
): AlertTrigger[] {
  const triggers: AlertTrigger[] = []
  for (const alert of alerts) {
    if (!alert.isActive) continue
    const price = latestPrices[`${alert.ticker}:${alert.market}`]
    if (price === undefined) continue
    if (alert.stopLossPrice !== null && price <= alert.stopLossPrice) {
      triggers.push({ alert, triggerType: 'stop_loss', triggerPrice: price })
    } else if (alert.takeProfitPrice !== null && price >= alert.takeProfitPrice) {
      triggers.push({ alert, triggerType: 'take_profit', triggerPrice: price })
    }
  }
  return triggers
}
