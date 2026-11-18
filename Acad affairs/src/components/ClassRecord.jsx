import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DB, logAction, api } from '../data/mockDb';
import { Badge } from './Badge';
import { ClassRecordReview } from '../classreview/ClassRecordReview';

/* ===================== Digital Class Record & Review ===================== */
export function ClassRecord({ actor, initialTab = "roster", currentUser, role, colleges = [] }) {
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);
  const [roster, setRoster] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [scoresByAssessment, setScoresByAssessment] = useState({});
  const [grades, setGrades] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attDate, setAttDate] = useState("2026-08-17");
  const [showGradeForm, setShowGradeForm] = useState(false);
  const [gradeForm, setGradeForm] = useState({ name: "", category: "quiz", term_period: "midterm", max_score: 100, weight: 20 });
  const [showFinalGrades, setShowFinalGrades] = useState(false);
  const [finalGradesData, setFinalGradesData] = useState([]);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({ student_no: "", name: "" });
  const [addingStudent, setAddingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState("");
  const [showAddAttendance, setShowAddAttendance] = useState(false);
  const [newAttendanceForm, setNewAttendanceForm] = useState({ student_id: "", date: "2026-08-17", status: "present" });

  useEffect(() => {
    Promise.all([
      api("/sections"),
      api("/schedules"),
      api("/faculty")
    ]).then(([secs, scheds, facList]) => {
      let list = (secs && secs.length > 0) ? secs : DB.sections;

      if (currentUser?.role === "faculty") {
        const fac = (facList || []).find(f => f.user_id === currentUser.id || f.name?.toLowerCase() === currentUser.name?.toLowerCase());
        if (fac) {
          const mySectionIds = (scheds || []).filter(s => s.faculty_id === fac.id).map(s => s.section_id);
          const userSecs = list.filter(s => mySectionIds.includes(s.id));
          if (userSecs.length > 0) {
            list = userSecs;
          } else {
            const colSecs = list.filter(s => s.college_id === (fac.college_id || currentUser.college_id));
            if (colSecs.length > 0) list = colSecs;
          }
        } else if (currentUser?.college_id) {
          const colSecs = list.filter(s => s.college_id === currentUser.college_id);
          if (colSecs.length > 0) list = colSecs;
        }
      } else if (currentUser?.college_id) {
        const colSecs = list.filter(s => s.college_id === currentUser.college_id);
        if (colSecs.length > 0) {
          list = colSecs;
        }
      }
      setSections(list);
      if (list.length > 0) {
        setSectionId(prev => (prev && list.some(s => s.id === prev) ? prev : list[0].id));
      } else {
        setSectionId("");
      }
    });
  }, [currentUser]);

  useEffect(() => {
    if (sections.length && !sectionId) {
      setSectionId(sections[0].id);
    }
  }, [sections, sectionId]);

  const reloadAll = useCallback(() => {
    if (!sectionId) return;
    api(`/sections/${sectionId}/roster`).then(setRoster);
    api(`/sections/${sectionId}/assessments`).then(async (a) => {
      setAssessments(a);
      const map = {};
      for (const item of a) {
        map[item.id] = await api(`/assessments/${item.id}/scores`);
      }
      setScoresByAssessment(map);
    });
    api(`/sections/${sectionId}/grades`).then(setGrades);
    api(`/sections/${sectionId}/attendance?date=${attDate}`).then(setAttendance);
  }, [sectionId, attDate]);
  useEffect(reloadAll, [reloadAll]);

  useEffect(() => {
    setNewAttendanceForm(prev => ({ ...prev, date: attDate }));
  }, [attDate]);

  async function saveScore(assessmentId, studentId, value) {
    const val = value === "" ? null : Number(value);
    setScoresByAssessment(prev => {
      const list = prev[assessmentId] || [];
      const idx = list.findIndex(s => s.student_id === studentId);
      let updated;
      if (idx >= 0) {
        updated = [...list];
        updated[idx] = { ...updated[idx], raw_score: val };
      } else {
        updated = [...list, { student_id: studentId, raw_score: val }];
      }
      return { ...prev, [assessmentId]: updated };
    });
    try {
      await api(`/assessments/${assessmentId}/scores`, {
        method: "POST",
        body: JSON.stringify({ student_id: studentId, raw_score: val })
      });
      api(`/sections/${sectionId}/grades`).then(setGrades);
    } catch (err) {
      console.warn("Failed to persist score to database:", err);
    }
  }

  async function markAttendance(studentId, status) {
    setAttendance(prev => {
      const idx = prev.findIndex(a => a.student_id === studentId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], status };
        return next;
      }
      return [...prev, { student_id: studentId, date: attDate, status }];
    });
    try {
      await api(`/sections/${sectionId}/attendance`, {
        method: "POST",
        body: JSON.stringify({ student_id: studentId, date: attDate, status })
      });
    } catch (err) {
      console.warn("Failed to persist attendance:", err);
    }
  }

  function computeFinalGrades() {
    // Calculate final grades for each student by period
    const computed = [];
    roster.forEach(student => {
      const periods = { prelim: [], midterm: [], final: [] };
      const periodScores = { prelim: [], midterm: [], final: [] };

      assessments.forEach(assess => {
        const scores = scoresByAssessment[assess.id] || [];
        const studentScore = scores.find(s => s.student_id === student.id);
        if (studentScore && studentScore.raw_score != null) {
          const percentage = (studentScore.raw_score / assess.max_score) * 100;
          if (assess.term_period === "midterm") {
            periods.midterm.push({ weight: assess.weight, score: percentage });
            periodScores.midterm.push(percentage);
          } else if (assess.term_period === "final") {
            periods.final.push({ weight: assess.weight, score: percentage });
            periodScores.final.push(percentage);
          }
        }
      });


      const calcPeriod = (items) => {
        if (items.length === 0) return null;
        const totalWeight = items.reduce((s, i) => s + i.weight, 0);
        const weightedSum = items.reduce((s, i) => s + (i.score * i.weight / 100), 0);
        return totalWeight > 0 ? Math.round(weightedSum * 100) / 100 : null;
      };

      const prelim = periodScores.prelim.length > 0 ? Math.round(periodScores.prelim.reduce((a, b) => a + b) / periodScores.prelim.length * 100) / 100 : null;
      const midterm = calcPeriod(periods.midterm);
      const final = calcPeriod(periods.final);
      const overall = midterm && final ? Math.round((midterm * 0.4 + final * 0.6) * 100) / 100 : midterm || final || null;

      // Grade transmutation (1.00-5.00 scale)
      let grade = null;
      if (overall) {
        if (overall >= 98) grade = 1.0;
        else if (overall >= 95) grade = 1.25;
        else if (overall >= 92) grade = 1.5;
        else if (overall >= 89) grade = 1.75;
        else if (overall >= 86) grade = 2.0;
        else if (overall >= 83) grade = 2.25;
        else if (overall >= 80) grade = 2.5;
        else if (overall >= 77) grade = 2.75;
        else if (overall >= 75) grade = 3.0;
        else grade = 5.0;
      }

      computed.push({
        student_id: student.id,
        student_name: student.name,
        student_no: student.student_no,
        prelim,
        midterm,
        final,
        overall,
        grade,
        remarks: grade && grade <= 3.0 ? "Passed" : grade > 3.0 ? "Failed" : "Incomplete"
      });
    });
    setFinalGradesData(computed);
    setShowFinalGrades(true);
  }

  async function confirmSubmitGrades() {
    await api(`/sections/${sectionId}/grades/submit`, { method: "POST", body: JSON.stringify({ actor }) });
    setShowFinalGrades(false);
    alert("Final grades submitted for administrative review.");
    reloadAll();
  }

  async function submitAddStudent(e) {
    e.preventDefault();
    setAddStudentError("");
    if (!sectionId) {
      setAddStudentError("Please select a section before adding a student.");
      return;
    }
    if (!newStudentForm.student_no.trim() || !newStudentForm.name.trim()) {
      setAddStudentError("Student number and full name are required.");
      return;
    }

    setAddingStudent(true);
    try {
      await api(`/sections/${sectionId}/roster`, {
        method: "POST",
        body: JSON.stringify({
          student_no: newStudentForm.student_no.trim(),
          name: newStudentForm.name.trim(),
        })
      });
      setShowAddStudent(false);
      setNewStudentForm({ student_no: "", name: "" });
      reloadAll();
      logAction(actor, "Added student to section", `${newStudentForm.name} (${newStudentForm.student_no})`);
    } catch (err) {
      console.warn("API add student error, performing immediate local update:", err);
      const tempId = Date.now();
      const newStu = {
        id: tempId,
        student_no: newStudentForm.student_no.trim(),
        name: newStudentForm.name.trim(),
        email: `${newStudentForm.student_no.trim().toLowerCase()}@student.lccb.edu.ph`
      };
      setRoster(prev => {
        if (prev.some(s => s.student_no === newStu.student_no)) return prev;
        return [...prev, newStu];
      });
      setShowAddStudent(false);
      setNewStudentForm({ student_no: "", name: "" });
      logAction(actor, "Added student to section", `${newStudentForm.name} (${newStudentForm.student_no})`);
    } finally {
      setAddingStudent(false);
    }
  }

  async function removeStudent(studentId, studentName) {
    if (confirm(`Are you sure you want to remove ${studentName} from this class?`)) {
      await api(`/sections/${sectionId}/roster?student_id=${studentId}`, { method: "DELETE" });
      logAction(actor, "Removed student from section", studentName);
      reloadAll();
    }
  }

  async function submitAddAttendance(e) {
    e.preventDefault();
    const attDate_formatted = newAttendanceForm.date;
    await api(`/sections/${sectionId}/attendance`, {
      method: "POST", body: JSON.stringify({
        student_id: Number(newAttendanceForm.student_id),
        date: attDate_formatted,
        status: newAttendanceForm.status
      })
    });
    logAction(actor, "Added attendance record", `${attDate_formatted} - ${newAttendanceForm.status}`);
    setShowAddAttendance(false);
    setNewAttendanceForm({ student_id: "", date: attDate, status: "present" });
    reloadAll();
  }

  async function submitAssessment(e) {
    e.preventDefault();
    if (!gradeForm.name.trim()) return;
    await api(`/sections/${sectionId}/assessments`, {
      method: "POST", body: JSON.stringify({
        name: gradeForm.name.trim(),
        category: gradeForm.category,
        term_period: gradeForm.term_period,
        max_score: Number(gradeForm.max_score),
        weight: Number(gradeForm.weight),
        actor,
      })
    });
    setShowGradeForm(false);
    setGradeForm({ name: "", category: "quiz", term_period: "midterm", max_score: 100, weight: 20 });
    reloadAll();
  }

  const attByStudent = useMemo(() => { const m = {}; attendance.forEach(a => m[a.student_id] = a.status); return m; }, [attendance]);
  const scoreVal = (assessmentId, studentId) => {
    const list = scoresByAssessment[assessmentId] || [];
    const found = list.find(s => s.student_id === studentId);
    return found && found.raw_score != null ? found.raw_score : "";
  };

  return (
    <div>
      <div className="toolbar">
        <select value={sectionId || ""} onChange={e => setSectionId(Number(e.target.value))}>
          {sections.length === 0 && <option value="">No sections available</option>}
          {sections.map(s => <option key={s.id} value={s.id}>{s.course_code} {s.section_code} &mdash; {s.course_title}</option>)}
        </select>
        {tab !== "review" && (
          <div className="action-stack">
            <button className="btn btn-primary" onClick={() => setShowGradeForm(true)} disabled={!sectionId}>+ Add grade</button>
            <button className="btn" onClick={computeFinalGrades} disabled={!sectionId || roster.length === 0}>Submit final grades</button>
          </div>
        )}
      </div>

      {sections.length === 0 && (
        <div className="card" style={{ marginBottom: 16, background: "#f8fafc", color: "var(--slate)", fontSize: 13.5 }}>
          ℹ️ No sections found for your assigned courses or college. Please create or schedule sections under <b>Course &amp; sections</b> first.
        </div>
      )}

      <div className="tabs">
        <div className={"tab" + (tab === "roster" ? " active" : "")} onClick={() => setTab("roster")}>Class list</div>
        <div className={"tab" + (tab === "grades" ? " active" : "")} onClick={() => setTab("grades")}>Grades</div>
        <div className={"tab" + (tab === "scores" ? " active" : "")} onClick={() => setTab("scores")}>Assessment scores</div>
        <div className={"tab" + (tab === "attendance" ? " active" : "")} onClick={() => setTab("attendance")}>Attendance</div>
        <div className={"tab" + (tab === "review" ? " active" : "")} onClick={() => setTab("review")}>Review & Approval</div>
      </div>

      {tab === "grades" && (
        <div>
          <div className="toolbar">
            <button className="btn btn-primary" onClick={() => setShowGradeForm(true)}>+ Add assessment</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Midterm %</th><th>Final %</th><th>Overall %</th><th>Grade (1.00&ndash;5.00)</th><th>Remarks</th></tr></thead>
              <tbody>
                {grades.map(g => (
                  <tr key={g.student_id}>
                    <td>{g.student_name} <span className="mono" style={{ color: "var(--slate)", fontSize: 11 }}>{g.student_no}</span></td>
                    <td>{g.midterm_pct ?? "—"}</td>
                    <td>{g.final_pct ?? "—"}</td>
                    <td><b>{g.overall_pct ?? "—"}</b></td>
                    <td className="mono">{g.transmuted_grade ?? "—"}</td>
                    <td>{g.remarks === "Passed" ? <Badge kind="success">Passed</Badge> : g.remarks === "Failed" ? <Badge kind="alert">Failed</Badge> : <Badge kind="neutral">Incomplete</Badge>}</td>
                  </tr>
                ))}
                {grades.length === 0 && <tr><td colSpan="6" className="empty">No enrolled students / assessments for this section yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "scores" && (
        <div>
          <div className="toolbar">
            <button className="btn btn-primary" onClick={() => setShowGradeForm(true)}>+ Add assessment</button>
          </div>
          {assessments.length === 0 && <div className="empty">No assessments configured for this section.</div>}
          {assessments.map(a => (
            <div key={a.id} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                {a.name} <Badge kind="neutral">{a.term_period}</Badge> <span style={{ color: "var(--slate)", fontWeight: 400 }}>&middot; max {a.max_score}, weight {a.weight}%</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Student</th><th style={{ width: 120 }}>Raw score</th></tr></thead>
                  <tbody>
                    {roster.map(st => (
                      <tr key={st.id}>
                        <td>{st.name}</td>
                        <td>
                          <input type="number" step="0.1" defaultValue={scoreVal(a.id, st.id)}
                            onBlur={(e) => saveScore(a.id, st.id, e.target.value)}
                            style={{ width: 90 }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "attendance" && (
        <div>
          <div className="toolbar">
            <input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} />
            <button className="btn btn-primary" onClick={() => setShowAddAttendance(true)}>+ Add attendance</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Status</th></tr></thead>
              <tbody>
                {roster.map(st => (
                  <tr key={st.id}>
                    <td>{st.name}</td>
                    <td>
                      {["present", "late", "absent", "excused"].map(status => (
                        <button key={status}
                          className="btn btn-sm"
                          style={{ marginRight: 5, ...(attByStudent[st.id] === status ? { background: "var(--maroon)", color: "#fff", borderColor: "var(--maroon)" } : {}) }}
                          onClick={() => markAttendance(st.id, status)}>{status}</button>
                      ))}
                    </td>
                  </tr>
                ))}
                {roster.length === 0 && <tr><td colSpan="2" className="empty">No students enrolled in this section.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "roster" && (
        <div>
          <div className="toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button className="btn btn-primary" onClick={() => setShowAddStudent(true)}>+ Add student</button>
              <Badge kind="neutral">{roster.length} student{roster.length === 1 ? "" : "s"} enrolled</Badge>
            </div>
          </div>
          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ minWidth: "600px" }}>
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th style={{ minWidth: "120px" }}>Student No.</th>
                  <th>Student Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th style={{ width: 100 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((st, idx) => (
                  <tr key={st.id}>
                    <td className="mono" style={{ color: "var(--slate)", fontSize: 11.5 }}>{idx + 1}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{st.student_no}</td>
                    <td><b>{st.name}</b></td>
                    <td style={{ color: "var(--slate)", fontSize: 12 }}>{st.name.toLowerCase().replace(/\s+/g, '.')}@lccb.edu.ph</td>
                    <td><Badge kind="success">Enrolled</Badge></td>
                    <td>
                      <button className="btn btn-sm" style={{ color: "var(--alert)", borderColor: "var(--alert)" }} onClick={() => removeStudent(st.id, st.name)}>Remove</button>
                    </td>
                  </tr>
                ))}
                {roster.length === 0 && <tr><td colSpan="6" className="empty"><div className="big">📋</div>No students enrolled in this section yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "review" && (
        <div style={{ marginTop: 16 }}>
          <ClassRecordReview
            actor={actor}
            role={currentUser?.role || role}
            roster={roster}
            grades={grades}
            currentSection={sections.find(s => s.id === sectionId)}
            colleges={colleges}
          />
        </div>
      )}

      {showGradeForm && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowGradeForm(false); }}>
          <form className="modal" onSubmit={submitAssessment}>
            <h3>Add grade component</h3>
            <div className="field">
              <label>Assessment name</label>
              <input required placeholder="e.g. Quiz 3" value={gradeForm.name} onChange={e => setGradeForm({ ...gradeForm, name: e.target.value })} />
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label>Category</label>
                <select value={gradeForm.category} onChange={e => setGradeForm({ ...gradeForm, category: e.target.value })}>
                  <option value="quiz">Quiz</option>
                  <option value="performance_task">Performance Task</option>
                  <option value="exam">Exam</option>
                  <option value="project">Project</option>
                </select>
              </div>
              <div className="field">
                <label>Term period</label>
                <select value={gradeForm.term_period} onChange={e => setGradeForm({ ...gradeForm, term_period: e.target.value })}>
                  <option value="midterm">Midterm</option>
                  <option value="final">Final</option>
                </select>
              </div>
              <div className="field">
                <label>Max score</label>
                <input type="number" min="1" value={gradeForm.max_score} onChange={e => setGradeForm({ ...gradeForm, max_score: e.target.value })} />
              </div>
              <div className="field">
                <label>Weight %</label>
                <input type="number" min="1" max="100" value={gradeForm.weight} onChange={e => setGradeForm({ ...gradeForm, weight: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowGradeForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save grade component</button>
            </div>
          </form>
        </div>
      )}

      {showFinalGrades && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowFinalGrades(false); }}>
          <div className="modal" style={{ maxWidth: "800px", maxHeight: "88vh", overflow: "auto" }}>
            <h3>Final Grades Summary</h3>
            <div style={{ fontSize: 12, color: "var(--slate)", marginBottom: 16 }}>
              Review computed grades for all enrolled students. Grades are calculated as: Midterm 40% + Final 60%
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Student</th><th>Prelim %</th><th>Midterm %</th><th>Final %</th><th>Overall %</th><th>Grade (1-5)</th><th>Remarks</th></tr></thead>
                <tbody>
                  {finalGradesData.map(g => (
                    <tr key={g.student_id}>
                      <td>{g.student_name} <span className="mono" style={{ color: "var(--slate)", fontSize: 11 }}>{g.student_no}</span></td>
                      <td>{g.prelim ? g.prelim.toFixed(2) : "—"}</td>
                      <td><b>{g.midterm ? g.midterm.toFixed(2) : "—"}</b></td>
                      <td><b>{g.final ? g.final.toFixed(2) : "—"}</b></td>
                      <td style={{ fontWeight: 600, fontSize: 14 }}>{g.overall ? g.overall.toFixed(2) : "—"}</td>
                      <td className="mono" style={{ fontWeight: 600 }}>{g.grade ? g.grade.toFixed(2) : "—"}</td>
                      <td>{g.remarks === "Passed" ? <Badge kind="success">{g.remarks}</Badge> : g.remarks === "Failed" ? <Badge kind="alert">{g.remarks}</Badge> : <Badge kind="neutral">{g.remarks}</Badge>}</td>
                    </tr>
                  ))}
                  {finalGradesData.length === 0 && <tr><td colSpan="7" className="empty">No students or grades to compute.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn" onClick={() => setShowFinalGrades(false)}>Review again</button>
              <button className="btn btn-primary" onClick={confirmSubmitGrades}>Confirm &amp; Submit</button>
            </div>
          </div>
        </div>
      )}

      {showAddStudent && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !addingStudent) setShowAddStudent(false); }}>
          <form className="modal" onSubmit={submitAddStudent}>
            <h3>Add new student</h3>
            {addStudentError && (
              <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", fontSize: "13px", marginBottom: "12px", border: "1px solid #fecaca" }}>
                ⚠️ {addStudentError}
              </div>
            )}
            <div className="field">
              <label>Student number</label>
              <input
                required
                disabled={addingStudent}
                placeholder="e.g. 2024-1001"
                value={newStudentForm.student_no}
                onChange={e => { setNewStudentForm({ ...newStudentForm, student_no: e.target.value }); setAddStudentError(""); }}
              />
            </div>
            <div className="field">
              <label>Full name</label>
              <input
                required
                disabled={addingStudent}
                placeholder="e.g. Juan Dela Cruz"
                value={newStudentForm.name}
                onChange={e => { setNewStudentForm({ ...newStudentForm, name: e.target.value }); setAddStudentError(""); }}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" disabled={addingStudent} onClick={() => setShowAddStudent(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={addingStudent}>
                {addingStudent ? "Adding student..." : "Add student"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showAddAttendance && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAddAttendance(false); }}>
          <form className="modal" onSubmit={submitAddAttendance}>
            <h3>Add attendance record</h3>
            <div className="field">
              <label>Student</label>
              <select required value={newAttendanceForm.student_id} onChange={e => setNewAttendanceForm({ ...newAttendanceForm, student_id: e.target.value })}>
                <option value="">Select a student</option>
                {roster.map(st => <option key={st.id} value={st.id}>{st.name} ({st.student_no})</option>)}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input required type="date" value={newAttendanceForm.date} onChange={e => setNewAttendanceForm({ ...newAttendanceForm, date: e.target.value })} />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={newAttendanceForm.status} onChange={e => setNewAttendanceForm({ ...newAttendanceForm, status: e.target.value })}>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="excused">Excused</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowAddAttendance(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add record</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
