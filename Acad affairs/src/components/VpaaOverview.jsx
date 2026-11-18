import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../data/mockDb';

/* ===================== Overview / Analytics (VPAA) ===================== */
export function VpaaOverview({actor}) {
  const [data,setData] = useState(null);
  const [audit,setAudit] = useState([]);

  const fetchData = useCallback(() => {
    api("/analytics/overview").then(setData);
    api("/audit-log").then(setAudit);
  }, []);

  useEffect(() => {
    fetchData();
    window.addEventListener('lccb-data-changed', fetchData);
    return () => window.removeEventListener('lccb-data-changed', fetchData);
  }, [fetchData]);

  if(!data) return <div className="empty">Loading overview…</div>;

  
  const handleNavigate = (section) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: section }));
  };
  
  return (
    <div>
      <div className="grid grid-4">
        <div className="card stat-card">
          <div className="label">Total sections</div>
          <div className="value">{data.total_sections || 0}</div>
          <div className="sub">{data.pending_sections || 0} pending &middot; {data.scheduled_sections || 0} scheduled &middot; {data.published_sections || 0} published</div>
        </div>
        <div className={"card stat-card" + ((data.conflicted_schedules || 0) > 0 ? " flag" : "")}>
          <div className="label">Schedule conflicts</div>
          <div className="value">{data.conflicted_schedules || 0}</div>
          <div className="sub">Flagged by the conflict-detection engine</div>
        </div>
        <div className={"card stat-card" + ((data.overloaded_faculty || 0) > 0 ? " flag" : "")}>
          <div className="label">Overloaded faculty</div>
          <div className="value">{data.overloaded_faculty || 0} / {data.total_faculty || 0}</div>
          <div className="sub">{Array.isArray(data.overloaded_faculty_names) && data.overloaded_faculty_names.length > 0 ? data.overloaded_faculty_names.join(", ") : "None currently"}</div>
        </div>
        <div className="card stat-card">
          <div className="label">Avg. room utilization</div>
          <div className="value">{data.avg_room_utilization_pct || 0}%</div>
          <div className="sub">Across {data.total_rooms || 0} rooms, Mon&ndash;Sat</div>
        </div>
      </div>

      <div className="section-title"><h3>Quick actions</h3><span className="hint">Navigate to key management areas</span></div>
      <div className="action-grid">
        <div className="action-card" onClick={()=>window.dispatchEvent(new CustomEvent('navigate-tab', {detail:'scheduling'}))} style={{cursor:'pointer'}}>
          <div className="icon">▤</div>
          <div className="label">Scheduling engine</div>
          <div className="sub">Assign faculty & rooms</div>
        </div>
        <div className="action-card" onClick={()=>window.dispatchEvent(new CustomEvent('navigate-tab', {detail:'faculty'}))} style={{cursor:'pointer'}}>
          <div className="icon">◈</div>
          <div className="label">Faculty load</div>
          <div className="sub">Workload management</div>
        </div>
        <div className="action-card" onClick={()=>window.dispatchEvent(new CustomEvent('navigate-tab', {detail:'rooms'}))} style={{cursor:'pointer'}}>
          <div className="icon">▢</div>
          <div className="label">Room allocation</div>
          <div className="sub">Space utilization</div>
        </div>
        <div className="action-card" onClick={()=>window.dispatchEvent(new CustomEvent('navigate-tab', {detail:'timetable'}))} style={{cursor:'pointer'}}>
          <div className="icon">▦</div>
          <div className="label">Master timetable</div>
          <div className="sub">Weekly schedule view</div>
        </div>
      </div>

      <div className="section-title"><h3>Recent activity</h3><span className="hint">Audit trail &middot; latest 100 entries kept</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {audit.slice(0,12).map(a=>(
              <tr key={a.id}>
                <td className="mono" style={{color:"var(--slate)", fontSize:11.5}}>{new Date(a.timestamp).toLocaleString()}</td>
                <td>{a.user_name}</td>
                <td>{a.action}</td>
                <td style={{color:"var(--slate)"}}>{a.details}</td>
              </tr>
            ))}
            {audit.length===0 && <tr><td colSpan="4" className="empty">No activity yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
