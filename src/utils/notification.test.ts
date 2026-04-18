import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestNotificationPermission, showAlertNotification } from './notification'

describe('requestNotificationPermission', () => {
  it("returns 'denied' when Notification is not in window", async () => {
    const original = (window as any).Notification
    delete (window as any).Notification

    const result = await requestNotificationPermission()
    expect(result).toBe('denied')

    ;(window as any).Notification = original
  })

  it("returns existing permission without calling requestPermission when already granted", async () => {
    const mockRequestPermission = vi.fn()
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'granted', requestPermission: mockRequestPermission },
      writable: true,
      configurable: true,
    })

    const result = await requestNotificationPermission()
    expect(result).toBe('granted')
    expect(mockRequestPermission).not.toHaveBeenCalled()
  })

  it("calls requestPermission and returns its result when permission is 'default'", async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue('granted')
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'default', requestPermission: mockRequestPermission },
      writable: true,
      configurable: true,
    })

    const result = await requestNotificationPermission()
    expect(mockRequestPermission).toHaveBeenCalled()
    expect(result).toBe('granted')
  })
})

describe('showAlertNotification', () => {
  let mockShowNotification: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockShowNotification = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ showNotification: mockShowNotification }) },
      writable: true,
      configurable: true,
    })
  })

  it('does nothing when Notification.permission is not granted', async () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'denied' },
      writable: true,
      configurable: true,
    })

    await showAlertNotification('stop_loss', 'TSLA', 'US', 100, 90)
    expect(mockShowNotification).not.toHaveBeenCalled()
  })

  it('uses correct Chinese label for stop_loss: title contains 停損, body contains 低於', async () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'granted' },
      writable: true,
      configurable: true,
    })

    await showAlertNotification('stop_loss', 'TSLA', 'US', 100.5, 95.25)

    expect(mockShowNotification).toHaveBeenCalled()
    const [title, options] = mockShowNotification.mock.calls[0]
    expect(title).toContain('停損')
    expect(options.body).toContain('低於')
  })

  it('uses correct Chinese label for take_profit: title contains 停利, body contains 高於', async () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'granted' },
      writable: true,
      configurable: true,
    })

    await showAlertNotification('take_profit', 'AAPL', 'US', 200.0, 180.0)

    expect(mockShowNotification).toHaveBeenCalled()
    const [title, options] = mockShowNotification.mock.calls[0]
    expect(title).toContain('停利')
    expect(options.body).toContain('高於')
  })

  it('uses NT$ label for TW market', async () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'granted' },
      writable: true,
      configurable: true,
    })

    await showAlertNotification('stop_loss', '2330', 'TW', 500.0, 480.0)

    expect(mockShowNotification).toHaveBeenCalled()
    const [, options] = mockShowNotification.mock.calls[0]
    expect(options.body).toContain('NT$')
  })

  it('uses US$ label for US market', async () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'granted' },
      writable: true,
      configurable: true,
    })

    await showAlertNotification('take_profit', 'MSFT', 'US', 300.0, 280.0)

    expect(mockShowNotification).toHaveBeenCalled()
    const [, options] = mockShowNotification.mock.calls[0]
    expect(options.body).toContain('US$')
  })

  it('formats triggerPrice and thresholdPrice with 2 decimal places', async () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'granted' },
      writable: true,
      configurable: true,
    })

    await showAlertNotification('stop_loss', 'TSLA', 'US', 123.4, 100)

    expect(mockShowNotification).toHaveBeenCalled()
    const [, options] = mockShowNotification.mock.calls[0]
    expect(options.body).toContain('123.40')
    expect(options.body).toContain('100.00')
  })
})
