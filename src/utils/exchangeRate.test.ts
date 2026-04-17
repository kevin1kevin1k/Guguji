import { describe, it, expect } from 'vitest'
import { parseErApiResponse } from './exchangeRate'

describe('parseErApiResponse', () => {
  it('returns TWD rate when valid', () => {
    expect(parseErApiResponse({ rates: { TWD: 32.5 } })).toBe(32.5)
  })

  it('returns null when data is null', () => {
    expect(parseErApiResponse(null)).toBeNull()
  })

  it('returns null when data.rates is missing', () => {
    expect(parseErApiResponse({})).toBeNull()
    expect(parseErApiResponse({ rates: undefined })).toBeNull()
  })

  it('returns null when TWD is not in rates', () => {
    expect(parseErApiResponse({ rates: { USD: 1.0, EUR: 0.92 } })).toBeNull()
  })

  it('returns null when TWD is 0', () => {
    expect(parseErApiResponse({ rates: { TWD: 0 } })).toBeNull()
  })

  it('returns null when TWD is negative', () => {
    expect(parseErApiResponse({ rates: { TWD: -32.5 } })).toBeNull()
  })

  it('returns null when TWD is not a number', () => {
    expect(parseErApiResponse({ rates: { TWD: '32.5' } })).toBeNull()
    expect(parseErApiResponse({ rates: { TWD: true } })).toBeNull()
    expect(parseErApiResponse({ rates: { TWD: null } })).toBeNull()
  })
})
