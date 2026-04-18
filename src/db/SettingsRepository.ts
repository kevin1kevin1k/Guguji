import { getDB } from './schema'

export const FINMIND_TOKEN_KEY = 'finmind_token'

export const SettingsRepository = {
  async get(key: string): Promise<string | null> {
    const db = await getDB()
    const entry = await db.get('settings', key)
    return entry?.value ?? null
  },
  async set(key: string, value: string): Promise<void> {
    const db = await getDB()
    await db.put('settings', { key, value })
  },
}
