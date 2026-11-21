import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import PatientDashboard from './pages/PatientDashboard'
import DriverDashboard from './pages/DriverDashboard'
import HospitalDashboard from './pages/HospitalDashboard'
import DispatcherDashboard from './pages/DispatcherDashboard'

function RoleRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  if (user.role === 'PATIENT') return <Navigate to="/patient" replace />
  if (user.role === 'DRIVER') return <Navigate to="/driver" replace />
  if (user.role === 'HOSPITAL_ADMIN') return <Navigate to="/hospital" replace />
  if (user.role === 'DISPATCHER') return <Navigate to="/dispatcher" replace />
  return <Navigate to="/patient" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-500 selection:text-white">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<RoleRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/patient" element={<PatientDashboard />} />
              <Route path="/driver" element={<DriverDashboard />} />
              <Route path="/hospital" element={<HospitalDashboard />} />
              <Route path="/dispatcher" element={<DispatcherDashboard />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
