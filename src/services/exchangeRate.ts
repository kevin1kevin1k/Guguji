/** USD/TWD 匯率 — ExchangeRate API */
const ENDPOINT = 'https://open.er-api.com/v6/latest/USD'

export interface ExchangeRateResult {
  twd: number
  updatedAt: string
}

export async function fetchUSDToTWD(): Promise<ExchangeRateResult> {
  const res = await fetch(ENDPOINT)
  if (!res.ok) throw new Error(`ExchangeRate API error: ${res.status}`)
  const json = await res.json()
  return {
    twd: json.rates.TWD as number,
    updatedAt: json.time_last_update_utc as string,
  }
}
