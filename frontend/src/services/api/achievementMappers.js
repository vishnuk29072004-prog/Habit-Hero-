/**
 * Map FastAPI achievement schemas ↔ Achievements UI.
 */

export function mapAchievementFromApi(row) {
  if (!row) return null
  return {
    id: row.achievement_id || row.id,
    rowId: row.id,
    achievementId: row.achievement_id,
    title: row.title,
    body: row.body,
    icon: row.icon || 'trophy',
    unlockedAt: row.unlocked_at
      ? String(row.unlocked_at).slice(0, 10)
      : null,
  }
}

export function mapCatalogueItemFromApi(item) {
  if (!item) return null
  return {
    id: item.achievement_id,
    achievementId: item.achievement_id,
    title: item.title,
    body: item.body,
    icon: item.icon || 'trophy',
    earned: Boolean(item.earned),
    unlockedAt: item.unlocked_at
      ? String(item.unlocked_at).slice(0, 10)
      : null,
  }
}

export function mapAchievementSummaryFromApi(data) {
  if (!data) {
    return {
      totalEarned: 0,
      totalAvailable: 0,
      recent: [],
      catalogue: [],
      unlocked: [],
    }
  }
  const recent = Array.isArray(data.recent)
    ? data.recent.map(mapAchievementFromApi).filter(Boolean)
    : []
  const catalogue = Array.isArray(data.catalogue)
    ? data.catalogue.map(mapCatalogueItemFromApi).filter(Boolean)
    : []
  const unlocked = catalogue
    .filter((c) => c.earned)
    .map((c) => ({
      id: c.id,
      title: c.title,
      body: c.body,
      icon: c.icon,
      unlockedAt: c.unlockedAt,
    }))

  return {
    totalEarned: data.total_earned ?? unlocked.length,
    totalAvailable: data.total_available ?? catalogue.length,
    recent,
    catalogue,
    unlocked,
  }
}

export default {
  mapAchievementFromApi,
  mapCatalogueItemFromApi,
  mapAchievementSummaryFromApi,
}
