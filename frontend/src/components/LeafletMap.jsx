import React, { useEffect, useRef } from 'react'
import L from 'leaflet'

function createDivIcon(bgClass, iconSvg, badgeText = '') {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-10 h-10 rounded-full ${bgClass} border-2 border-white shadow-2xl flex items-center justify-center text-white text-base">
          ${iconSvg}
        </div>
        ${badgeText ? `<div class="absolute -bottom-2 bg-slate-900 border border-slate-700 text-[10px] text-white px-1.5 py-0.2 rounded font-mono whitespace-nowrap shadow">${badgeText}</div>` : ''}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  })
}

const callerIcon = createDivIcon(
  'bg-red-600 animate-pulse',
  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
  'CALLER SOS'
)

const ambulanceAvailableIcon = (label) =>
  createDivIcon(
    'bg-emerald-600',
    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
    label
  )

const ambulanceBusyIcon = (label) =>
  createDivIcon(
    'bg-amber-500 animate-bounce',
    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
    label
  )

const hospitalIcon = (label) =>
  createDivIcon(
    'bg-blue-600',
    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12"/><path d="M6 12h12"/><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
    label
  )

export default function LeafletMap({
  center = [26.8467, 80.9462],
  zoom = 13,
  ambulances = [],
  hospitals = [],
  activeEmergency = null,
  routePoints = [],
  className = 'h-96 w-full',
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersLayerRef = useRef(null)
  const routeLayerRef = useRef(null)

  useEffect(() => {
    if (!mapContainerRef.current) return

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      markersLayerRef.current = L.layerGroup().addTo(map)
      routeLayerRef.current = L.layerGroup().addTo(map)
      mapInstanceRef.current = map
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return

    markersLayerRef.current.clearLayers()

    hospitals.forEach((h) => {
      if (!h.latitude || !h.longitude) return
      const marker = L.marker([h.latitude, h.longitude], {
        icon: hospitalIcon(h.name.split(' ')[0]),
      })
      const resourcesHtml = h.resources
        ? h.resources
            .map(
              (r) =>
                `<div class="flex justify-between text-xs py-0.5"><span>${r.resource_type}:</span><strong class="${r.available_count > 0 ? 'text-emerald-400' : 'text-red-400'}">${r.available_count} avail</strong></div>`
            )
            .join('')
        : ''

      marker.bindPopup(`
        <div class="p-1 min-w-[200px]">
          <h4 class="font-bold text-sm text-slate-900">${h.name}</h4>
          <p class="text-xs text-slate-500 mb-2">${h.address}</p>
          <div class="border-t border-slate-200 pt-1">
            ${resourcesHtml}
          </div>
        </div>
      `)
      markersLayerRef.current.addLayer(marker)
    })

    ambulances.forEach((a) => {
      if (!a.current_latitude || !a.current_longitude) return
      const isBusy = a.status !== 'AVAILABLE'
      const icon = isBusy
        ? ambulanceBusyIcon(a.vehicle_number)
        : ambulanceAvailableIcon(a.vehicle_number)

      const marker = L.marker([a.current_latitude, a.current_longitude], { icon })
      marker.bindPopup(`
        <div class="p-1 min-w-[160px]">
          <h4 class="font-bold text-sm text-slate-900">${a.vehicle_number}</h4>
          <p class="text-xs text-slate-600">Type: ${a.vehicle_type}</p>
          <p class="text-xs font-semibold ${isBusy ? 'text-amber-600' : 'text-emerald-600'}">Status: ${a.status}</p>
        </div>
      `)
      markersLayerRef.current.addLayer(marker)
    })

    if (activeEmergency && activeEmergency.pickup_latitude && activeEmergency.pickup_longitude) {
      const callerMarker = L.marker(
        [activeEmergency.pickup_latitude, activeEmergency.pickup_longitude],
        { icon: callerIcon }
      )
      callerMarker.bindPopup(`
        <div class="p-1 min-w-[160px]">
          <h4 class="font-bold text-sm text-red-600">Emergency SOS</h4>
          <p class="text-xs text-slate-800">Caller: ${activeEmergency.caller_name}</p>
          <p class="text-xs text-slate-600">Type: ${activeEmergency.emergency_type}</p>
          <p class="text-xs font-semibold text-red-600">Status: ${activeEmergency.status}</p>
        </div>
      `)
      markersLayerRef.current.addLayer(callerMarker)
    }

    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers()
      if (routePoints && routePoints.length >= 2) {
        const polyline = L.polyline(routePoints, {
          color: '#ef4444',
          weight: 4,
          opacity: 0.8,
          dashArray: '8, 8',
        })
        routeLayerRef.current.addLayer(polyline)
      }
    }
  }, [ambulances, hospitals, activeEmergency, routePoints])

  return <div ref={mapContainerRef} className={`${className} rounded-xl overflow-hidden border border-slate-700 shadow-xl`} />
}
