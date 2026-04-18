import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Settings from './index'
import { ExchangeRateRepository } from '../../db/ExchangeRateRepository'
import { SettingsRepository } from '../../db/SettingsRepository'
import { fetchUsdTwd } from '../../utils/exchangeRate'

vi.mock('../../db/ExchangeRateRepository', () => ({
  ExchangeRateRepository: { getUsdTwd: vi.fn(), getEntry: vi.fn(), set: vi.fn() },
}))
vi.mock('../../db/SettingsRepository', () => ({
  SettingsRepository: { get: vi.fn(), set: vi.fn() },
  FINMIND_TOKEN_KEY: 'finmind_token',
}))
vi.mock('../../utils/exchangeRate', () => ({
  fetchUsdTwd: vi.fn(),
}))
vi.mock('../../utils/notification', () => ({
  requestNotificationPermission: vi.fn(),
}))

function renderSettings() {
  return render(<Settings />)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ExchangeRateRepository.getEntry).mockResolvedValue(null)
  vi.mocked(ExchangeRateRepository.set).mockResolvedValue(undefined)
  vi.mocked(SettingsRepository.get).mockResolvedValue(null)
  vi.mocked(SettingsRepository.set).mockResolvedValue(undefined)
})

describe('Settings', () => {
  it('shows stored exchange rate on load', async () => {
    vi.mocked(ExchangeRateRepository.getEntry).mockResolvedValue({
      key: 'USD:TWD',
      from: 'USD',
      to: 'TWD',
      rate: 30,
      updatedAt: new Date().toISOString(),
    })
    renderSettings()
    expect(await screen.findByText('30.0000')).toBeInTheDocument()
  })

  it('shows — when no exchange rate stored', async () => {
    vi.mocked(ExchangeRateRepository.getEntry).mockResolvedValue(null)
    renderSettings()
    expect(await screen.findByText('—')).toBeInTheDocument()
  })

  it('refresh rate button calls fetchUsdTwd and saves result', async () => {
    vi.mocked(fetchUsdTwd).mockResolvedValue(31.5)
    vi.mocked(ExchangeRateRepository.getEntry)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        key: 'USD:TWD',
        from: 'USD',
        to: 'TWD',
        rate: 31.5,
        updatedAt: new Date().toISOString(),
      })
    renderSettings()
    const btn = await screen.findByRole('button', { name: /重新整理/ })
    fireEvent.click(btn)
    await waitFor(() =>
      expect(vi.mocked(ExchangeRateRepository.set)).toHaveBeenCalledWith(31.5)
    )
  })

  it('shows error when fetch fails', async () => {
    vi.mocked(fetchUsdTwd).mockResolvedValue(null)
    renderSettings()
    const btn = await screen.findByRole('button', { name: /重新整理/ })
    fireEvent.click(btn)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('shows 未設定 by default when Notification permission is default', async () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'default' },
      writable: true,
      configurable: true,
    })
    renderSettings()
    expect(await screen.findByText(/未設定/)).toBeInTheDocument()
  })

  it('shows 已啟用 and no 啟用通知 button when permission is granted', async () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'granted' },
      writable: true,
      configurable: true,
    })
    renderSettings()
    expect(await screen.findByText(/已啟用/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /啟用通知/ })).not.toBeInTheDocument()
  })

  it('loads saved token on mount', async () => {
    vi.mocked(SettingsRepository.get).mockResolvedValue('mytoken')
    renderSettings()
    const input = await screen.findByLabelText('API Token') as HTMLInputElement
    expect(input.value).toBe('mytoken')
  })

  it('save token button calls SettingsRepository.set', async () => {
    renderSettings()
    const input = await screen.findByLabelText('API Token')
    fireEvent.change(input, { target: { value: 'newtoken' } })
    const btn = screen.getByRole('button', { name: /儲存 Token/ })
    fireEvent.click(btn)
    await waitFor(() =>
      expect(vi.mocked(SettingsRepository.set)).toHaveBeenCalledWith('finmind_token', 'newtoken')
    )
    expect(await screen.findByText('Token 已儲存。')).toBeInTheDocument()
  })
})
