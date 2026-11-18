/**
 * ============================================================
 *  LCCB Academic Affairs — Shared Data Context
 *  Central store for sections, schedules, faculty, rooms, courses.
 *  Any component that mutates data calls `notifyDataChanged()` or
 *  dispatches the 'lccb-data-changed' window event to trigger a
 *  global refresh, so all roles instantly see updates.
 * ============================================================
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from './mockDb';

const DataContext = createContext(null);

/**
 * Dispatch a global event so all DataProvider instances (e.g. multiple
 * browser tabs sharing localStorage) re-fetch fresh data.
 */
export function notifyDataChanged() {
  window.dispatchEvent(new CustomEvent('lccb-data-changed'));
}

export function DataProvider({ children }) {
  const [sections, setSections]   = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [faculty, setFaculty]     = useState([]);
  const [rooms, setRooms]         = useState([]);
  const [courses, setCourses]     = useState([]);
  const [colleges, setColleges]   = useState([]);
  const [auditLog, setAuditLog]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [dbError, setDbError]     = useState(null);
  const fetchingRef               = useRef(false);

  const fetchAll = useCallback(async () => {
    // Prevent overlapping fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const [
        sectionsData,
        schedulesData,
        facultyData,
        roomsData,
        coursesData,
        collegesData,
        auditData,
      ] = await Promise.all([
        api('/sections'),
        api('/schedules'),
        api('/faculty'),
        api('/rooms'),
        api('/courses'),
        api('/colleges'),
        api('/audit-log'),
      ]);
      setSections(sectionsData   || []);
      setSchedules(schedulesData || []);
      setFaculty(facultyData     || []);
      setRooms(roomsData         || []);
      setCourses(coursesData     || []);
      setColleges(collegesData   || []);
      setAuditLog(auditData      || []);
      setDbError(null);
    } catch (err) {
      console.error('[DataContext] Database connection error:', err);
      setDbError(err.message || 'Cannot connect to MySQL database.');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Initial load
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Listen for data-change events (from any component or tab)
  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener('lccb-data-changed', handler);
    return () => {
      window.removeEventListener('lccb-data-changed', handler);
    };
  }, [fetchAll]);

  const value = {
    sections,
    schedules,
    faculty,
    rooms,
    courses,
    colleges,
    auditLog,
    loading,
    dbError,
    refresh: fetchAll,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/** Hook to consume the shared data context */
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
