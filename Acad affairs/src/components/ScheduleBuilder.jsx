import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DAYS, DB, logAction, api } from '../data/mockDb';
import { notifyDataChanged } from '../data/DataContext';
import { Badge, statusBadge } from './Badge';

/* ===================== Scheduling Engine ===================== */
export function ScheduleBuilder({actor, colleges, currentUser}) {
  const [sections,setSections] = useState([]);
  const [schedules,setSchedules] = useState([]);
  const [rooms,setRooms] = useState([]);
  const [faculty,setFaculty] = useState([]);
  const [collegeFilter,setCollegeFilter] = useState(currentUser?.college_id ? String(currentUser.college_id) : "");
  const [modalSection,setModalSection] = useState(null);
  const [showNewSection,setShowNewSection] = useState(false);
  const [form,setForm] = useState({day_of_week:"Mon", start_time:"08:00", end_time:"09:30", room_id:"", faculty_id:""});
  const [newSectionForm,setNewSectionForm] = useState({course_code:"", course_title:"", section_code:"", program:"", expected_students:30});
  const [conflicts,setConflicts] = useState([]);
  const [autoResult,setAutoResult] = useState(null);
  const [busy,setBusy] = useState(false);

  const reload = useCallback(()=>{
    const q = collegeFilter ? `?college_id=${collegeFilter}` : "";
    api("/sections"+q).then(setSections);
    api("/schedules"+q).then(setSchedules);
    api("/rooms").then(setRooms);
    api("/faculty").then(setFaculty);
  },[collegeFilter]);
  useEffect(reload,[reload]);

  const schedByCourse = useMemo(()=>{
    const m = {};
    schedules.forEach(s=>{ m[s.section_id] = s; });
    return m;
  },[schedules]);

  const pendingSections = sections.filter(s=>!schedByCourse[s.id]);

  function openModal(section){
    setModalSection(section);
    setConflicts([]);
    setForm({day_of_week:"Mon", start_time:"08:00", end_time:"09:30", room_id: rooms[0]?.id||"", faculty_id: faculty[0]?.id||""});
  }

  async function checkConflicts(){
    const res = await api("/schedules/check-conflicts", {method:"POST", body: JSON.stringify({
      section_id: modalSection.id, day_of_week: form.day_of_week, start_time: form.start_time,
      end_time: form.end_time, room_id: Number(form.room_id), faculty_id: Number(form.faculty_id),
    })});
    const conflictList = Array.isArray(res) ? res : (res?.conflicts || res?.data || []);
    setConflicts(conflictList);
    return conflictList;
  }

  async function saveSchedule(force=false){
    setBusy(true);
    try{
      await api("/schedules", {method:"POST", body: JSON.stringify({
        section_id: modalSection.id, day_of_week: form.day_of_week, start_time: form.start_time,
        end_time: form.end_time, room_id: Number(form.room_id), faculty_id: Number(form.faculty_id),
        force, actor,
      })});
      setModalSection(null);
      reload();
      notifyDataChanged();
    } catch(e){
      if(e.data && e.data.conflicts) setConflicts(e.data.conflicts);
    } finally { setBusy(false); }
  }

  async function runAutoGenerate(){
    setBusy(true);
    setAutoResult(null);
    try{
      const ids = pendingSections.map(s=>s.id);
      const res = await api("/schedules/auto-generate", {method:"POST", body: JSON.stringify({section_ids: ids, actor})});
      setAutoResult(res);
      reload();
      notifyDataChanged();
    } finally { setBusy(false); }
  }

  async function publishSchedule(schedId){
    await api(`/schedules/${schedId}/publish`, {method:"POST", body: JSON.stringify({actor})});
    reload();
    notifyDataChanged();
  }

  async function lockSchedule(schedId){
    await api(`/schedules/${schedId}/lock`, {method:"POST", body: JSON.stringify({actor})});
    reload();
    notifyDataChanged();
  }

  async function unlockSchedule(schedId){
    await api(`/schedules/${schedId}/unlock`, {method:"POST", body: JSON.stringify({actor})});
    reload();
    notifyDataChanged();
  }

  async function publishAllSchedules(){
    if(confirm("Publish and lock all schedule entries in the master timetable?")){
      await api("/schedules/publish-all", {method:"POST", body: JSON.stringify({actor})});
      reload();
      notifyDataChanged();
    }
  }

  function exportDatabaseSQL(){
    let sql = `-- ==============================================================================\n`;
    sql += `-- LCCB Academic Affairs Database Export (Published Master Timetable)\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += `-- ==============================================================================\n\n`;
    sql += `USE \`lccb_academic_affairs\`;\n\n`;
    sql += `-- 1. Update Sections to Published\n`;
    sql += `UPDATE \`sections\` SET \`status\` = 'published';\n\n`;
    sql += `-- 2. Master Published Timetable Schedules\n`;
    sql += `TRUNCATE TABLE \`schedules\`;\n`;
    sql += `INSERT INTO \`schedules\` (\`id\`, \`section_id\`, \`faculty_id\`, \`room_id\`, \`day_of_week\`, \`start_time\`, \`end_time\`, \`status\`, \`is_locked\`) VALUES\n`;
    const rows = (schedules || []).map(s => `(${s.id}, ${s.section_id}, ${s.faculty_id || 'NULL'}, ${s.room_id || 'NULL'}, '${s.day_of_week}', '${s.start_time}:00', '${s.end_time}:00', '${s.status || 'scheduled'}', ${s.is_locked ? 1 : 0})`);
    sql += rows.join(',\n') + ';\n\n';
    sql += `-- Verify published master timetable\n`;
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

  async function deleteSchedule(schedId){
    if(confirm("Are you sure you want to delete this schedule entry?")){
      try {
        await api(`/schedules/${schedId}`, { method: "DELETE" });
      } catch {
        DB.schedules = DB.schedules.filter(s=>s.id!==schedId);
      }
      logAction(actor, "Deleted schedule entry", `Schedule ID ${schedId}`);
      reload();
      notifyDataChanged();
    }
  }

  async function deleteSection(sectionId, courseCode, sectionCode){
    if(confirm(`Are you sure you want to delete section ${courseCode} ${sectionCode}?`)){
      try {
        await api(`/sections/${sectionId}`, { method: "DELETE" });
      } catch {
        DB.sections = DB.sections.filter(s=>s.id!==sectionId);
        DB.schedules = DB.schedules.filter(s=>s.section_id!==sectionId);
      }
      logAction(actor, "Deleted section", `${courseCode} ${sectionCode}`);
      reload();
      notifyDataChanged();
    }
  }

  async function submitNewSection(e){
    e.preventDefault();
    const selectedCollege = colleges.find(c=>c.id===Number(collegeFilter));
    DB.sections.push({
      id:DB.nextIds.section++,
      course_id:1,
      course_code:newSectionForm.course_code,
      course_title:newSectionForm.course_title,
      section_code:newSectionForm.section_code,
      term:"1st Sem 2026-2027",
      program:newSectionForm.program,
      expected_students:Number(newSectionForm.expected_students),
      status:"pending",
      college_id:Number(collegeFilter)
    });
    logAction(actor, "Created new section", `${newSectionForm.course_code} ${newSectionForm.section_code}`);
    setShowNewSection(false);
    setNewSectionForm({course_code:"", course_title:"", section_code:"", program:"", expected_students:30});
    reload();
  }

  return (
    <div>
      <div className="toolbar">
        <select value={collegeFilter} onChange={e=>setCollegeFilter(e.target.value)}>
          <option value="">All colleges</option>
          {colleges.map(c=><option key={c.id} value={c.id}>{c.code} &mdash; {c.name}</option>)}
        </select>
        <button className="btn btn-primary" disabled={busy || pendingSections.length===0} onClick={runAutoGenerate}>
          {busy ? "Generating…" : `Auto-generate schedule (${pendingSections.length} pending)`}
        </button>
        <button className="btn btn-primary" style={{background:"var(--success)", borderColor:"var(--success)"}} onClick={publishAllSchedules}>
          ✓ Publish all timetable
        </button>
        <button className="btn" onClick={()=>setShowNewSection(true)}>+ New section</button>
        <button className="btn" onClick={exportDatabaseSQL}>📥 Export Database (SQL)</button>
        <span className="hint" style={{color:"var(--slate)", fontSize:12}}>Greedy solver places sections into the first conflict-free room / faculty / time slot.</span>
      </div>

      {autoResult && (
        <div className="card" style={{marginBottom:16, borderColor: autoResult.failed.length? "#EFC5BE":"var(--line)"}}>
          <b style={{fontSize:13}}>Auto-generation result:</b> {autoResult.placed.length} placed, {autoResult.failed.length} could not be placed.
          {autoResult.failed.length>0 && (
            <ul style={{margin:"8px 0 0", paddingLeft:18, fontSize:12.5, color:"var(--alert)"}}>
              {autoResult.failed.map((f,i)=>(<li key={i}>{f.course_code} {f.section_code}: {f.reason}</li>))}
            </ul>
          )}
        </div>
      )}

      <div className="section-title"><h3>Master schedule</h3><span className="hint">{schedules.length} scheduled entries</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Course</th><th>Section</th><th>Day</th><th>Time</th><th>Room</th><th>Faculty</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {schedules.map(s=>(
              <tr key={s.id}>
                <td className="mono">{s.course_code}</td>
                <td>{s.section_code}</td>
                <td>{s.day_of_week}</td>
                <td className="mono">{s.start_time}&ndash;{s.end_time}</td>
                <td>{s.room_name} {s.expected_students>s.room_capacity && <Badge kind="alert">over cap</Badge>}</td>
                <td>{s.faculty_name}</td>
                <td>{statusBadge(s.status)}</td>
                <td>
                  <div style={{display:"flex", gap:"6px", flexWrap:"wrap"}}>
                    <button className="btn btn-sm" disabled={!!s.is_locked} style={s.is_locked?{opacity:.45, cursor:"not-allowed"}:{}} onClick={()=>lockSchedule(s.id)} title="Lock this entry">🔒 Lock</button>
                    <button className="btn btn-sm" disabled={!s.is_locked} style={!s.is_locked?{opacity:.45, cursor:"not-allowed"}:{}} onClick={()=>unlockSchedule(s.id)} title="Unlock this entry">🔓 Unlock</button>
                    {s.status!=="published" && (
                      <button className="btn btn-sm btn-primary" onClick={()=>publishSchedule(s.id)}>Publish &amp; lock</button>
                    )}
                    {!s.is_locked && s.status!=="published" && (
                      <button className="btn btn-sm" style={{color:"var(--alert)", borderColor:"var(--alert)"}} onClick={()=>deleteSchedule(s.id)}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {schedules.length===0 && <tr><td colSpan="8" className="empty"><div className="big">🗓️</div>No sections scheduled yet for this filter.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="section-title"><h3>Unscheduled sections</h3><span className="hint">Awaiting room / faculty / time assignment</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Course</th><th>Section</th><th>Program</th><th>Expected students</th><th>Actions</th></tr></thead>
          <tbody>
            {pendingSections.map(s=>(
              <tr key={s.id}>
                <td className="mono">{s.course_code}</td>
                <td>{s.section_code}</td>
                <td>{s.program}</td>
                <td>{s.expected_students}</td>
                <td style={{display:"flex", gap:"6px"}}>
                  <button className="btn btn-sm" onClick={()=>openModal(s)}>Assign manually</button>
                  <button className="btn btn-sm" style={{color:"var(--alert)", borderColor:"var(--alert)"}} onClick={()=>deleteSection(s.id, s.course_code, s.section_code)}>Delete</button>
                </td>
              </tr>
            ))}
            {pendingSections.length===0 && <tr><td colSpan="5" className="empty">All sections are scheduled. ✓</td></tr>}
          </tbody>
        </table>
      </div>

      {modalSection && (
        <div className="modal-overlay" onClick={(e)=>{if(e.target===e.currentTarget) setModalSection(null);}}>
          <div className="modal">
            <h3>Assign {modalSection.course_code} {modalSection.section_code}</h3>
            <div className="grid grid-2">
              <div className="field">
                <label>Day</label>
                <select value={form.day_of_week} onChange={e=>setForm({...form,day_of_week:e.target.value})}>
                  {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Room</label>
                <select value={form.room_id} onChange={e=>setForm({...form,room_id:e.target.value})}>
                  {rooms.length === 0 && <option value="">No rooms available</option>}
                  {rooms.map(r=><option key={r.id} value={r.id}>{r.name} (cap {r.capacity}, {r.room_type.replace('_',' ')})</option>)}
                </select>
              </div>
              <div className="field">
                <label>Start time</label>
                <input type="time" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})} />
              </div>
              <div className="field">
                <label>End time</label>
                <input type="time" value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})} />
              </div>
              <div className="field" style={{gridColumn:"1 / -1"}}>
                <label>Faculty</label>
                <select value={form.faculty_id} onChange={e=>setForm({...form,faculty_id:e.target.value})}>
                  {faculty.length === 0 && <option value="">No faculty available</option>}
                  {faculty.map(f=><option key={f.id} value={f.id}>{f.name} ({f.employment_status.replace('_',' ')})</option>)}
                </select>
              </div>
            </div>

            {conflicts.length>0 && (
              <div className="conflict-box">
                <div className="title">⚠ {conflicts.length} conflict(s) detected</div>
                <ul>{conflicts.map((c,i)=><li key={i}>{c.message}</li>)}</ul>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn" onClick={()=>setModalSection(null)}>Cancel</button>
              <button className="btn" onClick={checkConflicts}>Check conflicts</button>
              {conflicts.length>0
                ? <button className="btn btn-primary" style={{background:"var(--alert)", borderColor:"var(--alert)"}} disabled={busy} onClick={()=>saveSchedule(true)}>Save anyway (override)</button>
                : <button className="btn btn-primary" disabled={busy} onClick={()=>saveSchedule(false)}>Save schedule</button>}
            </div>
          </div>
        </div>
      )}

      {showNewSection && (
        <div className="modal-overlay" onClick={(e)=>{if(e.target===e.currentTarget) setShowNewSection(false);}}>
          <form className="modal" onSubmit={submitNewSection}>
            <h3>Create new section</h3>
            <div className="field">
              <label>Course code</label>
              <input required placeholder="e.g. IT301" value={newSectionForm.course_code} onChange={e=>setNewSectionForm({...newSectionForm,course_code:e.target.value})} />
            </div>
            <div className="field">
              <label>Course title</label>
              <input required placeholder="e.g. Database Management Systems" value={newSectionForm.course_title} onChange={e=>setNewSectionForm({...newSectionForm,course_title:e.target.value})} />
            </div>
            <div className="field">
              <label>Section code</label>
              <input required placeholder="e.g. IT-1A" value={newSectionForm.section_code} onChange={e=>setNewSectionForm({...newSectionForm,section_code:e.target.value})} />
            </div>
            <div className="field">
              <label>Program</label>
              <input placeholder="e.g. BSIT" value={newSectionForm.program} onChange={e=>setNewSectionForm({...newSectionForm,program:e.target.value})} />
            </div>
            <div className="field">
              <label>Expected students</label>
              <input required type="number" min="1" value={newSectionForm.expected_students} onChange={e=>setNewSectionForm({...newSectionForm,expected_students:e.target.value})} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={()=>setShowNewSection(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create section</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
