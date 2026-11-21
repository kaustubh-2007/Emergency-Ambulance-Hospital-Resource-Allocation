import axios from 'axios'

const API = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authAPI = {
  login: (credentials) => API.post('/auth/login', credentials),
  register: (userData) => API.post('/auth/register', userData),
  getMe: () => API.get('/auth/me'),
}

export const ambulanceAPI = {
  list: (status) => API.get('/ambulances/', { params: status ? { status } : {} }),
  getMyVehicle: () => API.get('/ambulances/my-vehicle'),
  getById: (id) => API.get(`/ambulances/${id}`),
  updateStatus: (id, payload) => API.patch(`/ambulances/${id}/status`, payload),
  updateTelemetry: (id, telemetry) => API.patch(`/ambulances/${id}/telemetry`, telemetry),
}

export const hospitalAPI = {
  list: () => API.get('/hospitals/'),
  getMyHospital: () => API.get('/hospitals/my-hospital'),
  getById: (id) => API.get(`/hospitals/${id}`),
  updateResource: (hospitalId, resourceType, payload) =>
    API.put(`/hospitals/${hospitalId}/resources/${resourceType}`, payload),
  getAlerts: (hospitalId) => API.get(`/hospitals/${hospitalId}/alerts`),
}

export const emergencyAPI = {
  trigger: (data) => API.post('/emergencies/trigger', data),
  list: (status) => API.get('/emergencies/', { params: status ? { status } : {} }),
  getMyActive: () => API.get('/emergencies/my-active'),
  getById: (id) => API.get(`/emergencies/${id}`),
  updateStatus: (id, newStatus) =>
    API.patch(`/emergencies/${id}/status`, null, { params: { new_status: newStatus } }),
  override: (id, payload) => API.post(`/emergencies/${id}/override`, payload),
  cancel: (id) => API.post(`/emergencies/${id}/cancel`),
}

export default API
