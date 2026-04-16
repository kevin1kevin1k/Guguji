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
    expect(result[0].date).toBe('2024-01-02')
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

  it('stores plain ticker (without .TW) for TW market entries', () => {
    const result = parseYahooResponse(mockResponse, '0050', 'TW')
    expect(result[0].ticker).toBe('0050')
    expect(result[0].key.startsWith('0050:TW:')).toBe(true)
  })

  it('skips entries when opens array is shorter than timestamps', () => {
    const partial = {
      chart: {
        result: [{
          timestamp: [1704153600, 1704240000, 1704326400],
          indicators: { quote: [{ open: [185.0] }] }, // only 1 open for 3 timestamps
        }],
      },
    }
    const result = parseYahooResponse(partial, 'AAPL', 'US')
    expect(result).toHaveLength(1)
    expect(result[0].open).toBe(185.0)
  })
})
