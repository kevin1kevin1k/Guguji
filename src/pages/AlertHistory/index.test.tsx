import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AlertHistoryPage from './index'
import { AlertRepository } from '../../db/AlertRepository'
import type { AlertHistory } from '../../types'

vi.mock('../../db/AlertRepository', () => ({
  AlertRepository: { getAllHistory: vi.fn() },
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <AlertHistoryPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AlertHistoryPage', () => {
  it('renders "No alert history." when getAllHistory resolves with []', async () => {
    vi.mocked(AlertRepository.getAllHistory).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('No alert history.')).toBeInTheDocument()
  })

  it('renders rows sorted descending by triggeredAt (latest first)', async () => {
    const entries: AlertHistory[] = [
      {
        id: '1', alertId: 'a1', ticker: 'AAPL',
        triggerType: 'stop_loss', triggerPrice: 150,
        triggeredAt: '2024-01-01T10:00:00Z',
      },
      {
        id: '2', alertId: 'a2', ticker: '0050',
        triggerType: 'take_profit', triggerPrice: 120,
        triggeredAt: '2024-06-15T12:00:00Z',
      },
    ]
    vi.mocked(AlertRepository.getAllHistory).mockResolvedValue(entries)
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('0050')).toBeInTheDocument()
    })

    const rows = screen.getAllByRole('row')
    // rows[0] is the header; rows[1] should be the later date (0050), rows[2] AAPL
    expect(rows[1]).toHaveTextContent('0050')
    expect(rows[2]).toHaveTextContent('AAPL')
  })

  it('renders correct badge text for stop_loss ("停損") and take_profit ("停利")', async () => {
    const entries: AlertHistory[] = [
      {
        id: '1', alertId: 'a1', ticker: 'AAPL',
        triggerType: 'stop_loss', triggerPrice: 150,
        triggeredAt: '2024-01-01T10:00:00Z',
      },
      {
        id: '2', alertId: 'a2', ticker: '0050',
        triggerType: 'take_profit', triggerPrice: 120,
        triggeredAt: '2024-06-15T12:00:00Z',
      },
    ]
    vi.mocked(AlertRepository.getAllHistory).mockResolvedValue(entries)
    renderPage()

    expect(await screen.findByText('停損')).toBeInTheDocument()
    expect(screen.getByText('停利')).toBeInTheDocument()
  })
})
