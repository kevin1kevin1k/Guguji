import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AddTransaction from './index'
import { TransactionRepository } from '../../db/TransactionRepository'

vi.mock('../../db/TransactionRepository', () => ({
  TransactionRepository: {
    add: vi.fn().mockResolvedValue('new-id'),
    update: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
  },
}))

function renderForm(path = '/transactions/new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/transactions/new" element={<AddTransaction />} />
        <Route path="/transactions/:id/edit" element={<AddTransaction />} />
        <Route path="/transactions" element={<div>Transaction List</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('AddTransaction', () => {
  it('renders required fields', () => {
    renderForm()
    expect(screen.getByPlaceholderText(/0050 or AAPL/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/price/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/shares/i)).toBeInTheDocument()
  })

  it('shows all type tabs', () => {
    renderForm()
    expect(screen.getByRole('button', { name: 'Buy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sell' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dividend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stock Dividend' })).toBeInTheDocument()
  })

  it('auto-detects TW market for numeric ticker', () => {
    renderForm()
    fireEvent.change(screen.getByPlaceholderText(/0050 or AAPL/i), { target: { value: '0050' } })
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('TW')
  })

  it('auto-detects US market for alphabetic ticker', () => {
    renderForm()
    fireEvent.change(screen.getByPlaceholderText(/0050 or AAPL/i), { target: { value: 'AAPL' } })
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('US')
  })

  it('shows validation error when ticker is empty', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText(/shares/i), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.getByText(/ticker is required/i)).toBeInTheDocument())
  })

  it('calls TransactionRepository.add on valid submit', async () => {
    renderForm()
    fireEvent.change(screen.getByPlaceholderText(/0050 or AAPL/i), { target: { value: '0050' } })
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '150' } })
    fireEvent.change(screen.getByLabelText(/shares/i), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(TransactionRepository.add).toHaveBeenCalledOnce())
    const arg = vi.mocked(TransactionRepository.add).mock.calls[0][0]
    expect(arg.ticker).toBe('0050')
    expect(arg.market).toBe('TW')
    expect(arg.price).toBe(150)
    expect(arg.shares).toBe(10)
    expect(arg.type).toBe('buy')
  })

  it('navigates to /transactions after submit', async () => {
    renderForm()
    fireEvent.change(screen.getByPlaceholderText(/0050 or AAPL/i), { target: { value: 'AAPL' } })
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '200' } })
    fireEvent.change(screen.getByLabelText(/shares/i), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(screen.getByText('Transaction List')).toBeInTheDocument())
  })
})
