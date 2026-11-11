/**
 * Avatar helpers for Habit Hero.
 * Server storage is the source of truth (POST/DELETE /users/me/avatar).
 * IndexedDB is only used as a fallback display during migration and is
 * cleared after a successful server upload/delete — never before.
 */

const DB_NAME = 'habit-hero-profile'
const STORE_NAME = 'avatars'
const DB_VERSION = 1

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const result = fn(store)
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
  })
}

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]

/** Backend MAX_AVATAR_BYTES (2 MB). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

export function validateProfileImage(file) {
  if (!file) return 'Please choose an image file.'
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Unsupported file type. Use JPG, JPEG, PNG, or WebP.'
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Image is too large. Maximum size is 2 MB.'
  }
  return ''
}

export const profileImageService = {
  /** Legacy IndexedDB read — fallback only if server has no avatar. */
  async getLocal(userId) {
    if (!userId) return null
    try {
      const db = await openDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const request = store.get(userId)
        request.onsuccess = () => resolve(request.result || null)
        request.onerror = () => reject(request.error)
      })
    } catch {
      return null
    }
  },

  /** Clear IndexedDB copy after successful server replace/delete. */
  async clearLocal(userId) {
    if (!userId) return
    try {
      await withStore('readwrite', (store) => store.delete(userId))
    } catch {
      // Non-fatal — server remains source of truth.
    }
  },
}

export default profileImageService
