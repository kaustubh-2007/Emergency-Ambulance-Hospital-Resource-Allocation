import React, { useState, useEffect } from 'react'
import { ambulanceAPI, emergencyAPI } from '../services/api'
import { createWebSocket } from '../services/websocket'
import LeafletMap from '../components/LeafletMap'
import {
  Ambulance,
  Radio,
  CheckCircle2,
  Navigation,
  MapPin,
  Building2,
  User,
  Phone,
  Play,
  RotateCcw,
} from 'lucide-react'

export default function DriverDashboard() {
  const [vehicle, setVehicle] = useState(null)
  const [activeMission, setActiveMission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [simulatingGPS, setSimulatingGPS] = useState(false)

  useEffect(() => {
    loadVehicleAndMission()
  }, [])

  useEffect(() => {
    if (!activeMission) return

    const ws = createWebSocket(
      `/ws/tracking/${activeMission.id}`,
      (data) => {
        if (data.event === 'STATUS_CHANGED') {
          setActiveMission((prev) => (prev ? { ...prev, status: data.new_status } : null))
        }
      }
    )

    return () => {
      ws.close()
    }
  }, [activeMission?.id])

  async function loadVehicleAndMission() {
    setLoading(true)
    try {
      const vRes = await ambulanceAPI.getMyVehicle()
      setVehicle(vRes.data)

      const mRes = await emergencyAPI.getMyActive()
      if (mRes.data) {
        setActiveMission(mRes.data)
      }
    } catch (e) {
      const fallback = await ambulanceAPI.list()
      if (fallback.data && fallback.data.length > 0) {
        setVehicle(fallback.data[0])
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleStatus(newStatus) {
    if (!vehicle) return
    try {
      const res = await ambulanceAPI.updateStatus(vehicle.id, { status: newStatus })
      setVehicle(res.data)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update vehicle status')
    }
  }

  async function handleAdvanceMission(nextStatus) {
    if (!activeMission) return
    try {
      const res = await emergencyAPI.updateStatus(activeMission.id, nextStatus)
      setActiveMission(res.data)
      if (nextStatus === 'COMPLETED') {
        setActiveMission(null)
        loadVehicleAndMission()
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update mission status')
    }
  }

  async function handleStepGPS() {
    if (!vehicle || !activeMission) return
    const targetLat = activeMission.status === 'EN_ROUTE_HOSPITAL' || activeMission.status === 'PICKED_UP'
      ? activeMission.hospital?.latitude || vehicle.current_latitude
      : activeMission.pickup_latitude
    const targetLon = activeMission.status === 'EN_ROUTE_HOSPITAL' || activeMission.status === 'PICKED_UP'
      ? activeMission.hospital?.longitude || vehicle.current_longitude
      : activeMission.pickup_longitude

    const nextLat = vehicle.current_latitude + (targetLat - vehicle.current_latitude) * 0.25
    const nextLon = vehicle.current_longitude + (targetLon - vehicle.current_longitude) * 0.25

    try {
      const res = await ambulanceAPI.updateTelemetry(vehicle.id, {
        latitude: parseFloat(nextLat.toFixed(6)),
        longitude: parseFloat(nextLon.toFixed(6)),
        speed_kmh: 45.0,
        heading: 180.0,
      })
      setVehicle(res.data)
    } catch (err) {
      // Ignored in demo step
    }
  }

  const mapAmbulance = vehicle ? [vehicle] : []
  const mapHospitals = activeMission?.hospital ? [activeMission.hospital] : []
  const routePoints = vehicle && activeMission
    ? [
        [vehicle.current_latitude, vehicle.current_longitude],
        [activeMission.pickup_latitude, activeMission.pickup_longitude],
        activeMission.hospital ? [activeMission.hospital.latitude, activeMission.hospital.longitude] : null,
      ].filter(Boolean)
    : []

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Ambulance className="w-8 h-8 text-amber-500" />
            Ambulance Paramedic Operations
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            In-vehicle navigation, mission dispatch alerts, and live telemetry broadcast.
          </p>
        </div>

        {vehicle && (
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <span className="text-xs font-semibold text-slate-400 px-2">Readiness:</span>
            {['AVAILABLE', 'BUSY', 'OFFLINE'].map((st) => (
              <button
                key={st}
                onClick={() => handleToggleStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  vehicle.status === st
                    ? st === 'AVAILABLE'
                      ? 'bg-emerald-600 text-white'
                      : st === 'BUSY'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unit Profile</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {vehicle?.vehicle_number || 'Loading...'}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Classification:</span>
                <span className="text-white font-medium">{vehicle?.vehicle_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">GPS Position:</span>
                <span className="text-white font-mono text-xs">
                  {vehicle?.current_latitude.toFixed(4)}, {vehicle?.current_longitude.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Status:</span>
                <span className="text-emerald-400 font-bold">{vehicle?.status}</span>
              </div>
            </div>
          </div>

          {activeMission ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-amber-500/40 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Radio className="w-5 h-5 text-amber-500 animate-pulse" />
                  <span className="font-black text-amber-400 text-sm tracking-wide">ACTIVE MISSION</span>
                </div>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                  {activeMission.status}
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-start space-x-3">
                  <User className="w-4 h-4 text-slate-400 mt-1" />
                  <div>
                    <div className="text-xs text-slate-400">Caller / Patient</div>
                    <div className="font-bold text-white">{activeMission.caller_name}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {activeMission.caller_phone}
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <MapPin className="w-4 h-4 text-red-400 mt-1" />
                  <div>
                    <div className="text-xs text-slate-400">Pickup Location</div>
                    <div className="font-medium text-white">{activeMission.pickup_address || 'Geocoded Coordinates'}</div>
                    <div className="text-xs font-mono text-slate-500">
                      {activeMission.pickup_latitude.toFixed(4)}, {activeMission.pickup_longitude.toFixed(4)}
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Building2 className="w-4 h-4 text-blue-400 mt-1" />
                  <div>
                    <div className="text-xs text-slate-400">Destination Hospital</div>
                    <div className="font-bold text-white">{activeMission.hospital?.name}</div>
                    <div className="text-xs text-emerald-400 font-mono">
                      Locked: {activeMission.allocated_resource_type}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2">
                <div className="text-xs text-slate-400 font-semibold mb-2">Trip Status Transitions</div>
                {activeMission.status === 'DISPATCHED' && (
                  <button
                    onClick={() => handleAdvanceMission('EN_ROUTE')}
                    className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-600/30 transition flex items-center justify-center gap-2"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>En Route to Patient</span>
                  </button>
                )}

                {activeMission.status === 'EN_ROUTE' && (
                  <button
                    onClick={() => handleAdvanceMission('PICKED_UP')}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Patient Onboard (Picked Up)</span>
                  </button>
                )}

                {activeMission.status === 'PICKED_UP' && (
                  <button
                    onClick={() => handleAdvanceMission('ARRIVED')}
                    className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-2"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Arrived at Emergency Dept</span>
                  </button>
                )}

                {activeMission.status === 'ARRIVED' && (
                  <button
                    onClick={() => handleAdvanceMission('COMPLETED')}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Handover & Free Unit</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStepGPS}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 flex items-center justify-center gap-2 transition"
                >
                  <Play className="w-3.5 h-3.5 text-amber-400" />
                  <span>Step Vehicle GPS Telemetry</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-base">Standby Mode</h3>
              <p className="text-xs text-slate-400">
                Awaiting automated dispatch assignment from the Central Allocation Engine.
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <LeafletMap
            center={vehicle ? [vehicle.current_latitude, vehicle.current_longitude] : [26.8467, 80.9462]}
            zoom={13}
            ambulances={mapAmbulance}
            hospitals={mapHospitals}
            activeEmergency={activeMission}
            routePoints={routePoints}
            className="h-[560px] w-full"
          />
        </div>
      </div>
    </div>
  )
}
