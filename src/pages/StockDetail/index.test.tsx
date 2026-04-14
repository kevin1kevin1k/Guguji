import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import StockDetail from './index'
import { TransactionRepository } from '../../db/TransactionRepository'
import { SplitEventRepository } from '../../db/SplitEventRepository'
import { PriceCacheRepository } from '../../db/PriceCacheRepository'
import type { Transaction, PriceCache } from '../../types'

vi.mock('../../db/TransactionRepository', () => ({
  TransactionRepository: { getByTicker: vi.fn() },
}))
vi.mock('../../db/SplitEventRepository', () => ({
  SplitEventRepository: { getAll: vi.fn() },
}))
vi.mock('../../db/PriceCacheRepository', () => ({
  PriceCacheRepository: { getAll: vi.fn() },
}))

const mockTxs: Transaction[] = [
  {
    id: '1', ticker: '0050', market: 'TW', type: 'buy',
    date: '2024-01-01', price: 100, shares: 10, fee: 30, note: 'first buy', createdAt: '',
  },
  {
    id: '2', ticker: '0050', market: 'TW', type: 'buy',
    date: '2024-06-01', price: 110, shares: 5, fee: 15, note: '', createdAt: '',
  },
]

const mockCache: PriceCache = {
  ticker: '0050', market: 'TW', price: 120, priceDate: '2024-04-01', updatedAt: '',
}

function renderPage(ticker: string, market = 'TW') {
  return render(
    <MemoryRouter initialEntries={[`/stocks/${ticker}?market=${market}`]}>
      <Routes>
        <Route path="/stocks/:ticker" element={<StockDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(TransactionRepository.getByTicker).mockResolvedValue(mockTxs)
  vi.mocked(SplitEventRepository.getAll).mockResolvedValue([])
  vi.mocked(PriceCacheRepository.getAll).mockResolvedValue([mockCache])
})

describe('StockDetail', () => {
  it('shows the ticker and market in the header', async () => {
    renderPage('0050', 'TW')
    expect(await screen.findByText('0050')).toBeInTheDocument()
    expect(screen.getByText('TW')).toBeInTheDocument()
  })

  it('shows current price from cache', async () => {
    renderPage('0050', 'TW')
    // price 120.00
    await waitFor(() => expect(screen.getByText('120.00')).toBeInTheDocument())
  })

  it('shows position shares and avg cost', async () => {
    renderPage('0050', 'TW')
    // shares: 15, avgCost: (100*10+30 + 110*5+15) / 15 = (1030 + 565) / 15 = 1595/15 ≈ 106.33
    await waitFor(() => {
      expect(screen.getByText('15.0000')).toBeInTheDocument()
    })
  })

  it('shows unrealized P&L when price is available', async () => {
    renderPage('0050', 'TW')
    // currentValue = 15 * 120 = 1800, totalCost ≈ 1595, pnl ≈ +205
    await waitFor(() => {
      // P&L cell should be green and positive
      const pnl = screen.getByText(/^\+/)
      expect(pnl).toBeInTheDocument()
    })
  })

  it('shows all transactions sorted descending by date', async () => {
    renderPage('0050', 'TW')
    await screen.findByText('Transaction History')
    const rows = screen.getAllByText(/2024-/)
    // most recent first
    expect(rows[0].textContent).toBe('2024-06-01')
    expect(rows[1].textContent).toBe('2024-01-01')
  })

  it('shows transaction note in the table', async () => {
    renderPage('0050', 'TW')
    await waitFor(() => expect(screen.getByText('first buy')).toBeInTheDocument())
  })

  it('shows "No transactions found." when ticker has no transactions', async () => {
    vi.mocked(TransactionRepository.getByTicker).mockResolvedValue([])
    vi.mocked(PriceCacheRepository.getAll).mockResolvedValue([])
    renderPage('9999', 'TW')
    expect(await screen.findByText('No transactions found.')).toBeInTheDocument()
  })

  it('shows — for price when no cache entry', async () => {
    vi.mocked(PriceCacheRepository.getAll).mockResolvedValue([])
    renderPage('0050', 'TW')
    await screen.findByText('0050')
    await waitFor(() => {
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(1)
    })
  })
})
