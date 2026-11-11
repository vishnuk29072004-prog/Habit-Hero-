/**
 * Map FastAPI notification schemas ↔ PageHeaderTools UI.
 */

import { formatDistanceToNow, parseISO } from 'date-fns'

export function formatNotificationTime(createdAt) {
  if (!createdAt) return ''
  try {
    const date =
      typeof createdAt === 'string' ? parseISO(createdAt) : new Date(createdAt)
    if (Number.isNaN(date.getTime())) return ''
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return ''
  }
}

export function mapNotificationFromApi(row) {
  if (!row) return null
  return {
    id: row.id,
    type: row.type || '',
    title: row.title || '',
    message: row.message || '',
    resourceType: row.resource_type || null,
    resourceId: row.resource_id || null,
    unread: Boolean(row.unread),
    createdAt: row.created_at || '',
    readAt: row.read_at || null,
    time: formatNotificationTime(row.created_at),
  }
}

export function mapNotificationListFromApi(data) {
  if (!data) {
    return {
      items: [],
      total: 0,
      unread: 0,
      page: 1,
      pageSize: 20,
    }
  }
  return {
    items: Array.isArray(data.items)
      ? data.items.map(mapNotificationFromApi).filter(Boolean)
      : [],
    total: data.total ?? 0,
    unread: data.unread ?? 0,
    page: data.page ?? 1,
    pageSize: data.page_size ?? 20,
  }
}

export function mapNotificationSummaryFromApi(data) {
  if (!data) {
    return { total: 0, unread: 0 }
  }
  return {
    total: data.total ?? 0,
    unread: data.unread ?? 0,
  }
}

export default {
  formatNotificationTime,
  mapNotificationFromApi,
  mapNotificationListFromApi,
  mapNotificationSummaryFromApi,
}
