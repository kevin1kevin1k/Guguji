export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export async function showAlertNotification(
  triggerType: 'stop_loss' | 'take_profit',
  ticker: string,
  market: string,
  triggerPrice: number,
  thresholdPrice: number,
): Promise<void> {
  if (Notification.permission !== 'granted') return
  const label = market === 'TW' ? 'NT$' : 'US$'
  const typeLabel = triggerType === 'stop_loss' ? '停損' : '停利'
  const direction = triggerType === 'stop_loss' ? '低於' : '高於'
  const title = `【${typeLabel}觸發】${ticker}`
  const body = `今日開盤價 ${label}${triggerPrice.toFixed(2)}，已${direction}${typeLabel}價 ${label}${thresholdPrice.toFixed(2)}`
  try {
    const sw = await navigator.serviceWorker.ready
    await sw.showNotification(title, { body })
  } catch {
    new Notification(title, { body })
  }
}
