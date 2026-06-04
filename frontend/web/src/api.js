import axios from 'axios';

// This is the connection to your backend server.
// In production (Vercel), VITE_API_URL = https://&lt;ngrok-url&gt;/api
// The Flask ML server proxies all /api/* requests to the Java backend on :8080.
export const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
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
export const getMyLatestAlert = (userId) => API.get('/alerts/latest', { params: { userId } });
export const acknowledgeAlert = (id) => API.post(`/alerts/${id}/acknowledge`);
export const resolveAlert = (id) => API.post(`/alerts/${id}/resolve`);
export const escalateAlert = (id, params) => API.post(`/alerts/${id}/escalate`, params);
export const registerGuest = (data) => API.post('/users/register', data);
export const loginGuest = (data) => API.post('/users/login', data);
export const logout = () => API.post('/users/logout');

// --- TACTICAL PATHFINDING ---
export const getSafeHeading = (roomId, hazardId, vulnerability) => 
  API.get('/alerts/path', { params: { roomId, hazardId, vulnerability } });

// --- WEBRTC SIGNALING ---
export const sendSignal = (targetId, signal) => API.post(`/alerts/webrtc/signal/${targetId}`, signal);