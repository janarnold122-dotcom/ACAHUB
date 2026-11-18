import React, { useState, useEffect } from 'react';
import { DB, logAction, api } from '../data/mockDb';
import { notifyDataChanged } from '../data/DataContext';
import { Badge } from './Badge';

/* ===================== Faculty Load ===================== */
export function FacultyLoad({ currentUser, colleges = [] }) {
  const [loads,setLoads] = useState([]);
  const [showForm,setShowForm] = useState(false);
  const [collegeFilter, setCollegeFilter] = useState(currentUser?.college_id || "");
  const [form,setForm] = useState({name:"", email:"", status:"full_time", max_hours:24, college_id: currentUser?.college_id || 1});

  const availableColleges = (colleges && colleges.length > 0)
    ? colleges
    : [
        { id: 1, code: 'SBIT', name: 'School of Business and Information Technology' },
        { id: 2, code: 'SHTM', name: 'School of Hospitality and Tourism Management' },
        { id: 3, code: 'SSLATE', name: 'School of Sciences, Liberal Arts, and Teacher Education' },
        { id: 4, code: 'SARFAID', name: 'School of Architecture, Fine Arts and Interior Design' }
      ];

  useEffect(()=>{
    api("/faculty/load-summary").then((allLoads) => {
      let list = allLoads || [];
      const filterBy = collegeFilter ? Number(collegeFilter) : null;
      if (filterBy) {
        list = list.filter(l => l.college_id === filterBy);
      }
      setLoads(list);
    });
  },[collegeFilter]);

  async function submitFaculty(e){
    e.preventDefault();
    try {
      await api("/faculty", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          college_id: Number(form.college_id),
          employment_status: form.status,
          max_regular_hours: Number(form.max_hours),
          qualifications: "",
          preferred_days: "",
          preferred_start: "07:00",
          preferred_end: "19:00",
        })
      });
    } catch {
      const userId = DB.users.length+1;
      DB.users.push({
        id:userId,
        name:form.name,
        email:form.email,
        role:"faculty",
        college_id:Number(form.college_id),
        college_name: DB.colleges.find(c=>c.id===Number(form.college_id))?.name
      });
      DB.faculty.push({
        id:DB.faculty.length+1,
        user_id:userId,
        name:form.name,
        email:form.email,
        college_id:Number(form.college_id),
        employment_status:form.status,
        max_regular_hours:Number(form.max_hours),
        qualifications:"",
        preferred_days:"",
        preferred_start:"07:00",
        preferred_end:"19:00"
      });
    }
    logAction("VPAA", "Created new faculty member", form.name);
    setShowForm(false);
    setForm({name:"", email:"", status:"full_time", max_hours:24, college_id:1});
    api("/faculty/load-summary").then(setLoads);
    notifyDataChanged();
  }

  async function deleteFaculty(facultyId, facultyName){
    if(confirm(`Are you sure you want to delete ${facultyName}?`)){
      try {
        await api(`/faculty/${facultyId}`, { method: "DELETE" });
      } catch {
        DB.faculty = DB.faculty.filter(f=>f.id!==facultyId);
        DB.schedules = DB.schedules.filter(s=>s.faculty_id!==facultyId);
      }
      logAction("VPAA", "Deleted faculty member", facultyName);
      api("/faculty/load-summary").then(setLoads);
      notifyDataChanged();
    }
  }

  return (
    <div>
      <div className="toolbar">
        {availableColleges.length > 1 && (
          <select value={collegeFilter} onChange={e => setCollegeFilter(e.target.value)}>
            <option value="">All departments</option>
            {availableColleges.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        )}
        <button className="btn btn-primary" onClick={()=>setShowForm(true)}>+ Add faculty member</button>
      </div>

      <div className="section-title"><h3>Faculty load &amp; profile management</h3><span className="hint">Regular vs. overload hours per faculty member</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Faculty</th><th>Status</th><th>Classes</th><th>Hours (of max)</th><th>Load</th><th>Flag</th><th>Action</th></tr></thead>
          <tbody>
            {loads.map(f=>(
              <tr key={f.faculty_id}>
                <td>{f.faculty_name}</td>
                <td><Badge kind={f.employment_status==="full_time"?"neutral":"gold"}>{f.employment_status.replace('_',' ')}</Badge></td>
                <td>{f.class_count}</td>
                <td className="mono">{f.total_hours}h / {f.max_regular_hours}h</td>
                <td style={{minWidth:140}}>
                  <div className="load-bar-track"><div className={"load-bar-fill"+(f.is_overloaded?" over":"")} style={{width:`${Math.min(100,f.utilization_pct)}%`}}></div></div>
                </td>
                <td>{f.is_overloaded ? <Badge kind="alert">+{f.overload_hours}h overload</Badge> : <Badge kind="success">Within limit</Badge>}</td>
                <td>
                  <button className="btn btn-sm" style={{color:"var(--alert)", borderColor:"var(--alert)"}} onClick={()=>deleteFaculty(f.faculty_id, f.faculty_name)}>Delete</button>
                </td>
              </tr>
            ))}
            {loads.length===0 && <tr><td colSpan="7" className="empty">No faculty records yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={(e)=>{if(e.target===e.currentTarget) setShowForm(false);}}>
          <form className="modal" onSubmit={submitFaculty}>
            <h3>Add new faculty member</h3>
            <div className="field">
              <label>Full name</label>
              <input required placeholder="e.g. Prof. John Smith" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
            </div>
            <div className="field">
              <label>Email</label>
              <input required type="email" placeholder="e.g. john.smith@lccb.edu.ph" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
            </div>
            <div className="field">
              <label>Employment status</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
              </select>
            </div>
            <div className="field">
              <label>Max regular hours</label>
              <input required type="number" min="1" value={form.max_hours} onChange={e=>setForm({...form,max_hours:e.target.value})} />
            </div>
            <div className="field">
              <label>College</label>
              <select value={form.college_id} onChange={e=>setForm({...form,college_id:e.target.value})}>
                {availableColleges.map(c=><option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={()=>setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add faculty</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
