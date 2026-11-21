import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../services/api'
import { ShieldAlert, User, Lock, Mail, Phone, HeartPulse, Stethoscope, Radio, CheckCircle2 } from 'lucide-react'

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('PATIENT')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isRegister) {
        await authAPI.register({
          email,
          password,
          full_name: fullName,
          phone,
          role,
        })
        const loginRes = await authAPI.login({ email, password })
        login(loginRes.data.access_token, loginRes.data.user)
        routeUser(loginRes.data.user.role)
      } else {
        const res = await authAPI.login({ email, password })
        login(res.data.access_token, res.data.user)
        routeUser(res.data.user.role)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Please verify credentials.')
    } finally {
      setLoading(false)
    }
  }

  function routeUser(userRole) {
    if (userRole === 'PATIENT') navigate('/patient')
    else if (userRole === 'DRIVER') navigate('/driver')
    else if (userRole === 'HOSPITAL_ADMIN') navigate('/hospital')
    else if (userRole === 'DISPATCHER') navigate('/dispatcher')
    else navigate('/')
  }

  function quickLogin(demoEmail, demoPassword) {
    setEmail(demoEmail)
    setPassword(demoPassword)
    authAPI
      .login({ email: demoEmail, password: demoPassword })
      .then((res) => {
        login(res.data.access_token, res.data.user)
        routeUser(res.data.user.role)
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Quick login failed')
      })
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-slate-950">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8">
        <div>
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">EAHRAS Portal</h1>
              <p className="text-xs text-slate-400">Emergency Ambulance & Resource Allocation</p>
            </div>
          </div>

          <div className="mt-6 mb-8">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              One-Click Role Demonstration Accounts
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => quickLogin('caller@emergency.org', 'Caller@123')}
                className="p-3 text-left rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-red-500/50 transition group"
              >
                <div className="flex items-center space-x-2 text-red-400 font-bold text-xs mb-1">
                  <HeartPulse className="w-4 h-4" />
                  <span>Patient / Caller</span>
                </div>
                <div className="text-[11px] text-slate-400">Trigger SOS & Live Map</div>
              </button>

              <button
                type="button"
                onClick={() => quickLogin('driver1@emergency.org', 'Driver@123')}
                className="p-3 text-left rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/50 transition group"
              >
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs mb-1">
                  <Radio className="w-4 h-4" />
                  <span>Paramedic Driver</span>
                </div>
                <div className="text-[11px] text-slate-400">Mission Alerts & GPS</div>
              </button>

              <button
                type="button"
                onClick={() => quickLogin('admin.kgmu@emergency.org', 'Admin@123')}
                className="p-3 text-left rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/50 transition group"
              >
                <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs mb-1">
                  <Stethoscope className="w-4 h-4" />
                  <span>Hospital Admin</span>
                </div>
                <div className="text-[11px] text-slate-400">Live Bed Management</div>
              </button>

              <button
                type="button"
                onClick={() => quickLogin('dispatcher@emergency.org', 'Dispatch@123')}
                className="p-3 text-left rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-purple-500/50 transition group"
              >
                <div className="flex items-center space-x-2 text-purple-400 font-bold text-xs mb-1">
                  <ShieldAlert className="w-4 h-4" />
                  <span>City Dispatcher</span>
                </div>
                <div className="text-[11px] text-slate-400">Command & Override</div>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Full Concurrency & ACID Bed Locking</span>
            </div>
            <p>
              Pre-seeded with Lucknow trauma centers (KGMU, RMLIMS, Medanta, SGPGIMS) and 6 active ambulances with live OSRM routing.
            </p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 p-6 rounded-xl flex flex-col justify-center">
          <div className="flex border-b border-slate-800 mb-6">
            <button
              onClick={() => setIsRegister(false)}
              className={`pb-3 text-sm font-bold flex-1 border-b-2 transition ${
                !isRegister ? 'border-red-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsRegister(true)}
              className={`pb-3 text-sm font-bold flex-1 border-b-2 transition ${
                isRegister ? 'border-red-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-lg bg-red-950/80 border border-red-800/80 text-red-200 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Dr. Rajesh Khanna"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Phone</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91-9876543210"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">System Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="PATIENT">Patient / Emergency Caller</option>
                    <option value="DRIVER">Ambulance Paramedic Driver</option>
                    <option value="HOSPITAL_ADMIN">Hospital Administrator</option>
                    <option value="DISPATCHER">Central City Dispatcher</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@emergency.org"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Authenticate & Enter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
