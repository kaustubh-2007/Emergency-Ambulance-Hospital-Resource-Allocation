import React, { useState, useEffect } from 'react'
import { emergencyAPI } from '../services/api'
import { createWebSocket } from '../services/websocket'
import { useAuth } from '../context/AuthContext'
import LeafletMap from '../components/LeafletMap'
import {
  AlertTriangle,
  LocateFixed,
  Ambulance,
  Building2,
  Clock,
  CheckCircle,
  XCircle,
  HeartPulse,
  Flame,
  Baby,
  Activity,
  Phone,
  User,
} from 'lucide-react'

const EMERGENCY_TYPES = [
  { id: 'CARDIAC', label: 'Cardiac Arrest / Chest Pain', icon: HeartPulse, color: 'border-red-500 bg-red-500/10 text-red-400' },
  { id: 'TRAUMA', label: 'Severe Trauma / Accident', icon: Flame, color: 'border-amber-500 bg-amber-500/10 text-amber-400' },
  { id: 'MATERNITY', label: 'Maternity / Acute Labor', icon: Baby, color: 'border-pink-500 bg-pink-500/10 text-pink-400' },
  { id: 'GENERAL', label: 'General / Respiratory Failure', icon: Activity, color: 'border-blue-500 bg-blue-500/10 text-blue-400' },
]

export default function PatientDashboard() {
  const { user } = useAuth()
  const [callerName, setCallerName] = useState(user?.full_name || 'Emergency Caller')
  const [callerPhone, setCallerPhone] = useState(user?.phone || '+91-9876543210')
  const [emergencyType, setEmergencyType] = useState('CARDIAC')
  const [latitude, setLatitude] = useState(26.8467)
  const [longitude, setLongitude] = useState(80.9462)
  const [address, setAddress] = useState('Hazratganj, Lucknow, UP')
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeEmergency, setActiveEmergency] = useState(null)
  const [liveAmbulanceCoords, setLiveAmbulanceCoords] = useState(null)
  const [liveEta, setLiveEta] = useState(null)

  useEffect(() => {
    fetchActiveEmergency()
  }, [])

  useEffect(() => {
    if (!activeEmergency || activeEmergency.status === 'COMPLETED' || activeEmergency.status === 'CANCELLED') {
      return
    }

    const ws = createWebSocket(
      `/ws/tracking/${activeEmergency.id}`,
      (data) => {
        if (data.event === 'TELEMETRY_UPDATE') {
          setLiveAmbulanceCoords([data.coordinates.latitude, data.coordinates.longitude])
        } else if (data.event === 'STATUS_CHANGED') {
          setActiveEmergency((prev) => ({ ...prev, status: data.new_status }))
        } else if (data.event === 'DISPATCH_ALLOCATED') {
          fetchActiveEmergency()
        }
      }
    )

    return () => {
      ws.close()
    }
  }, [activeEmergency?.id])

  async function fetchActiveEmergency() {
    try {
      const res = await emergencyAPI.getMyActive()
      if (res.data) {
        setActiveEmergency(res.data)
        setLiveEta(res.data.estimated_eta_seconds)
        if (res.data.ambulance) {
          setLiveAmbulanceCoords([
            res.data.ambulance.current_latitude,
            res.data.ambulance.current_longitude,
          ])
        }
      }
    } catch (e) {
      // Ignored if no active emergency
    }
  }

  function handleAutoDetectLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }
    setDetectingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(Number(pos.coords.latitude.toFixed(6)))
        setLongitude(Number(pos.coords.longitude.toFixed(6)))
        setDetectingLocation(false)
      },
      () => {
        setLatitude(26.8467)
        setLongitude(80.9462)
        setDetectingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 5000 }
    )
  }

  async function handleTriggerSOS(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await emergencyAPI.trigger({
        caller_name: callerName,
        caller_phone: callerPhone,
        emergency_type: emergencyType,
        pickup_latitude: latitude,
        pickup_longitude: longitude,
        pickup_address: address,
      })
      setActiveEmergency(res.data)
      setLiveEta(res.data.estimated_eta_seconds)
      if (res.data.ambulance) {
        setLiveAmbulanceCoords([
          res.data.ambulance.current_latitude,
          res.data.ambulance.current_longitude,
        ])
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to trigger emergency SOS')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!activeEmergency) return
    if (!window.confirm('Are you sure you want to abort this emergency request?')) return
    try {
      await emergencyAPI.cancel(activeEmergency.id)
      setActiveEmergency(null)
      setLiveAmbulanceCoords(null)
    } catch (err) {
      alert(err.response?.data?.detail || 'Cancellation failed')
    }
  }

  const mapAmbulance = liveAmbulanceCoords && activeEmergency?.ambulance
    ? [{
        ...activeEmergency.ambulance,
        current_latitude: liveAmbulanceCoords[0],
        current_longitude: liveAmbulanceCoords[1],
        status: 'DISPATCHED',
      }]
    : []

  const mapHospitals = activeEmergency?.hospital ? [activeEmergency.hospital] : []

  const routePoints = liveAmbulanceCoords && activeEmergency
    ? [
        liveAmbulanceCoords,
        [activeEmergency.pickup_latitude, activeEmergency.pickup_longitude],
        activeEmergency.hospital ? [activeEmergency.hospital.latitude, activeEmergency.hospital.longitude] : null,
      ].filter(Boolean)
    : []

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-red-500 animate-pulse" />
          Patient Emergency SOS & Real-Time Tracking
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Automated road-routing nearest ambulance dispatch and concurrency-locked bed reservation.
        </p>
      </div>

      {activeEmergency ? (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-red-500/30 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs uppercase tracking-wider font-bold text-red-400">
                  Incident #{activeEmergency.id}
                </span>
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-bold animate-pulse">
                  {activeEmergency.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start space-x-3 text-sm">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-slate-400 text-xs">Estimated Arrival Time</div>
                    <div className="text-xl font-black text-white font-mono">
                      {liveEta ? `${Math.round(liveEta / 60)} min (${Math.round(liveEta)}s)` : 'Calculating...'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3 text-sm">
                  <Ambulance className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-slate-400 text-xs">Assigned Emergency Vehicle</div>
                    <div className="text-white font-bold">
                      {activeEmergency.ambulance?.vehicle_number || 'Dispatching nearest...'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {activeEmergency.ambulance?.vehicle_type || 'Advanced Life Support'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3 text-sm">
                  <Building2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-slate-400 text-xs">Allocated Trauma Hospital</div>
                    <div className="text-white font-bold">
                      {activeEmergency.hospital?.name || 'Evaluating regional capacity...'}
                    </div>
                    <div className="text-xs text-emerald-400 font-mono mt-0.5">
                      Locked Bed: {activeEmergency.allocated_resource_type || 'ICU_BED'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex gap-2">
                <button
                  onClick={handleCancel}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-red-950 border border-slate-700 hover:border-red-600 text-slate-300 hover:text-red-300 font-bold text-xs transition"
                >
                  Cancel Distress Call
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-2">
              <div className="font-bold text-slate-300">Live Telemetry Synchronized</div>
              <p>
                Streaming live coordinates from assigned vehicle. Bed reservation at the destination facility is cryptographically locked via atomic transaction.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <LeafletMap
              center={[activeEmergency.pickup_latitude, activeEmergency.pickup_longitude]}
              zoom={14}
              ambulances={mapAmbulance}
              hospitals={mapHospitals}
              activeEmergency={activeEmergency}
              routePoints={routePoints}
              className="h-[520px] w-full"
            />
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <form onSubmit={handleTriggerSOS} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Trigger Emergency SOS
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Caller Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={callerName}
                    onChange={(e) => setCallerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Callback Phone</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={callerPhone}
                    onChange={(e) => setCallerPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Emergency Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {EMERGENCY_TYPES.map((t) => {
                    const Icon = t.icon
                    const isSelected = emergencyType === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setEmergencyType(t.id)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                          isSelected ? t.color + ' ring-2 ring-red-500/50' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <Icon className="w-5 h-5 mb-1" />
                        <span className="text-[11px] font-bold leading-tight">{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">GPS Coordinates</label>
                  <button
                    type="button"
                    onClick={handleAutoDetectLocation}
                    disabled={detectingLocation}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>{detectingLocation ? 'Locating...' : 'Auto-Detect GPS'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={latitude}
                    onChange={(e) => setLatitude(parseFloat(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    placeholder="Latitude"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={longitude}
                    onChange={(e) => setLongitude(parseFloat(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    placeholder="Longitude"
                  />
                </div>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Landmark / Pickup Address"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-base shadow-xl shadow-red-600/40 transition flex items-center justify-center space-x-2"
              >
                <AlertTriangle className="w-5 h-5" />
                <span>{loading ? 'CALCULATING DISPATCH...' : 'TRIGGER IMMEDIATE SOS'}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-2">
            <LeafletMap
              center={[latitude, longitude]}
              zoom={13}
              activeEmergency={{
                pickup_latitude: latitude,
                pickup_longitude: longitude,
                caller_name: callerName,
                emergency_type: emergencyType,
                status: 'PREVIEW LOCATION',
              }}
              className="h-[520px] w-full"
            />
          </div>
        </div>
      )}
    </div>
  )
}
