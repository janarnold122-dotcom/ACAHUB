import React, { useState, useEffect, useMemo } from 'react';
import { DAYS, api } from '../data/mockDb';
import { statusBadge } from './Badge';

/* ===================== Weekly timetable view (shared) ===================== */
export function TimetableView({ currentUser, colleges = [] }){
  const [allSchedules,setAllSchedules] = useState([]);
  const [allSections,setAllSections] = useState([]);
  const [collegeFilter, setCollegeFilter] = useState(currentUser?.college_id ? String(currentUser.college_id) : "");
  const [statusFilter,setStatusFilter] = useState("all");

  useEffect(()=>{
    Promise.all([
      api("/schedules"),
      api("/faculty"),
      api("/sections")
    ]).then(([scheds, facList, secList]) => {
      let list = scheds || [];
      if (currentUser?.role === "faculty") {
        const fac = facList.find(f => f.user_id === currentUser.id || f.name === currentUser.name);
        if (fac) {
          list = list.filter(s => s.faculty_id === fac.id);
        }
      }
      setAllSchedules(list);
      setAllSections(secList || []);
    });
  },[currentUser]);

  const schedules = useMemo(() => {
    let list = allSchedules;
    const filterById = collegeFilter ? Number(collegeFilter) : null;
    if (filterById) {
      list = list.filter(s => {
        const sec = allSections.find(x => x.id === s.section_id);
        return sec && sec.college_id === filterById;
      });
    }
    return list;
  }, [allSchedules, allSections, collegeFilter]);

  const filtered = useMemo(()=>{
    if(statusFilter==="all") return schedules;
    return schedules.filter(s=>s.status===statusFilter);
  },[schedules, statusFilter]);

  const byDay = useMemo(()=>{
    const m = {}; DAYS.forEach(d=>m[d]=[]);
    filtered.forEach(s=>{ if(m[s.day_of_week]) m[s.day_of_week].push(s); });
    return m;
  },[filtered]);

  function exportTimetableSQL(){
    let sql = `-- ==============================================================================\n`;
    sql += `-- LCCB Academic Affairs Database - Published Timetable Export\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += `-- ==============================================================================\n\n`;
    sql += `USE \`lccb_academic_affairs\`;\n\n`;
    sql += `-- 1. Update Sections Status\n`;
    sql += `UPDATE \`sections\` SET \`status\` = 'published';\n\n`;
    sql += `-- 2. Published Schedules\n`;
    sql += `TRUNCATE TABLE \`schedules\`;\n`;
    sql += `INSERT INTO \`schedules\` (\`id\`, \`section_id\`, \`faculty_id\`, \`room_id\`, \`day_of_week\`, \`start_time\`, \`end_time\`, \`status\`, \`is_locked\`) VALUES\n`;
    const rows = schedules.map(s => `(${s.id}, ${s.section_id}, ${s.faculty_id || 'NULL'}, ${s.room_id || 'NULL'}, '${s.day_of_week}', '${s.start_time}:00', '${s.end_time}:00', 'published', 1)`);
    sql += rows.join(',\n') + ';\n\n';
    sql += `-- Query published timetable view\n`;
    sql += `SELECT * FROM \`v_master_schedule\` WHERE \`schedule_status\` = 'published';\n`;

    const blob = new Blob([sql], { type: "text/sql;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lccb_published_timetable.sql";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="toolbar" style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div style={{display:"flex", gap:10, alignItems:"center"}}>
          {colleges.length > 0 && (
            <select 
              value={collegeFilter} 
              onChange={e => setCollegeFilter(e.target.value)}
              disabled={colleges.length === 1}
            >
              {colleges.length > 1 && <option value="">All departments</option>}
              {colleges.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          )}
          <label style={{fontSize:12, fontWeight:600, color:"var(--slate)"}}>Status:</label>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="all">All ({schedules.length})</option>
            <option value="published">Published ({schedules.filter(s=>s.status==="published").length})</option>
            <option value="draft">Drafts ({schedules.filter(s=>s.status==="draft").length})</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={exportTimetableSQL}>📥 Export Timetable to Database (SQL)</button>
      </div>

      <div className="section-title"><h3>Weekly master timetable</h3><span className="hint">{filtered.length} entries displayed ({schedules.filter(s=>s.status==="published").length} published)</span></div>
      <div className="schedule-grid">
        <div className="cell head"></div>
        {DAYS.map(d=><div key={d} className="cell head">{d}</div>)}
        <div className="cell time-label" style={{gridColumn:"1 / span 1"}}></div>
        {DAYS.map(d=>(
          <div key={d} className="cell" style={{minHeight:400}}>
            {byDay[d].sort((a,b)=>a.start_time.localeCompare(b.start_time)).map(s=>(
              <div key={s.id} className={"class-chip"+(s.status==="published"?" published":"")}>
                <div className="cc">{s.course_code} <span style={{fontWeight:400}}>({s.section_code})</span></div>
                <div>{s.start_time}&ndash;{s.end_time}</div>
                <div>{s.room_name}</div>
                <div style={{color:"var(--slate)"}}>{s.faculty_name}</div>
                <div style={{marginTop:2}}>{statusBadge(s.status)}</div>
              </div>
            ))}
            {byDay[d].length===0 && <div style={{color:"var(--slate)", fontSize:11, fontStyle:"italic", padding:4}}>No classes</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
