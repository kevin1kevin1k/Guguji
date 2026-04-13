import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SplitEvents from './index'
import { SplitEventRepository } from '../../db/SplitEventRepository'
import type { SplitEvent } from '../../types'

const mockEvents: SplitEvent[] = [
  {
    id: 'builtin-0050-20231101',
    ticker: '0050',
    market: 'TW',
    effectiveDate: '2023-11-01',
    ratioFrom: 1,
    ratioTo: 4,
    source: 'built_in',
    createdAt: '',
  },
  {
    id: 'user-2330-20240101',
    ticker: '2330',
    market: 'TW',
    effectiveDate: '2024-01-01',
    ratioFrom: 1,
    ratioTo: 2,
    source: 'user',
    createdAt: '',
  },
]

vi.mock('../../db/SplitEventRepository', () => ({
  SplitEventRepository: {
    getAll: vi.fn(),
    add: vi.fn().mockResolvedValue('new-id'),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

function renderPage() {
  return render(<MemoryRouter><SplitEvents /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(SplitEventRepository.getAll).mockResolvedValue(mockEvents)
})

describe('SplitEvents', () => {
  it('renders list of split events', async () => {
    renderPage()
    expect(await screen.findByText('0050')).toBeInTheDocument()
    expect(screen.getByText('2330')).toBeInTheDocument()
  })

  it('shows built-in badge for built-in events', async () => {
    renderPage()
    await screen.findByText('0050')
    expect(screen.getByText('built-in')).toBeInTheDocument()
  })

  it('shows Delete only for user events', async () => {
    renderPage()
    await screen.findByText('2330')
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    expect(deleteButtons).toHaveLength(1)
  })

  it('calls add and reloads on valid form submit', async () => {
    renderPage()
    await screen.findByText('0050')

    fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'AAPL' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(SplitEventRepository.add).toHaveBeenCalledOnce())
    const arg = vi.mocked(SplitEventRepository.add).mock.calls[0][0]
    expect(arg.ticker).toBe('AAPL')
    expect(arg.ratioTo).toBe(3)
    expect(arg.source).toBe('user')
  })

  it('shows error when ticker is empty', async () => {
    renderPage()
    await screen.findByText('0050')
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.getByText('Ticker is required.')).toBeInTheDocument())
  })

  it('calls delete and reloads after confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()
    await screen.findByText('2330')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(SplitEventRepository.delete).toHaveBeenCalledWith('user-2330-20240101'),
    )
  })
})
