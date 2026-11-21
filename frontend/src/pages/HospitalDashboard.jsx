import React, { useState, useEffect } from 'react'
import { hospitalAPI, emergencyAPI } from '../services/api'
import { createWebSocket } from '../services/websocket'
import {
  Building2,
  Bed,
  HeartPulse,
  Wind,
  Activity,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
} from 'lucide-react'

const RESOURCE_CONFIG = [
  { type: 'GENERAL_BED', label: 'General Wards', icon: Bed, color: 'text-blue-400' },
  { type: 'ICU_BED', label: 'Intensive Care Unit (ICU)', icon: HeartPulse, color: 'text-red-400' },
  { type: 'VENTILATOR', label: 'Mechanical Ventilators', icon: Wind, color: 'text-amber-400' },
  { type: 'OXYGEN_UNIT', label: 'High-Flow Oxygen Units', icon: Activity, color: 'text-emerald-400' },
]

export default function HospitalDashboard() {
  const [hospital, setHospital] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHospitalData()
  }, [])

  useEffect(() => {
    if (!hospital) return

    const ws = createWebSocket(
      `/ws/hospital/${hospital.id}`,
      (data) => {
        if (data.event === 'DISPATCH_ALLOCATED' || data.event === 'STATUS_CHANGED') {
          loadHospitalData()
        }
      }
    )

    return () => {
      ws.close()
    }
  }, [hospital?.id])

  async function loadHospitalData() {
    try {
      let h = null
      try {
        const res = await hospitalAPI.getMyHospital()
        h = res.data
      } catch (e) {
        const listRes = await hospitalAPI.list()
        if (listRes.data && listRes.data.length > 0) {
          h = listRes.data[0]
        }
      }
      setHospital(h)

      if (h) {
        const alertRes = await hospitalAPI.getAlerts(h.id)
        setAlerts(alertRes.data)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleAdjustResource(resourceType, delta) {
    if (!hospital) return
    const currentRes = hospital.resources?.find((r) => r.resource_type === resourceType)
    if (!currentRes) return

    const newAvailable = Math.max(0, currentRes.available_count + delta)
    try {
      await hospitalAPI.updateResource(hospital.id, resourceType, {
        available_count: newAvailable,
      })
      loadHospitalData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update resource')
    }
  }

  async function handleAdmitPatient(emergencyId) {
    try {
      await emergencyAPI.updateStatus(emergencyId, 'COMPLETED')
      loadHospitalData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to admit patient')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <Building2 className="w-8 h-8 text-blue-500" />
          Hospital Trauma & Bed Management
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {hospital ? `${hospital.name} — ${hospital.address}` : 'Loading clinical dashboard...'}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Bed className="w-5 h-5 text-blue-400" />
            Live Bed & Critical Care Capacity
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            {RESOURCE_CONFIG.map((cfg) => {
              const Icon = cfg.icon
              const resource = hospital?.resources?.find((r) => r.resource_type === cfg.type) || {
                total_count: 0,
                available_count: 0,
                reserved_count: 0,
              }
              const occupied = Math.max(0, resource.total_count - resource.available_count)
              const percentOccupied = resource.total_count > 0 ? Math.round((occupied / resource.total_count) * 100) : 0

              return (
                <div key={cfg.type} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon className={`w-5 h-5 ${cfg.color}`} />
                      <span className="font-bold text-white text-sm">{cfg.label}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">Total: {resource.total_count}</span>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-3xl font-black text-white font-mono">{resource.available_count}</div>
                      <div className="text-xs text-slate-400">Available Beds</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-amber-400 font-mono">{resource.reserved_count}</div>
                      <div className="text-xs text-slate-400">Inbound Locked</div>
                    </div>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        percentOccupied > 85 ? 'bg-red-500' : percentOccupied > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${percentOccupied}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-400">Quick Adjust</span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleAdjustResource(cfg.type, -1)}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-sm transition"
                        title="Decrement available"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleAdjustResource(cfg.type, 1)}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-sm transition"
                        title="Increment available"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            Inbound Trauma Arrivals ({alerts.length})
          </h2>

          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
                No active ambulances currently routed to this trauma center.
              </div>
            ) : (
              alerts.map((al) => (
                <div key={al.id} className="p-4 rounded-xl bg-slate-900 border border-red-500/30 shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-400 uppercase font-mono">
                      {al.emergency_type}
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      {al.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{al.caller_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>ETA: {al.estimated_eta_seconds ? `${Math.round(al.estimated_eta_seconds / 60)} min` : 'In Transit'}</span>
                    </div>
                    <div className="text-emerald-400 font-mono">
                      Bed Reserved: {al.allocated_resource_type}
                    </div>
                  </div>

                  <button
                    onClick={() => handleAdmitPatient(al.id)}
                    className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Admit Patient & Confirm Bed</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
