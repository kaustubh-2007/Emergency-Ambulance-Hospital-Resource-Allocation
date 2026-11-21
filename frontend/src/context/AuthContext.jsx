import React, { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('token') || null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function verifyUser() {
      if (token) {
        try {
          const res = await authAPI.getMe()
          setUser(res.data)
          localStorage.setItem('user', JSON.stringify(res.data))
        } catch (e) {
          logout()
        }
      }
      setLoading(false)
    }
    verifyUser()
  }, [token])

  function login(tokenString, userData) {
    localStorage.setItem('token', tokenString)
    localStorage.setItem('user', JSON.stringify(userData))
    setToken(tokenString)
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
