import type { CachedPlan, SnapshotView } from '../types'

const DB_NAME = 'commutesure-sg'
const STORE = 'contingency'
const KEY = 'latest-plan'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open offline storage'))
  })
}

async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = work(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Offline storage failed'))
  }).finally(() => db.close())
}

export async function savePlan(snapshot: SnapshotView): Promise<CachedPlan> {
  const plan = { snapshot, cachedAt: new Date().toISOString() }
  await transaction('readwrite', (store) => store.put(plan, KEY))
  return plan
}

export async function loadPlan(): Promise<CachedPlan | null> {
  return (await transaction('readonly', (store) => store.get(KEY))) as CachedPlan | undefined ?? null
}

export async function clearPlan(): Promise<void> {
  await transaction('readwrite', (store) => store.delete(KEY))
}
