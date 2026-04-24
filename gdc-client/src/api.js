import axios from 'axios';

// This is the connection to your backend server
const API = axios.create({ baseURL: 'http://localhost:8080/api' });

// This adds your token to every request so the server knows who you are
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export const sendAlert = (data) => API.post('/alerts', data);
export const getAlerts = () => API.get('/alerts/active');
export const getAlertHistory = () => API.get('/alerts/history');
export const getMyLatestAlert = () => API.get('/alerts/latest');
export const acknowledgeAlert = (id) => API.post(`/alerts/${id}/acknowledge`);
export const dispatchAlert = (id) => API.post(`/alerts/${id}/dispatch`);
export const resolveAlert = (id) => API.post(`/alerts/${id}/resolve`);
export const registerGuest = (data) => API.post('/users/register', data);
export const loginGuest = (data) => API.post('/users/login', data);
export const logout = () => API.post('/users/logout');