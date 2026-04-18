import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Alerts from './index'
import { AlertRepository } from '../../db/AlertRepository'
import type { Alert } from '../../types'

vi.mock('../../db/AlertRepository', () => ({
  AlertRepository: {
    getAll: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockAlert: Alert = {
  id: 'a1', ticker: 'AAPL', market: 'US',
  stopLossPrice: 150, takeProfitPrice: 200,
  repeat: false, isActive: true, createdAt: '',
}

function renderAlerts() {
  return render(<MemoryRouter><Alerts /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(AlertRepository.getAll).mockResolvedValue([])
  vi.mocked(AlertRepository.upsert).mockResolvedValue(undefined)
  vi.mocked(AlertRepository.delete).mockResolvedValue(undefined)
})

describe('Alerts', () => {
  it('shows "No alerts set." when AlertRepository.getAll resolves with []', async () => {
    renderAlerts()
    expect(await screen.findByText('No alerts set.')).toBeInTheDocument()
  })

  it('renders existing alerts in the list (ticker, market, stop-loss, take-profit shown)', async () => {
    vi.mocked(AlertRepository.getAll).mockResolvedValue([mockAlert])
    renderAlerts()
    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(screen.getAllByText('US').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('150.00')).toBeInTheDocument()
    expect(screen.getByText('200.00')).toBeInTheDocument()
  })

  it('add form: submitting with valid data calls AlertRepository.upsert with correct shape', async () => {
    renderAlerts()
    await screen.findByText('No alerts set.')

    fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'TSLA' } })
    fireEvent.change(screen.getByLabelText(/stop-loss/i), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: /add alert/i }))

    await waitFor(() => expect(vi.mocked(AlertRepository.upsert)).toHaveBeenCalledTimes(1))
    const arg = vi.mocked(AlertRepository.upsert).mock.calls[0][0]
    expect(arg.ticker).toBe('TSLA')
    expect(arg.market).toBe('US')
    expect(arg.stopLossPrice).toBe(100)
    expect(arg.takeProfitPrice).toBeNull()
    expect(arg.isActive).toBe(true)
    expect(typeof arg.id).toBe('string')
  })

  it('add form: shows error when ticker is missing', async () => {
    renderAlerts()
    await screen.findByText('No alerts set.')

    fireEvent.change(screen.getByLabelText(/stop-loss/i), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: /add alert/i }))

    expect(await screen.findByText('Ticker is required.')).toBeInTheDocument()
    expect(vi.mocked(AlertRepository.upsert)).not.toHaveBeenCalled()
  })

  it('add form: shows error when both stop-loss and take-profit are empty', async () => {
    renderAlerts()
    await screen.findByText('No alerts set.')

    fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'AAPL' } })
    fireEvent.click(screen.getByRole('button', { name: /add alert/i }))

    expect(await screen.findByText('Set at least one price.')).toBeInTheDocument()
    expect(vi.mocked(AlertRepository.upsert)).not.toHaveBeenCalled()
  })

  it('toggle active: clicking the active toggle button calls AlertRepository.upsert with isActive flipped', async () => {
    vi.mocked(AlertRepository.getAll).mockResolvedValue([mockAlert])
    renderAlerts()
    await screen.findByText('AAPL')

    fireEvent.click(screen.getByRole('button', { name: /on/i }))

    await waitFor(() => expect(vi.mocked(AlertRepository.upsert)).toHaveBeenCalledTimes(1))
    expect(vi.mocked(AlertRepository.upsert)).toHaveBeenCalledWith({ ...mockAlert, isActive: false })
  })

  it('delete: clicking delete and confirming calls AlertRepository.delete with correct id', async () => {
    vi.mocked(AlertRepository.getAll).mockResolvedValue([mockAlert])
    window.confirm = vi.fn().mockReturnValue(true)
    renderAlerts()
    await screen.findByText('AAPL')

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => expect(vi.mocked(AlertRepository.delete)).toHaveBeenCalledWith('a1'))
  })
})
