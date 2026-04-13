import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TransactionList from './index'
import { TransactionRepository } from '../../db/TransactionRepository'
import type { Transaction } from '../../types'

const mockTransactions: Transaction[] = [
  {
    id: '1',
    ticker: '0050',
    market: 'TW',
    type: 'buy',
    date: '2024-03-01',
    price: 150,
    shares: 10,
    fee: 30,
    note: 'first buy',
    createdAt: '2024-03-01T00:00:00Z',
  },
  {
    id: '2',
    ticker: 'AAPL',
    market: 'US',
    type: 'sell',
    date: '2024-01-15',
    price: 180,
    shares: 5,
    fee: 0,
    note: '',
    createdAt: '2024-01-15T00:00:00Z',
  },
]

vi.mock('../../db/TransactionRepository', () => ({
  TransactionRepository: {
    getAll: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

function renderList() {
  return render(
    <MemoryRouter>
      <TransactionList />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(TransactionRepository.getAll).mockResolvedValue(mockTransactions)
})

describe('TransactionList', () => {
  it('renders transactions sorted by date descending', async () => {
    renderList()
    const rows = await screen.findAllByRole('row')
    // header + 2 data rows
    expect(rows).toHaveLength(3)
    // most recent first
    expect(rows[1]).toHaveTextContent('2024-03-01')
    expect(rows[2]).toHaveTextContent('2024-01-15')
  })

  it('shows empty state when no transactions match filter', async () => {
    renderList()
    await screen.findByText('0050')
    fireEvent.change(screen.getByLabelText('Filter by ticker'), { target: { value: 'TSLA' } })
    expect(screen.getByText('No transactions found.')).toBeInTheDocument()
  })

  it('filters by ticker (case-insensitive)', async () => {
    renderList()
    await screen.findByText('0050')
    fireEvent.change(screen.getByLabelText('Filter by ticker'), { target: { value: 'aapl' } })
    expect(screen.queryByText('0050')).not.toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
  })

  it('filters by type', async () => {
    renderList()
    await screen.findByText('0050')
    fireEvent.change(screen.getByLabelText('Filter by type'), { target: { value: 'sell' } })
    expect(screen.queryByText('0050')).not.toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
  })

  it('calls delete and reloads after confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderList()
    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    fireEvent.click(deleteButtons[0])
    await waitFor(() => expect(TransactionRepository.delete).toHaveBeenCalledWith('1'))
    expect(TransactionRepository.getAll).toHaveBeenCalledTimes(2)
  })

  it('does not delete when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderList()
    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    fireEvent.click(deleteButtons[0])
    await waitFor(() => expect(TransactionRepository.delete).not.toHaveBeenCalled())
  })
})
