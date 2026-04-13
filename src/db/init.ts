import { SplitEventRepository } from './SplitEventRepository'
import { BUILT_IN_SPLIT_EVENTS } from '../data/builtInSplitEvents'

/**
 * Seeds built-in split events into IndexedDB on first launch.
 * Skips events that already exist (idempotent).
 */
export async function initDB(): Promise<void> {
  const existing = await SplitEventRepository.getAll()
  const existingIds = new Set(existing.map((e) => e.id))

  for (const event of BUILT_IN_SPLIT_EVENTS) {
    if (!existingIds.has(event.id)) {
      await SplitEventRepository.add(event)
    }
  }
}
