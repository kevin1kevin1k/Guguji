import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from './index'
import { TransactionRepository } from '../../db/TransactionRepository'
import { SplitEventRepository } from '../../db/SplitEventRepository'
import { PriceCacheRepository } from '../../db/PriceCacheRepository'
import { PriceHistoryRepository } from '../../db/PriceHistoryRepository'
import { refreshPriceHistory } from '../../utils/priceHistory'
import { ExchangeRateRepository } from '../../db/ExchangeRateRepository'
import type { Transaction, PriceCache } from '../../types'

vi.mock('../../db/TransactionRepository', () => ({
  TransactionRepository: { getAll: vi.fn() },
}))
vi.mock('../../db/SplitEventRepository', () => ({
  SplitEventRepository: { getAll: vi.fn() },
}))
vi.mock('../../db/PriceCacheRepository', () => ({
  PriceCacheRepository: { getAll: vi.fn() },
}))
vi.mock('../../db/PriceHistoryRepository', () => ({
  PriceHistoryRepository: { getAll: vi.fn() },
}))
vi.mock('../../utils/priceHistory', () => ({
  refreshPriceHistory: vi.fn(),
}))
vi.mock('../../db/ExchangeRateRepository', () => ({
  ExchangeRateRepository: { getUsdTwd: vi.fn() },
}))

const mockTxs: Transaction[] = [
  {
    id: '1', ticker: '0050', market: 'TW', type: 'buy',
    date: '2024-01-01', price: 100, shares: 10, fee: 0, note: '', createdAt: '',
  },
  {
    id: '2', ticker: 'AAPL', market: 'US', type: 'buy',
    date: '2024-01-01', price: 150, shares: 5, fee: 0, note: '', createdAt: '',
  },
  {
    id: '3', ticker: '2330', market: 'TW', type: 'buy',
    date: '2023-01-01', price: 500, shares: 10, fee: 0, note: '', createdAt: '',
  },
  {
    id: '4', ticker: '2330', market: 'TW', type: 'sell',
    date: '2023-06-01', price: 600, shares: 10, fee: 0, note: '', createdAt: '',
  },
]

const mockCaches: PriceCache[] = [
  { ticker: '0050', market: 'TW', price: 120, priceDate: '2024-04-01', updatedAt: '' },
  { ticker: 'AAPL', market: 'US', price: 180, priceDate: '2024-04-01', updatedAt: '' },
]

function renderDashboard() {
  return render(<MemoryRouter><Dashboard /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(TransactionRepository.getAll).mockResolvedValue(mockTxs)
  vi.mocked(SplitEventRepository.getAll).mockResolvedValue([])
  vi.mocked(PriceCacheRepository.getAll).mockResolvedValue(mockCaches)
  vi.mocked(PriceHistoryRepository.getAll).mockResolvedValue([])
  vi.mocked(refreshPriceHistory).mockResolvedValue({ success: [], failed: [] })
  vi.mocked(ExchangeRateRepository.getUsdTwd).mockResolvedValue(null)
})

describe('Dashboard', () => {
  it('shows open positions by default', async () => {
    renderDashboard()
    expect(await screen.findByText('0050')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    // 2330 is closed
    expect(screen.queryByText('2330')).not.toBeInTheDocument()
  })

  it('shows closed positions when Closed tab is clicked', async () => {
    renderDashboard()
    await screen.findByText('0050')
    fireEvent.click(screen.getByRole('button', { name: /closed/i }))
    await waitFor(() => expect(screen.getByText('2330')).toBeInTheDocument())
    expect(screen.queryByText('0050')).not.toBeInTheDocument()
  })

  it('shows empty state when no positions', async () => {
    vi.mocked(TransactionRepository.getAll).mockResolvedValue([])
    renderDashboard()
    expect(await screen.findByText('No open positions.')).toBeInTheDocument()
  })

  it('shows — for price when no cache entry', async () => {
    vi.mocked(PriceCacheRepository.getAll).mockResolvedValue([])
    renderDashboard()
    await screen.findByText('0050')
    const dashes = screen.getAllByText('—')
    // Price, Value, P&L, P&L% columns for each position = 4 per position × 2 open positions
    expect(dashes.length).toBeGreaterThanOrEqual(4)
  })

  it('displays correct TW total market value', async () => {
    // 0050: 10 shares × price 120 = 1,200 TWD
    renderDashboard()
    await screen.findByText('0050')
    expect(screen.getByText('TWD 1,200')).toBeInTheDocument()
  })

  it('displays correct US total market value', async () => {
    // AAPL: 5 shares × price 180 = 900 USD
    renderDashboard()
    await screen.findByText('AAPL')
    expect(screen.getByText('USD 900')).toBeInTheDocument()
  })

  it('shows Refresh Prices button in chart section', async () => {
    renderDashboard()
    await screen.findByText('0050')
    expect(screen.getByRole('button', { name: /refresh prices/i })).toBeInTheDocument()
  })

  it('calls refreshPriceHistory when Refresh Prices button is clicked', async () => {
    renderDashboard()
    await screen.findByText('0050')
    const btn = screen.getByRole('button', { name: /refresh prices/i })
    fireEvent.click(btn)
    await waitFor(() => expect(vi.mocked(refreshPriceHistory)).toHaveBeenCalledTimes(1))
  })

  it('shows Total (TWD) card with — when no exchange rate', async () => {
    vi.mocked(ExchangeRateRepository.getUsdTwd).mockResolvedValue(null)
    renderDashboard()
    await screen.findByText('0050')
    expect(screen.getByText('Total (TWD)')).toBeInTheDocument()
  })

  it('shows computed Total (TWD) when exchange rate is set', async () => {
    // twTotal = 0050: 10 × 120 = 1,200 TWD
    // usTotal = AAPL: 5 × 180 = 900 USD
    // totalTwd = 1200 + 900 × 30 = 28,200
    vi.mocked(ExchangeRateRepository.getUsdTwd).mockResolvedValue(30)
    renderDashboard()
    await screen.findByText('0050')
    await waitFor(() => expect(screen.getByText('TWD 28,200')).toBeInTheDocument())
  })
})
