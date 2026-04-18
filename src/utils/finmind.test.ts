import { describe, it, expect } from 'vitest'
import { parseFinmindResponse } from './finmind'

describe('parseFinmindResponse', () => {
  it('returns empty array for missing data field', () => {
    expect(parseFinmindResponse({}, '0050')).toEqual([])
    expect(parseFinmindResponse({ data: null }, '0050')).toEqual([])
  })

  it('maps rows to PriceHistory with correct fields', () => {
    const data = { data: [{ date: '2024-01-02', stock_id: '0050', open: 134.55 }] }
    const result = parseFinmindResponse(data, '0050')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      key: '0050:TW:2024-01-02',
      ticker: '0050',
      market: 'TW',
      date: '2024-01-02',
      open: 134.55,
    })
  })

  it('filters out rows with open = 0', () => {
    const data = { data: [{ date: '2024-01-02', open: 0 }] }
    expect(parseFinmindResponse(data, '0050')).toEqual([])
  })

  it('filters out rows with open < 0', () => {
    const data = { data: [{ date: '2024-01-02', open: -1 }] }
    expect(parseFinmindResponse(data, '0050')).toEqual([])
  })

  it('key format is ticker:TW:date', () => {
    const data = { data: [{ date: '2024-03-15', open: 100 }] }
    const result = parseFinmindResponse(data, '2330')
    expect(result[0].key).toBe('2330:TW:2024-03-15')
  })
})
