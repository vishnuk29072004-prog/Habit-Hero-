import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { HabitProvider } from './context/HabitContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import MainLayout from './components/layout/MainLayout'
import Dashboard from './pages/Dashboard/Dashboard'
import Habits from './pages/Habits/Habits'
import Calendar from './pages/Calendar/Calendar'
import Analytics from './pages/Analytics/Analytics'
import Goals from './pages/Goals/Goals'
import Journal from './pages/Journal/Journal'
import AIInsights from './pages/AIInsights/AIInsights'
import Settings from './pages/Settings/Settings'
import Login from './pages/Login/Login'
import Signup from './pages/Signup/Signup'
import Profile from './pages/Profile/Profile'

function App() {
  return (
    <AuthProvider>
      <HabitProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="habits" element={<Habits />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="progress" element={<Navigate to="/calendar" replace />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="goals" element={<Goals />} />
              <Route path="journal" element={<Journal />} />
              <Route path="ai-insights" element={<AIInsights />} />
              <Route path="settings" element={<Settings />} />
              <Route path="profile" element={<Profile />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </HabitProvider>
    </AuthProvider>
  )
}

export default App
