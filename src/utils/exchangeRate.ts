const ER_API_URL = 'https://open.er-api.com/v6/latest/USD'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseErApiResponse(data: any): number | null {
  const rate = data?.rates?.TWD
  if (typeof rate !== 'number' || rate <= 0) return null
  return rate
}

export async function fetchUsdTwd(): Promise<number | null> {
  try {
    const res = await fetch(ER_API_URL)
    if (!res.ok) return null
    return parseErApiResponse(await res.json())
  } catch {
    return null
  }
}
