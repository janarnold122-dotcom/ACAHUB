// src/api/axios.js - Central Axios Configuration
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token & User headers
api.interceptors.request.use(
  (config) => {
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('lccb_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      try {
        const rawUser = localStorage.getItem('lccb_session_user');
        if (rawUser) {
          const user = JSON.parse(rawUser);
          if (user?.role) config.headers['x-user-role'] = user.role;
          if (user?.id) config.headers['x-user-id'] = String(user.id);
          if (user?.college_id) config.headers['x-user-college'] = String(user.college_id);
        }
      } catch {}
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Unwrap data & format error messages
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected network error occurred';
    return Promise.reject(new Error(message));
  }
);

export default api;
