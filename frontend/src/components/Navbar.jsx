import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ShieldAlert, Ambulance, Building2, User, LogOut, Radio } from 'lucide-react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="font-black text-lg tracking-wider text-white flex items-center gap-2">
              EAHRAS
              <span className="text-xs bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded-full font-mono">
                LIVE
              </span>
            </div>
            <div className="text-xs text-slate-400 font-medium">Emergency Ambulance & Resource Allocation</div>
          </div>
        </Link>

        <nav className="flex items-center space-x-2">
          {user ? (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-lg text-sm">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                  {user.role}
                </span>
                <span className="text-slate-200 font-medium">{user.full_name}</span>
              </div>

              <div className="flex items-center space-x-1 border-l border-slate-700 pl-3">
                <Link
                  to="/patient"
                  className="px-2.5 py-1 text-xs font-medium rounded hover:bg-slate-800 text-slate-300 hover:text-white"
                  title="Patient SOS View"
                >
                  Patient
                </Link>
                <Link
                  to="/driver"
                  className="px-2.5 py-1 text-xs font-medium rounded hover:bg-slate-800 text-slate-300 hover:text-white"
                  title="Ambulance Driver"
                >
                  Driver
                </Link>
                <Link
                  to="/hospital"
                  className="px-2.5 py-1 text-xs font-medium rounded hover:bg-slate-800 text-slate-300 hover:text-white"
                  title="Hospital Admin"
                >
                  Hospital
                </Link>
                <Link
                  to="/dispatcher"
                  className="px-2.5 py-1 text-xs font-medium rounded hover:bg-slate-800 text-slate-300 hover:text-white"
                  title="City Dispatcher"
                >
                  Dispatcher
                </Link>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 transition"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="bg-red-600 hover:bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-lg shadow-red-600/30 transition flex items-center space-x-2"
            >
              <User className="w-4 h-4" />
              <span>Login / Portal Access</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
