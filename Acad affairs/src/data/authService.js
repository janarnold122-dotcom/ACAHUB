/**
 * ============================================================
 *  LCCB Academic Affairs — Authentication Service
 *  Connects directly to PostgreSQL / Supabase Backend.
 * ============================================================
 */

/**
 * Authenticate a user by username + password via real Express/Supabase backend.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ success: boolean, user?: object, token?: string, error?: string }>}
 */
import api from '../api/axios.js';

export async function loginUser(username, password) {
  if (!username || !username.trim()) {
    return { success: false, error: "Username is required." };
  }
  if (!password) {
    return { success: false, error: "Password is required." };
  }

  try {
    const data = await api.post("/auth/login", {
      username: username.trim(),
      password,
    });

    if (data?.success && data?.user) {
      if (data.token) {
        localStorage.setItem("lccb_token", data.token);
      }
      return { success: true, user: data.user, token: data.token };
    }

    if (data?.message) {
      return { success: false, error: data.message };
    }

    return { 
      success: false, 
      error: `Server error. Ensure Supabase connection is active.` 
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || "Cannot connect to server. Please ensure backend and Supabase are running.",
    };
  }
}

/**
 * Persist the logged-in user to localStorage.
 * @param {object} user
 */
export function saveSession(user) {
  try {
    localStorage.setItem("lccb_session_user", JSON.stringify(user));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get active JWT token.
 * @returns {string}
 */
export function getToken() {
  try {
    return localStorage.getItem("lccb_token") || "";
  } catch {
    return "";
  }
}

/**
 * Load a previously saved session from localStorage.
 * @returns {object|null}
 */
export function loadSession() {
  try {
    const raw = localStorage.getItem("lccb_session_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Remove the current session from localStorage (logout).
 */
export function clearSession() {
  try {
    localStorage.removeItem("lccb_session_user");
    localStorage.removeItem("lccb_token");
  } catch {
    // Ignore
  }
}

/**
 * Returns users list (for admin/display use).
 * @returns {Promise<object[]>}
 */
export async function getAllUsers() {
  try {
    const res = await api.get('/users');
    // Backend returns { success: true, data: [...] }
    return res?.data || [];
  } catch {
    return [];
  }
}
