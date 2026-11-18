import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../data/mockDb';
import { notifyDataChanged } from '../data/DataContext';
import { Badge, statusBadge } from './Badge';

/* ===================== Course/Section requests (Dean/Chair) ===================== */
export function CourseSections({actor, colleges, defaultCollege}) {
  const [courses,setCourses] = useState([]);
  const [sections,setSections] = useState([]);
  const [collegeId,setCollegeId] = useState(defaultCollege || "");
  const [showForm,setShowForm] = useState(false);
  const [form,setForm] = useState({course_id:"", section_code:"", expected_students:30, program:""});

  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseForm, setCourseForm] = useState({
    code: "", title: "", units: 3, lecture_hours: 3, lab_hours: 0,
    requires_room_type: "lecture", description: "", prerequisites: "None"
  });

  const reload = useCallback(()=>{
    if(!collegeId) return;
    api(`/courses?college_id=${collegeId}`).then(setCourses);
    api(`/sections?college_id=${collegeId}`).then(setSections);
  },[collegeId]);
  useEffect(reload,[reload]);
  useEffect(() => {
    if (defaultCollege) {
      setCollegeId(defaultCollege);
    } else if (colleges.length && (!collegeId || !colleges.some(c => c.id === Number(collegeId)))) {
      setCollegeId(colleges[0].id);
    }
  }, [defaultCollege, colleges]);

  async function submitSection(e){
    e.preventDefault();
    await api("/sections",{method:"POST", body: JSON.stringify({
      course_id: Number(form.course_id), section_code: form.section_code,
      expected_students: Number(form.expected_students), program: form.program, actor,
    })});
    setShowForm(false);
    setForm({course_id:"", section_code:"", expected_students:30, program:""});
    reload();
    notifyDataChanged();
  }

  async function submitCourse(e){
    e.preventDefault();
    if(!courseForm.code.trim() || !courseForm.title.trim()) return;
    await api("/courses", {method:"POST", body: JSON.stringify({
      ...courseForm,
      college_id: Number(collegeId),
      actor,
    })});
    setShowCourseForm(false);
    setCourseForm({
      code: "", title: "", units: 3, lecture_hours: 3, lab_hours: 0,
      requires_room_type: "lecture", description: "", prerequisites: "None"
    });
    reload();
    notifyDataChanged();
  }

  async function deleteCourse(courseId, courseCode){
    if(confirm(`Are you sure you want to remove course ${courseCode}?`)){
      await api(`/courses/${courseId}`, { method: "DELETE" });
      reload();
      notifyDataChanged();
    }
  }

  return (
    <div>
      <div className="toolbar">
        <select value={collegeId} onChange={e=>setCollegeId(e.target.value)}>
          {colleges.length === 0 && <option value="">Loading colleges...</option>}
          {colleges.map(c=><option key={c.id} value={c.id}>{c.code} &mdash; {c.name}</option>)}
        </select>
        <div className="action-stack">
          <button className="btn btn-primary" onClick={()=>setShowCourseForm(true)}>+ Add subject</button>
          <button className="btn" onClick={()=>setShowForm(true)}>+ Request section</button>
        </div>
      </div>

      <div className="section-title"><h3>Course offerings</h3></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Title</th><th>Description</th><th>Prerequisites</th><th>Units</th><th>Lec/Lab hrs</th><th>Room type needed</th><th>Actions</th></tr></thead>
          <tbody>
            {courses.map(c=>(
              <tr key={c.id}>
                <td className="mono" style={{fontWeight:600}}>{c.code}</td>
                <td>{c.title}</td>
                <td style={{fontSize:"12px", color:"var(--slate)"}}>{c.description}</td>
                <td style={{fontSize:"12px"}}>{c.prerequisites}</td>
                <td>{c.units}</td>
                <td>{c.lecture_hours}/{c.lab_hours}</td>
                <td><Badge kind="neutral">{c.requires_room_type.replace('_',' ')}</Badge></td>
                <td>
                  <button className="btn btn-sm" style={{color:"var(--alert)", borderColor:"var(--alert)"}} onClick={()=>deleteCourse(c.id, c.code)}>Delete</button>
                </td>
              </tr>
            ))}
            {courses.length===0 && <tr><td colSpan="8" className="empty">No courses found for this college.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="section-title"><h3>Sections</h3><span className="hint">Status reflects the scheduling engine</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Course Code</th><th>Course Title</th><th>Section</th><th>Program</th><th>Expected Students</th><th>Term</th><th>Status</th></tr></thead>
          <tbody>
            {sections.map(s=>(
              <tr key={s.id}><td className="mono" style={{fontWeight:600}}>{s.course_code}</td><td>{s.course_title}</td><td>{s.section_code}</td>
                <td>{s.program}</td><td>{s.expected_students}</td><td style={{fontSize:"12px"}}>{s.term}</td><td>{statusBadge(s.status)}</td></tr>
            ))}
            {sections.length===0 && <tr><td colSpan="7" className="empty">No sections yet for this college.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal: Add Subject / Course */}
      {showCourseForm && (
        <div className="modal-overlay" onClick={(e)=>{if(e.target===e.currentTarget) setShowCourseForm(false);}}>
          <form className="modal" onSubmit={submitCourse}>
            <h3>Add new subject / course offering</h3>
            <div className="grid grid-2">
              <div className="field">
                <label>Course code</label>
                <input required placeholder="e.g. IT 312" value={courseForm.code} onChange={e=>setCourseForm({...courseForm,code:e.target.value})} />
              </div>
              <div className="field">
                <label>Units</label>
                <input type="number" min="1" max="10" required value={courseForm.units} onChange={e=>setCourseForm({...courseForm,units:e.target.value})} />
              </div>
            </div>
            <div className="field">
              <label>Course title</label>
              <input required placeholder="e.g. Mobile Application Development" value={courseForm.title} onChange={e=>setCourseForm({...courseForm,title:e.target.value})} />
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label>Lecture hours</label>
                <input type="number" min="0" required value={courseForm.lecture_hours} onChange={e=>setCourseForm({...courseForm,lecture_hours:e.target.value})} />
              </div>
              <div className="field">
                <label>Lab hours</label>
                <input type="number" min="0" required value={courseForm.lab_hours} onChange={e=>setCourseForm({...courseForm,lab_hours:e.target.value})} />
              </div>
            </div>
            <div className="field">
              <label>Required room type</label>
              <select value={courseForm.requires_room_type} onChange={e=>setCourseForm({...courseForm,requires_room_type:e.target.value})}>
                <option value="lecture">Lecture Hall / Standard Classroom</option>
                <option value="computer_lab">Computer Laboratory</option>
                <option value="science_lab">Science Laboratory</option>
              </select>
            </div>
            <div className="field">
              <label>Prerequisites</label>
              <input placeholder="e.g. IT 201 or None" value={courseForm.prerequisites} onChange={e=>setCourseForm({...courseForm,prerequisites:e.target.value})} />
            </div>
            <div className="field">
              <label>Description</label>
              <input placeholder="Course description and competencies" value={courseForm.description} onChange={e=>setCourseForm({...courseForm,description:e.target.value})} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={()=>setShowCourseForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save course offering</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Request Section */}
      {showForm && (
        <div className="modal-overlay" onClick={(e)=>{if(e.target===e.currentTarget) setShowForm(false);}}>
          <form className="modal" onSubmit={submitSection}>
            <h3>Request new section</h3>
            <div className="field">
              <label>Course</label>
              <select required value={form.course_id} onChange={e=>setForm({...form,course_id:e.target.value})}>
                <option value="">Select a course</option>
                {courses.map(c=><option key={c.id} value={c.id}>{c.code} &mdash; {c.title}</option>)}
              </select>
            </div>
            <div className="field"><label>Section code</label>
              <input required placeholder="e.g. IT-1C" value={form.section_code} onChange={e=>setForm({...form,section_code:e.target.value})} />
            </div>
            <div className="field"><label>Program</label>
              <input placeholder="e.g. BSIT" value={form.program} onChange={e=>setForm({...form,program:e.target.value})} />
            </div>
            <div className="field"><label>Expected students</label>
              <input type="number" min="1" required value={form.expected_students} onChange={e=>setForm({...form,expected_students:e.target.value})} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={()=>setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Submit request</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
