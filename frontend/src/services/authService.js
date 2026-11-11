/**
 * Backend authentication + profile helpers (FastAPI).
 */

import { authApi } from './api/authApi'
import { userApi } from './api/userApi'
import { ApiError, isApiError } from './api/apiError'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  hydrateTokensFromSession,
  setTokens,
} from './api/tokenStore'
import { resolveMediaUrl } from './mediaUrl'

export function mapUser(apiUser) {
  if (!apiUser) return null
  return {
    id: apiUser.id,
    fullName: apiUser.full_name,
    email: apiUser.email,
    createdAt: apiUser.created_at || null,
    avatarUrl: resolveMediaUrl(apiUser.avatar_url) || null,
  }
}

export function mapSettings(apiSettings) {
  if (!apiSettings) return null
  return {
    streakGoalTarget: apiSettings.streak_goal_target,
    notificationsEnabled: Boolean(apiSettings.notifications_enabled),
    remindHabitsDaily: Boolean(apiSettings.remind_habits_daily),
    remindHabitsWeekly: Boolean(apiSettings.remind_habits_weekly),
    remindHabitsUpcoming: Boolean(apiSettings.remind_habits_upcoming),
    remindHabitsOverdue: Boolean(apiSettings.remind_habits_overdue),
    remindGoalDeadlines: Boolean(apiSettings.remind_goal_deadlines),
    remindStreakMilestones: Boolean(apiSettings.remind_streak_milestones),
    remindWeeklySummary: Boolean(apiSettings.remind_weekly_summary),
    updatedAt: apiSettings.updated_at,
  }
}

function toError(err) {
  if (isApiError(err)) {
    const error = new Error(err.message || 'Request failed')
    error.status = err.status
    error.detail = err.detail
    error.code = err.code
    return error
  }
  if (err instanceof Error) return err
  return new Error('Request failed')
}

function applyTokenPair(data) {
  const access = data?.access_token
  const refresh = data?.refresh_token
  if (!access || !refresh) {
    throw new Error('Invalid authentication response from server.')
  }
  setTokens({ accessToken: access, refreshToken: refresh })
  return {
    token: access,
    refreshToken: refresh,
    user: mapUser(data.user),
  }
}

export const authService = {
  async getSession() {
    hydrateTokensFromSession()
    if (!getAccessToken()) return null

    try {
      // Prefer full profile (includes avatar_url) over /auth/me.
      const response = await userApi.getProfile()
      const user = mapUser(response?.data)
      if (!user) {
        clearTokens()
        return null
      }
      return { token: getAccessToken(), user }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearTokens()
        return null
      }
      return null
    }
  },

  async signup({ fullName, email, password }) {
    try {
      await authApi.register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      })
    } catch (err) {
      throw toError(err)
    }
    return this.login({ email, password })
  },

  async login({ email, password }) {
    try {
      const response = await authApi.login({
        email: email.trim().toLowerCase(),
        password,
      })
      const session = applyTokenPair(response?.data)
      // Enrich with profile avatar if available.
      try {
        const profile = await userApi.getProfile()
        session.user = mapUser(profile?.data) || session.user
      } catch {
        // Keep login user if profile fetch fails.
      }
      return session
    } catch (err) {
      throw toError(err)
    }
  },

  async logout() {
    const refresh = getRefreshToken()
    try {
      if (refresh) {
        await authApi.logout(refresh)
      }
    } catch {
      // Ignore revoke errors.
    } finally {
      clearTokens()
    }
  },

  async getProfile() {
    try {
      const response = await userApi.getProfile()
      return mapUser(response?.data)
    } catch (err) {
      throw toError(err)
    }
  },

  async updateProfile({ fullName, email }) {
    try {
      const payload = {}
      if (fullName != null) payload.full_name = fullName.trim()
      if (email != null) payload.email = email.trim().toLowerCase()
      const response = await userApi.updateProfile(payload)
      return mapUser(response?.data)
    } catch (err) {
      throw toError(err)
    }
  },

  async changePassword({ currentPassword, newPassword, email }) {
    try {
      await userApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      // Backend revokes all refresh tokens — obtain a fresh pair.
      if (email) {
        return this.login({ email, password: newPassword })
      }
      clearTokens()
      return { requiresReLogin: true }
    } catch (err) {
      throw toError(err)
    }
  },

  async uploadAvatar(file) {
    try {
      const response = await userApi.uploadAvatar(file)
      return mapUser(response?.data)
    } catch (err) {
      throw toError(err)
    }
  },

  async deleteAvatar() {
    try {
      const response = await userApi.deleteAvatar()
      return mapUser(response?.data)
    } catch (err) {
      throw toError(err)
    }
  },

  async getSettings() {
    try {
      const response = await userApi.getSettings()
      return mapSettings(response?.data)
    } catch (err) {
      throw toError(err)
    }
  },

  async updateSettings(patch) {
    try {
      const payload = {}
      if (patch.streakGoalTarget != null) {
        payload.streak_goal_target = patch.streakGoalTarget
      }
      if (patch.notificationsEnabled != null) {
        payload.notifications_enabled = patch.notificationsEnabled
      }
      if (patch.remindHabitsDaily != null) {
        payload.remind_habits_daily = patch.remindHabitsDaily
      }
      if (patch.remindHabitsWeekly != null) {
        payload.remind_habits_weekly = patch.remindHabitsWeekly
      }
      if (patch.remindHabitsUpcoming != null) {
        payload.remind_habits_upcoming = patch.remindHabitsUpcoming
      }
      if (patch.remindHabitsOverdue != null) {
        payload.remind_habits_overdue = patch.remindHabitsOverdue
      }
      if (patch.remindGoalDeadlines != null) {
        payload.remind_goal_deadlines = patch.remindGoalDeadlines
      }
      if (patch.remindStreakMilestones != null) {
        payload.remind_streak_milestones = patch.remindStreakMilestones
      }
      if (patch.remindWeeklySummary != null) {
        payload.remind_weekly_summary = patch.remindWeeklySummary
      }
      const response = await userApi.updateSettings(payload)
      return mapSettings(response?.data)
    } catch (err) {
      throw toError(err)
    }
  },
}

export default authService
