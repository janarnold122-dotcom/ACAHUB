// src/data/mockDb.js - Clean API Client (All fake mock data removed)
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const HOURS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", 
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

// Empty schema placeholder for legacy imports
export const DB = {
  colleges: [],
  users: [],
  rooms: [],
  faculty: [],
  courses: [],
  sections: [],
  schedules: [],
  students: [],
  enrollments: [],
  assessments: [],
  scores: [],
  attendance: [],
  auditLog: [],
  nextIds: {}
};

/**
 * Log an audit action directly to the backend
 */
export function logAction(user_name, action, details = "") {
  api("/audit-log", {
    method: "POST",
    body: { actor: user_name, action, details }
  }).catch(() => {});
}

import axiosInstance from '../api/axios.js';

/**
 * Central API fetcher communicating with the backend / Supabase via Axios
 */
export async function api(path, opts = {}) {
  const cleanPath = path.startsWith('/api') ? path.replace(/^\/api/, '') : path;
  const method = (opts.method || 'GET').toLowerCase();
  let body = opts.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {}
  }

  const res = await axiosInstance.request({
    url: cleanPath,
    method,
    data: body,
    headers: opts.headers || {},
  });

  // Backend returns { success: true, data: [...] } envelopes.
  // The Axios interceptor already returns the full body as `res`.
  // Unwrap the .data field when present so callers receive the array/object directly.
  if (res !== null && typeof res === 'object' && 'data' in res && 'success' in res) {
    return res.data;
  }
  return res;
}
