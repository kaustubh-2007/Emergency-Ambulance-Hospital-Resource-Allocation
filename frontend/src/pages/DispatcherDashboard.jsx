import React, { useState, useEffect } from 'react'
import { ambulanceAPI, hospitalAPI, emergencyAPI } from '../services/api'
import { createWebSocket } from '../services/websocket'
import LeafletMap from '../components/LeafletMap'
import {
  ShieldAlert,
  Ambulance,
  Building2,
  AlertTriangle,
  RefreshCw,
  Edit3,
  X,
  Check,
  Activity,
} from 'lucide-react'

export default function DispatcherDashboard() {
  const [ambulances, setAmbulances] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [emergencies, setEmergencies] = useState([])
  const [selectedEmergency, setSelectedEmergency] = useState(null)
  const [overrideModal, setOverrideModal] = useState(false)
  const [targetAmbulanceId, setTargetAmbulanceId] = useState('')
  const [targetHospitalId, setTargetHospitalId] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadGlobalData()

    const ws = createWebSocket(
      '/ws/dispatcher',
      (data) => {
        if (data.event === 'TELEMETRY_UPDATE') {
          setAmbulances((prev) =>
            prev.map((a) =>
              a.id === data.ambulance_id
                ? { ...a, current_latitude: data.coordinates.latitude, current_longitude: data.coordinates.longitude }
                : a
            )
          )
        } else {
          loadGlobalData()
        }
      }
    )

    return () => {
      ws.close()
    }
  }, [])

  async function loadGlobalData() {
    try {
      const [ambRes, hospRes, emergRes] = await Promise.all([
        ambulanceAPI.list(),
        hospitalAPI.list(),
        emergencyAPI.list(),
      ])
      setAmbulances(ambRes.data)
      setHospitals(hospRes.data)
      setEmergencies(emergRes.data)
    } finally {
      setLoading(false)
    }
  }

  function openOverride(emerg) {
    setSelectedEmergency(emerg)
    setTargetAmbulanceId(emerg.ambulance_id || '')
    setTargetHospitalId(emerg.hospital_id || '')
    setOverrideReason('Rebalancing city emergency coverage')
    setOverrideModal(true)
  }

  async function handleApplyOverride(e) {
    e.preventDefault()
    if (!selectedEmergency) return
    try {
      await emergencyAPI.override(selectedEmergency.id, {
        ambulance_id: targetAmbulanceId ? parseInt(targetAmbulanceId) : null,
        hospital_id: targetHospitalId ? parseInt(targetHospitalId) : null,
        reason: overrideReason,
      })
      setOverrideModal(false)
      loadGlobalData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Manual override execution failed')
    }
  }

  const availableAmbs = ambulances.filter((a) => a.status === 'AVAILABLE').length
  const dispatchedAmbs = ambulances.filter((a) => a.status === 'DISPATCHED' || a.status === 'EN_ROUTE').length
  const activeEmergencies = emergencies.filter(
    (e) => e.status !== 'COMPLETED' && e.status !== 'CANCELLED'
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-purple-500" />
            Central Dispatch & Command Operations
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            City-wide GIS situational awareness, fleet orchestration, and manual supervisory override.
          </p>
        </div>

        <button
          onClick={loadGlobalData}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl flex items-center gap-2 border border-slate-700 transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Live Feeds</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow">
          <div className="text-xs text-slate-400 uppercase font-semibold">Available Fleet</div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{availableAmbs}</div>
          <div className="text-[11px] text-slate-500">Ready for instant dispatch</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow">
          <div className="text-xs text-slate-400 uppercase font-semibold">In-Mission Fleet</div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">{dispatchedAmbs}</div>
          <div className="text-[11px] text-slate-500">En route / transport</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow">
          <div className="text-xs text-slate-400 uppercase font-semibold">Active Emergencies</div>
          <div className="text-2xl font-black text-red-400 font-mono mt-1">{activeEmergencies.length}</div>
          <div className="text-[11px] text-slate-500">Live incidents in queue</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow">
          <div className="text-xs text-slate-400 uppercase font-semibold">Trauma Hospitals</div>
          <div className="text-2xl font-black text-blue-400 font-mono mt-1">{hospitals.length}</div>
          <div className="text-[11px] text-slate-500">Regional care centers</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
          <LeafletMap
            center={[26.8467, 80.9462]}
            zoom={12}
            ambulances={ambulances}
            hospitals={hospitals}
            activeEmergency={selectedEmergency}
            className="h-[560px] w-full"
          />
        </div>

        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            Hospital Saturation Levels
          </h2>

          <div className="space-y-3">
            {hospitals.map((h) => {
              const icu = h.resources?.find((r) => r.resource_type === 'ICU_BED') || {
                total_count: 0,
                available_count: 0,
              }
              const occPct = icu.total_count > 0 ? Math.round(((icu.total_count - icu.available_count) / icu.total_count) * 100) : 0

              return (
                <div key={h.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-white text-xs">{h.name}</div>
                      <div className="text-[11px] text-slate-400">{h.address.split(',')[1] || h.address}</div>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {icu.available_count} ICU
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${occPct > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${occPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          Live Emergency Incidents Ledger
        </h2>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800 font-mono">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Category</th>
                <th className="p-3">Caller</th>
                <th className="p-3">Assigned Unit</th>
                <th className="p-3">Destination</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {emergencies.slice(0, 10).map((em) => (
                <tr key={em.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-white">#{em.id}</td>
                  <td className="p-3 font-bold text-red-400">{em.emergency_type}</td>
                  <td className="p-3">
                    <div className="font-medium text-white">{em.caller_name}</div>
                    <div className="text-slate-500">{em.caller_phone}</div>
                  </td>
                  <td className="p-3 font-mono font-bold text-amber-400">
                    {em.ambulance?.vehicle_number || 'UNASSIGNED'}
                  </td>
                  <td className="p-3 font-medium text-blue-300">
                    {em.hospital?.name || 'UNASSIGNED'}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                      {em.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => openOverride(em)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-purple-950 text-slate-300 hover:text-purple-300 border border-slate-700 hover:border-purple-600 font-bold transition flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Override</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {overrideModal && selectedEmergency && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleApplyOverride}
            className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                Manual Dispatcher Override — Incident #{selectedEmergency.id}
              </h3>
              <button
                type="button"
                onClick={() => setOverrideModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Reassign Ambulance</label>
              <select
                value={targetAmbulanceId}
                onChange={(e) => setTargetAmbulanceId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="">Keep Current Assignment</option>
                {ambulances.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.vehicle_number} ({a.status} - {a.vehicle_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Reassign Destination Hospital</label>
              <select
                value={targetHospitalId}
                onChange={(e) => setTargetHospitalId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="">Keep Current Assignment</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mandatory Override Justification</label>
              <textarea
                required
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500"
                placeholder="Specify clinical or operational diversion reasoning..."
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setOverrideModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Execute Atomic Reallocation</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
