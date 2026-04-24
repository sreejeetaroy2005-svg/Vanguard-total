import axios from 'axios';

// This is the connection to your backend server
// We use window.location.hostname to support LAN/Mesh environments where the IP might change
const baseURL = typeof window !== 'undefined' ? `http://${window.location.hostname || 'localhost'}:8080/api` : 'http://localhost:8080/api';
const API = axios.create({ baseURL });

// This adds your token to every request so the server knows who you are
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export const sendAlert = (data) => API.post('/alerts', data);
export const getAlerts = (hotelId) => API.get('/alerts/active', { params: { hotelId } });
export const getAlertHistory = (hotelId) => API.get('/alerts/history', { params: { hotelId } });
export const getMyLatestAlert = () => API.get('/alerts/latest');
export const acknowledgeAlert = (id) => API.post(`/alerts/${id}/acknowledge`);
export const dispatchAlert = (id) => API.post(`/alerts/${id}/dispatch`);
export const resolveAlert = (id) => API.post(`/alerts/${id}/resolve`);
export const broadcastMessage = (hotelId, message) => API.post('/alerts/broadcast', { hotelId, message });
export const registerGuest = (data) => API.post('/users/register', data);
export const loginGuest = (data) => API.post('/users/login', data);
export const logout = () => API.post('/users/logout');