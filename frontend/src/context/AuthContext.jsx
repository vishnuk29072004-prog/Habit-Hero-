import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { authService } from '../services/authService'
import { profileImageService } from '../services/profileImageService'
import {
  getAccessToken,
  setOnTokensCleared,
} from '../services/api/tokenStore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  const setSafeAvatarUrl = useCallback((next) => {
    setAvatarUrl((prev) => {
      if (prev && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev)
      }
      return next || null
    })
  }, [])

  const clearAuthState = useCallback(() => {
    setUser(null)
    setToken(null)
    setSettings(null)
    setSafeAvatarUrl(null)
  }, [setSafeAvatarUrl])

  const applyUser = useCallback(
    (nextUser) => {
      setUser(nextUser)
      if (nextUser?.avatarUrl) {
        setSafeAvatarUrl(nextUser.avatarUrl)
      }
    },
    [setSafeAvatarUrl]
  )

  const resolveDisplayAvatar = useCallback(
    async (nextUser) => {
      if (nextUser?.avatarUrl) {
        setSafeAvatarUrl(nextUser.avatarUrl)
        return
      }
      // Fallback: legacy IndexedDB blob if server has no avatar yet.
      if (!nextUser?.id) {
        setSafeAvatarUrl(null)
        return
      }
      try {
        const blob = await profileImageService.getLocal(nextUser.id)
        setSafeAvatarUrl(blob ? URL.createObjectURL(blob) : null)
      } catch {
        setSafeAvatarUrl(null)
      }
    },
    [setSafeAvatarUrl]
  )

  useEffect(() => {
    setOnTokensCleared(() => {
      clearAuthState()
    })
    return () => setOnTokensCleared(null)
  }, [clearAuthState])

  useEffect(() => {
    let active = true
    authService
      .getSession()
      .then(async (session) => {
        if (!active) return
        if (session) {
          applyUser(session.user)
          setToken(session.token || getAccessToken())
          await resolveDisplayAvatar(session.user)
          try {
            const prefs = await authService.getSettings()
            if (active) setSettings(prefs)
          } catch {
            // Settings load is non-fatal for boot.
          }
        } else {
          clearAuthState()
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [applyUser, clearAuthState, resolveDisplayAvatar])

  const login = useCallback(
    async (credentials) => {
      const session = await authService.login(credentials)
      applyUser(session.user)
      setToken(session.token)
      await resolveDisplayAvatar(session.user)
      try {
        setSettings(await authService.getSettings())
      } catch {
        setSettings(null)
      }
      return session.user
    },
    [applyUser, resolveDisplayAvatar]
  )

  const signup = useCallback(
    async (payload) => {
      const session = await authService.signup(payload)
      applyUser(session.user)
      setToken(session.token)
      await resolveDisplayAvatar(session.user)
      try {
        setSettings(await authService.getSettings())
      } catch {
        setSettings(null)
      }
      return session.user
    },
    [applyUser, resolveDisplayAvatar]
  )

  const logout = useCallback(async () => {
    await authService.logout()
    clearAuthState()
  }, [clearAuthState])

  const updateProfile = useCallback(async (payload) => {
    const updated = await authService.updateProfile(payload)
    applyUser(updated)
    return updated
  }, [applyUser])

  const changePassword = useCallback(
    async (payload) => {
      const result = await authService.changePassword({
        ...payload,
        email: user?.email,
      })
      if (result?.token) {
        setToken(result.token)
        if (result.user) applyUser(result.user)
      }
      return true
    },
    [user, applyUser]
  )

  const saveAvatar = useCallback(
    async (file) => {
      if (!user?.id) throw new Error('Not authenticated.')
      const updated = await authService.uploadAvatar(file)
      applyUser(updated)
      // Clear IndexedDB only after successful server upload.
      await profileImageService.clearLocal(user.id)
      return updated
    },
    [user, applyUser]
  )

  const removeAvatar = useCallback(async () => {
    if (!user?.id) throw new Error('Not authenticated.')
    const updated = await authService.deleteAvatar()
    applyUser(updated)
    await profileImageService.clearLocal(user.id)
    return updated
  }, [user, applyUser])

  const refreshSettings = useCallback(async () => {
    const prefs = await authService.getSettings()
    setSettings(prefs)
    return prefs
  }, [])

  const updateSettings = useCallback(async (patch) => {
    const prefs = await authService.updateSettings(patch)
    setSettings(prefs)
    return prefs
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      avatarUrl,
      settings,
      loading,
      isAuthenticated: Boolean(user && (token || getAccessToken())),
      login,
      signup,
      logout,
      updateProfile,
      changePassword,
      saveAvatar,
      removeAvatar,
      refreshSettings,
      updateSettings,
      reloadAvatar: () => resolveDisplayAvatar(user),
    }),
    [
      user,
      token,
      avatarUrl,
      settings,
      loading,
      login,
      signup,
      logout,
      updateProfile,
      changePassword,
      saveAvatar,
      removeAvatar,
      refreshSettings,
      updateSettings,
      resolveDisplayAvatar,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
