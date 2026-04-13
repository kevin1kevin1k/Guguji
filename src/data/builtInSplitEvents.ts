import type { SplitEvent } from '../types'

// Common Taiwan stock split events (source: TWSE announcements)
export const BUILT_IN_SPLIT_EVENTS: SplitEvent[] = [
  {
    id: 'builtin-0050-20231101',
    ticker: '0050',
    market: 'TW',
    effectiveDate: '2023-11-01',
    ratioFrom: 1,
    ratioTo: 4,
    source: 'built_in',
    createdAt: '2023-11-01T00:00:00Z',
  },
  {
    id: 'builtin-0056-20231101',
    ticker: '0056',
    market: 'TW',
    effectiveDate: '2023-11-01',
    ratioFrom: 1,
    ratioTo: 4,
    source: 'built_in',
    createdAt: '2023-11-01T00:00:00Z',
  },
  {
    id: 'builtin-00878-20231101',
    ticker: '00878',
    market: 'TW',
    effectiveDate: '2023-11-01',
    ratioFrom: 1,
    ratioTo: 4,
    source: 'built_in',
    createdAt: '2023-11-01T00:00:00Z',
  },
]
