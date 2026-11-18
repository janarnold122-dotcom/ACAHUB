import React, { useState, useEffect } from 'react';
import { DB, logAction, api } from '../data/mockDb';
import { Badge } from '../components/Badge';
import { CR_TERMS, CR_EQUIV, CR_FAIL, CR, crFmt, crGroup, crRating, crCompute, crBand, crAutoCheck } from './crEngine';

function EditBtn({isEditing, onToggle}){
  return <button className={"btn btn-sm"+(isEditing?" btn-primary":"")} onClick={onToggle}>{isEditing?"✔ Done":"✎ Edit"}</button>;
}

export function ClassRecordReview({actor, role, roster = [], grades = [], currentSection = null, colleges = []}) {
  const [, force] = useState(0);
  const rerender = ()=>force(n=>n+1);
  const [tab,setTab] = useState("dashboard");
  const [studentId,setStudentId] = useState(() => CR.students[0]?.id || "");
  const [msg,setMsg] = useState("");
  const [edit,setEdit] = useState({});
  const [armed,setArmed] = useState("");
  const TAB_LABEL = {info:"Class details", dashboard:"Dashboard", record:"Class record", student:"Student report", attendance:"Attendance", grading:"Grading system", checklist:"Review checklist"};

  useEffect(() => {
    if (roster && roster.length > 0) {
      const existingScores = new Map(CR.students.map(s => [s.student_no || s.name, s.scores]));
      CR.students = roster.map((st, idx) => ({
        id: st.id || idx + 1,
        name: st.name,
        student_no: st.student_no || "",
        scores: existingScores.get(st.student_no || st.name) || CR.assessments.map(() => null)
      }));
      setStudentId(prev => (prev && CR.students.some(s => s.id === prev) ? prev : CR.students[0]?.id || ""));
      rerender();
    } else if (roster && roster.length === 0) {
      CR.students = [];
      setStudentId("");
      rerender();
    }
  }, [roster]);

  useEffect(() => {
    if (currentSection) {
      const sub = `${currentSection.course_code || ''} ${currentSection.section_code || ''}`.trim();
      if (sub) CR.subject = sub;
      if (currentSection.course_title) CR.schedule = currentSection.course_title;
      if (currentSection.college_code) CR.access.department = currentSection.college_code;
      rerender();
    }
  }, [currentSection]);

  function toggleEdit(k){
    const on = !edit[k];
    setEdit({...edit, [k]:on});
    setArmed("");
    if(!on){ logAction(actor, "Edited class record", `${TAB_LABEL[k]} - ${CR.subject}`); setMsg(`${TAB_LABEL[k]} changes saved.`); }
    else setMsg("");
  }
  function confirmThen(key, fn){
    if(armed===key){ setArmed(""); fn(); rerender(); } else setArmed(key);
  }
  const numInput = {width:70};
  const canApprove = role==="vpaa" || role==="dean";

  /* ---- data mutations ---- */
  function setScore(st, i, raw){
    if(raw===""){ st.scores[i]=null; }
    else { const n = Number(raw); st.scores[i] = Math.max(0, Math.min(CR.assessments[i].items, Number.isFinite(n)?n:0)); }
    rerender();
  }
  function setItems(i, raw){
    const n = Math.max(1, Number(raw)||1);
    CR.assessments[i].items = n;
    CR.students.forEach(st=>{ if(st.scores[i]!=null && st.scores[i]>n) st.scores[i]=n; });
    rerender();
  }
  function addAssessment(){
    CR.assessments.push({term:CR_TERMS[0], type:"Performance Tasks", items:100});
    CR.students.forEach(st=>st.scores.push(null));
    rerender();
  }
  function removeAssessment(i){
    CR.assessments.splice(i,1);
    CR.students.forEach(st=>st.scores.splice(i,1));
  }
  function addStudent(){
    const id = CR.students.reduce((m,s)=>Math.max(m,s.id),0)+1;
    CR.students.push({id, name:"NEW STUDENT", scores:CR.assessments.map(()=>null)});
    rerender();
  }
  function removeStudent(id){
    CR.students = CR.students.filter(s=>s.id!==id);
    Object.keys(CR.attendance).forEach(k=>{ if(k.startsWith(id+":")) delete CR.attendance[k]; });
    delete CR.comments[id];
    if(Number(studentId)===id && CR.students.length) setStudentId(CR.students[0].id);
  }
  function addSession(){
    const id = CR.sessions.reduce((m,s)=>Math.max(m,s.id),0)+1;
    CR.sessions.push({id, label:`Session ${id}`});
    rerender();
  }
  function removeSession(id){
    CR.sessions = CR.sessions.filter(s=>s.id!==id);
    Object.keys(CR.attendance).forEach(k=>{ if(k.endsWith(":"+id)) delete CR.attendance[k]; });
  }

  const rows = CR.students.map(st=>({st, c:crCompute(st)}));
  const totals = rows.map(r=>r.c.total).filter(v=>v!=null);
  const avg = totals.length ? totals.reduce((x,y)=>x+y,0)/totals.length : null;
  const passCount = rows.filter(r=>r.c.pass===true).length;
  const failCount = rows.filter(r=>r.c.pass===false).length;
  const failedAny = rows.filter(r=>r.c.failedTerms>0).length;
  const periodAvg = t => { const v = rows.map(r=>r.c.term[t]).filter(x=>x!=null); return v.length ? v.reduce((x,y)=>x+y,0)/v.length : null; };
  const bands = ["Excellent","Very Good","Satisfactory","Needs Improvement"];
  const bandLabel = {"Excellent":"Excellent (90-100%)", "Very Good":"Very Good (80-89%)", "Satisfactory":`Satisfactory (${CR.threshold}-79%)`, "Needs Improvement":`Needs Improvement (<${CR.threshold}%)`};
  const bandColor = {"Excellent":"var(--success)", "Very Good":"var(--gold)", "Satisfactory":"var(--warn)", "Needs Improvement":"var(--alert)"};

  const checks = CR.checklist.map(it=> it.auto ? crAutoCheck(it.auto) : null);
  const allOk = CR.checklist.length>0 && CR.checklist.every(it=>it.status==="ok");
  const collegeCodes = (colleges && colleges.length > 0)
    ? colleges.map(c => c.code)
    : ["SBIT", "SHTM", "SSLATE", "SARFAID"];
  const wTotal = CR.types.reduce((s,k)=>s+Number(CR.weights[k]||0),0);
  const eqSorted = [...CR_EQUIV].sort((a,b)=>b.min-a.min);
  const eqCount = e => { const k = eqSorted.indexOf(e); const hi = k>0 ? eqSorted[k-1].min : Infinity; return rows.filter(r=>r.c.total!=null && r.c.total>=e.min && r.c.total<hi).length; };
  const failEqCount = rows.filter(r=>r.c.total!=null && r.c.total<Math.min(...CR_EQUIV.map(e=>e.min))).length;

  function decide(status){
    if(status==="approved" && !allOk){ setMsg("Every checklist item must be marked Passed before approval."); return; }
    const today = new Date().toISOString().slice(0,10);
    CR.decision = {...CR.decision, status, reviewer:actor, date:today};
    const label = status==="approved" ? "Approved class record" : status==="returned" ? "Returned class record for revision" : "Reset class record review to pending";
    logAction(actor, label, `${CR.subject} - ${CR.teacher}`);
    api("/class-records/1/review", {
      method: "POST",
      body: JSON.stringify({ status, remarks: CR.decision.remarks, reviewer_name: actor })
    }).catch(()=>{});
    setMsg(status==="approved" ? "Class record approved." : status==="returned" ? "Class record returned to the instructor for revision." : "Review reset to pending.");
    rerender();
  }
  function recordAccess(){
    CR.access.date = new Date().toISOString().slice(0,10);
    if(!CR.access.dean) CR.access.dean = actor;
    logAction(actor, "Accessed class record", `${CR.access.department} - ${CR.subject}`);
    rerender();
  }
  const decisionBadge = {pending:["Pending Review","warn"], approved:["Approved","success"], returned:["Returned for revision","alert"]}[CR.decision.status];
  const student = CR.students.find(s=>s.id===Number(studentId)) || CR.students[0] || null;
  const sc = student ? crCompute(student) : null;
  const shortType = t => ({"Attendance":"ATT","Journal Reflection":"JR","Performance Tasks":"PT","Examination":"EXAM"})[t] || t.slice(0,4).toUpperCase();
  const delBtn = (key, fn, title) => (
    <button className="btn btn-sm" style={{color:"var(--alert)", borderColor:"var(--alert)"}} title={title} onClick={()=>confirmThen(key, fn)}>{armed===key?"Sure?":"✕"}</button>
  );
  const taStyle = {width:"100%", fontFamily:"inherit", fontSize:13, padding:8, border:"1px solid var(--line)", borderRadius:8};

  return (
    <div>
      <div className="card" style={{marginBottom:16}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10}}>
          {!edit.info ? (
            <div style={{fontSize:13}}>
              <b>Teacher:</b> {CR.teacher} &nbsp;|&nbsp; <b>Subject:</b> {CR.subject} &nbsp;|&nbsp; <b>Department:</b> {CR.access.department} &nbsp;|&nbsp; <b>Schedule:</b> {CR.schedule}
            </div>
          ) : (
            <div style={{display:"flex", gap:8, flexWrap:"wrap", flex:1}}>
              <input style={{minWidth:200}} value={CR.teacher} placeholder="Teacher" onChange={e=>{CR.teacher=e.target.value; rerender();}} />
              <input style={{width:130}} value={CR.subject} placeholder="Subject" onChange={e=>{CR.subject=e.target.value; rerender();}} />
              <select value={CR.access.department} onChange={e=>{CR.access.department=e.target.value; rerender();}}>{collegeCodes.map(c=><option key={c} value={c}>{c}</option>)}</select>
              <input style={{minWidth:220}} value={CR.schedule} placeholder="Schedule" onChange={e=>{CR.schedule=e.target.value; rerender();}} />
            </div>
          )}
          <div style={{display:"flex", gap:8, alignItems:"center"}}>
            <EditBtn isEditing={!!edit.info} onToggle={()=>toggleEdit("info")} />
            <Badge kind={decisionBadge[1]}>{decisionBadge[0]}</Badge>
          </div>
        </div>
      </div>
      {msg && <div style={{marginBottom:12, fontSize:12.5, color:"var(--maroon-dark)"}}>{msg}</div>}

      <div className="tabs">
        {[["dashboard","Dashboard"],["record","Class record"],["student","Student report"],["attendance","Attendance"],["grading","Grading system"],["approval","Approval"]].map(([id,label])=>(
          <div key={id} className={"tab"+(tab===id?" active":"")} onClick={()=>{setTab(id); setMsg(""); setArmed("");}}>{label}</div>
        ))}
      </div>

      {tab==="dashboard" && (
        <div>
          <div className="grid grid-4">
            <div className="card stat-card"><div className="label">Class size</div><div className="value">{rows.length}</div></div>
            <div className="card stat-card"><div className="label">Class average</div><div className="value">{crFmt(avg)}</div><div className="sub">Average total grade</div></div>
            <div className="card stat-card"><div className="label">Highest score</div><div className="value">{crFmt(totals.length?Math.max(...totals):null)}</div></div>
            <div className="card stat-card flag"><div className="label">Lowest score</div><div className="value">{crFmt(totals.length?Math.min(...totals):null)}</div></div>
          </div>
          <div className="grid grid-3" style={{marginTop:16}}>
            <div className="card stat-card"><div className="label">Passing rate</div><div className="value">{rows.length?Math.round(passCount/rows.length*100):0}%</div></div>
            <div className="card stat-card"><div className="label">Pass / Fail</div><div className="value">{passCount} / {failCount}</div><div className="sub">Passing threshold: {CR.threshold}% · {failedAny} failed at least 1 term</div></div>
            <div className="card stat-card"><div className="label">Assessment period averages</div>
              <div style={{fontSize:13, marginTop:4, lineHeight:1.7}}>Prelim <b>{crFmt(periodAvg("Prelim"))}</b> &nbsp;·&nbsp; Midterm <b>{crFmt(periodAvg("Midterm"))}</b> &nbsp;·&nbsp; Final <b>{crFmt(periodAvg("Final"))}</b></div>
            </div>
          </div>

          <div className="grid grid-2" style={{marginTop:6}}>
            <div>
              <div className="section-title"><h3>Performance distribution</h3><span className="hint">By total grade</span></div>
              <div className="card">
                {bands.map(b=>{
                  const n = rows.filter(r=>crBand(r.c.total)===b).length;
                  return (
                    <div key={b} style={{marginBottom:10}}>
                      <div style={{display:"flex", justifyContent:"space-between", fontSize:12.5, marginBottom:4}}><span>{bandLabel[b]}</span><b>{n}</b></div>
                      <div style={{height:8, background:"#EFEBE1", borderRadius:99}}><div style={{height:8, width:(rows.length?n/rows.length*100:0)+"%", background:bandColor[b], borderRadius:99}}></div></div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="section-title"><h3>Passing threshold</h3><EditBtn isEditing={!!edit.dashboard} onToggle={()=>toggleEdit("dashboard")} /></div>
              <div className="card">
                <div className="field" style={{marginBottom:0}}>
                  <label>Passing threshold (%)</label>
                  {edit.dashboard
                    ? <input type="number" min="0" max="100" value={CR.threshold} onChange={e=>{ CR.threshold = Number(e.target.value)||0; rerender(); }} />
                    : <div style={{fontSize:20, fontWeight:600}}>{CR.threshold}%</div>}
                </div>
              </div>
            </div>
          </div>

          <div className="section-title"><h3>Students</h3><span className="hint">Total grade is the average of Prelim, Midterm and Final</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Total grade %</th><th>Equiv.</th><th>Status</th><th>Band</th><th>Terms failed</th></tr></thead>
              <tbody>
                {rows.map(({st,c})=>(
                  <tr key={st.id}>
                    <td>{st.name}</td>
                    <td className="mono">{crFmt(c.total)}</td>
                    <td className="mono">{c.gp==null?"—":c.gp.toFixed(2)}</td>
                    <td>{c.pass==null ? "—" : <Badge kind={c.pass?"success":"alert"}>{c.pass?"Pass":"Fail"}</Badge>}</td>
                    <td>{crBand(c.total)}</td>
                    <td className="mono">{c.failedTerms}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty">
                      <div className="big">📋</div>
                      No students enrolled in this section yet. Add students using <b>+ Add student</b> in the <b>Class list</b> tab.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="record" && (
        <div>
          <div className="section-title" style={{marginTop:0}}>
            <h3>Class record &ndash; detailed</h3>
            <div style={{display:"flex", gap:8, alignItems:"center"}}>
              {edit.record && <><button className="btn btn-sm" onClick={addAssessment}>+ Assessment</button><button className="btn btn-sm" onClick={addStudent}>+ Student</button></>}
              <EditBtn isEditing={!!edit.record} onToggle={()=>toggleEdit("record")} />
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>No.</th><th>Student name</th>
                  {CR.assessments.map((a,i)=>(
                    <th key={i}>
                      {edit.record
                        ? <span style={{display:"inline-flex", flexDirection:"column", gap:3}}>
                            <select style={{fontSize:11, padding:"3px 4px"}} value={a.term} onChange={e=>{a.term=e.target.value; rerender();}}>{CR_TERMS.map(t=><option key={t} value={t}>{t}</option>)}</select>
                            <select style={{fontSize:11, padding:"3px 4px"}} value={a.type} onChange={e=>{a.type=e.target.value; rerender();}}>{CR.types.map(t=><option key={t} value={t}>{shortType(t)}</option>)}</select>
                          </span>
                        : <span>{a.term}<br/>{shortType(a.type)}</span>}
                    </th>
                  ))}
                  {edit.record && <th></th>}
                </tr>
                <tr><th></th><th style={{textTransform:"none"}}>No. of items</th>
                  {CR.assessments.map((a,i)=>(
                    <th key={i} className="mono">
                      {edit.record
                        ? <span style={{display:"inline-flex", gap:4, alignItems:"center"}}><input type="number" min="1" style={{...numInput, width:60}} value={a.items} onChange={e=>setItems(i,e.target.value)} />{CR.assessments.length>1 && delBtn("a"+i, ()=>removeAssessment(i), "Remove this assessment")}</span>
                        : a.items}
                    </th>
                  ))}
                  {edit.record && <th></th>}
                </tr>
              </thead>
              <tbody>
                {CR.students.map((st,n)=>(
                  <tr key={st.id}>
                    <td>{n+1}</td>
                    <td>{edit.record ? <input style={{minWidth:220}} value={st.name} onChange={e=>{st.name=e.target.value; rerender();}} /> : st.name}</td>
                    {st.scores.map((v,i)=>(
                      <td key={i} className="mono">
                        {edit.record ? <input type="number" min="0" max={CR.assessments[i].items} style={numInput} value={v==null?"":v} onChange={e=>setScore(st,i,e.target.value)} /> : (v==null?"—":v)}
                      </td>
                    ))}
                    {edit.record && <td>{CR.students.length>1 && delBtn("s"+st.id, ()=>removeStudent(st.id), "Remove student")}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-title"><h3>Class record &ndash; summary</h3><span className="hint">{CR.types.map(t=>`${t} ${CR.weights[t]}%`).join("  ·  ")}</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>No.</th><th>Student name</th><th>Prelim %</th><th>Midterm %</th><th>Final %</th><th>Total grade</th><th>Equivalent</th><th>Remarks</th><th>Terms failed</th></tr></thead>
              <tbody>
                {rows.map(({st,c},n)=>(
                  <tr key={st.id}>
                    <td>{n+1}</td><td>{st.name}</td>
                    {CR_TERMS.map(t=><td key={t} className="mono" style={c.term[t]!=null && c.term[t]<CR.threshold ? {color:"var(--alert)", fontWeight:600} : {}}>{crFmt(c.term[t])}</td>)}
                    <td className="mono"><b>{crFmt(c.total)}</b></td>
                    <td className="mono">{c.gp==null?"—":c.gp.toFixed(2)}</td>
                    <td>{c.pass==null ? "—" : <Badge kind={c.pass?"success":"alert"}>{c.pass ? (c.complete?"PASSED":"PASSING (so far)") : (c.complete?"FAILED":"FAILING (so far)")}</Badge>}</td>
                    <td className="mono">{c.failedTerms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-title"><h3>Component ratings by term</h3><span className="hint">Rating = {CR.base} + score &divide; items &times; {100-CR.base}, rounded</span></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th rowSpan="2">No.</th><th rowSpan="2">Student name</th>{CR_TERMS.map(t=><th key={t} colSpan={CR.types.length+1} style={{textAlign:"center"}}>{t}</th>)}</tr>
                <tr>{CR_TERMS.map(t=><React.Fragment key={t}>{CR.types.map(ty=><th key={ty}>{shortType(ty)} {CR.weights[ty]}%</th>)}<th>Term %</th></React.Fragment>)}</tr>
              </thead>
              <tbody>
                {rows.map(({st,c},n)=>(
                  <tr key={st.id}>
                    <td>{n+1}</td><td>{st.name}</td>
                    {CR_TERMS.map(t=><React.Fragment key={t}>{CR.types.map(ty=><td key={ty} className="mono">{c.rating[t][ty]==null?"—":c.rating[t][ty]}</td>)}<td className="mono"><b>{crFmt(c.term[t])}</b></td></React.Fragment>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="student" && !student && (
        <div className="card" style={{ textAlign: "center", padding: "36px 16px", color: "var(--slate)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div>No students enrolled in this section yet. Add students using <b>+ Add student</b> in the <b>Class list</b> tab.</div>
        </div>
      )}

      {tab==="student" && student && (
        <div>
          <div className="toolbar">
            <div className="field" style={{marginBottom:0, minWidth:280}}>
              <label>Select student</label>
              <select value={student.id} onChange={e=>setStudentId(Number(e.target.value))}>
                {CR.students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <EditBtn isEditing={!!edit.student} onToggle={()=>toggleEdit("student")} />
          </div>
          <div className="grid grid-2">
            <div>
              <div className="section-title" style={{marginTop:0}}><h3>Assessment scores</h3><span className="hint">{student.name}</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Term</th><th>Component</th><th>Score</th><th>Items</th><th>%</th></tr></thead>
                  <tbody>
                    {CR.assessments.map((a,i)=>(
                      <tr key={i}>
                        <td>{a.term}</td><td>{a.type}</td>
                        <td className="mono">{edit.student ? <input type="number" min="0" max={a.items} style={numInput} value={student.scores[i]==null?"":student.scores[i]} onChange={e=>setScore(student,i,e.target.value)} /> : (student.scores[i]==null?"—":student.scores[i])}</td>
                        <td className="mono">{a.items}</td>
                        <td className="mono">{student.scores[i]==null?"—":crFmt(student.scores[i]/a.items*100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div className="section-title" style={{marginTop:0}}><h3>Grade summary</h3></div>
              <div className="card" style={{fontSize:13.5, lineHeight:2}}>
                Prelim % <b style={{float:"right"}}>{crFmt(sc.term.Prelim)}</b><br/>
                Midterm % <b style={{float:"right"}}>{crFmt(sc.term.Midterm)}</b><br/>
                Final % <b style={{float:"right"}}>{crFmt(sc.term.Final)}</b><br/>
                Total grade <b style={{float:"right"}}>{crFmt(sc.total)}</b><br/>
                Equivalent grade <b style={{float:"right"}}>{sc.gp==null?"—":sc.gp.toFixed(2)}</b><br/>
                Terms failed <b style={{float:"right"}}>{sc.failedTerms}</b><br/>
                Standing <span style={{float:"right"}}>{sc.pass==null?"—":<Badge kind={sc.pass?"success":"alert"}>{sc.pass ? (sc.complete?"PASSED":"PASSING (so far)") : (sc.complete?"FAILED":"FAILING (so far)")}</Badge>}</span>
              </div>
              <div className="section-title"><h3>Component ratings</h3><span className="hint">Weighted into each term %</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Term</th>{CR.types.map(ty=><th key={ty}>{shortType(ty)} {CR.weights[ty]}%</th>)}<th>Term %</th></tr></thead>
                  <tbody>
                    {CR_TERMS.map(t=>(
                      <tr key={t}><td>{t}</td>{CR.types.map(ty=><td key={ty} className="mono">{sc.rating[t][ty]==null?"—":sc.rating[t][ty]}</td>)}<td className="mono"><b>{crFmt(sc.term[t])}</b></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="section-title"><h3>Attendance summary</h3></div>
              {(()=>{
                const marks = CR.sessions.map(se=>CR.attendance[student.id+":"+se.id]);
                const n = k => marks.filter(m=>m===k).length;
                return <div className="card" style={{fontSize:13.5}}>Present <b>{n("P")}</b> &nbsp; Late <b>{n("L")}</b> &nbsp; Absent <b>{n("A")}</b> &nbsp; Excused <b>{n("E")}</b></div>;
              })()}
            </div>
          </div>
          <div className="section-title"><h3>Comments / suggestions</h3><span className="hint">Visible to the course instructor</span></div>
          <div className="card">
            {edit.student
              ? <textarea rows="3" style={taStyle} placeholder="Add a comment for this student." value={CR.comments[student.id]||""} onChange={e=>{ CR.comments[student.id]=e.target.value; rerender(); }} />
              : <div style={{fontSize:13, color: CR.comments[student.id] ? "var(--ink)" : "var(--slate)", whiteSpace:"pre-wrap"}}>{CR.comments[student.id] || "No comments recorded yet."}</div>}
          </div>
        </div>
      )}

      {tab==="attendance" && (
        <div>
          <div className="section-title" style={{marginTop:0}}><h3>Attendance points by term</h3><span className="hint">Score / items (rating) &middot; submitted as points per term, not session by session</span></div>
          <div className="table-wrap" style={{marginBottom:20}}>
            <table>
              <thead><tr><th>No.</th><th>Student name</th>{CR_TERMS.map(t=><th key={t}>{t}</th>)}</tr></thead>
              <tbody>
                {CR.students.map((st,n)=>(
                  <tr key={st.id}>
                    <td>{n+1}</td><td>{st.name}</td>
                    {CR_TERMS.map(t=>{ const g = crGroup(st,t,"Attendance"); return <td key={t} className="mono">{g.raw==null?"—":`${g.raw} / ${g.items} (${crRating(st,t,"Attendance")})`}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="section-title" style={{marginTop:0}}>
            <h3>Session marks</h3>
            <div style={{display:"flex", gap:8, alignItems:"center"}}>
              <span className="hint">P = present, L = late, A = absent, E = excused</span>
              {edit.attendance && <button className="btn btn-sm" onClick={addSession}>+ Session</button>}
              <EditBtn isEditing={!!edit.attendance} onToggle={()=>toggleEdit("attendance")} />
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>No.</th><th>Student name</th>
                {CR.sessions.map(se=>(
                  <th key={se.id}>
                    {edit.attendance
                      ? <span style={{display:"inline-flex", gap:4, alignItems:"center"}}><input style={{width:100}} value={se.label} onChange={e=>{se.label=e.target.value; rerender();}} />{CR.sessions.length>1 && delBtn("ss"+se.id, ()=>removeSession(se.id), "Remove session")}</span>
                      : se.label}
                  </th>
                ))}
                <th>Present</th><th>Late</th><th>Absent</th><th>Excused</th></tr></thead>
              <tbody>
                {CR.students.map((st,n)=>{
                  const marks = CR.sessions.map(se=>CR.attendance[st.id+":"+se.id]);
                  const cnt = k => marks.filter(m=>m===k).length;
                  return (
                    <tr key={st.id}>
                      <td>{n+1}</td><td>{st.name}</td>
                      {CR.sessions.map((se,i)=>{
                        const m = marks[i];
                        return (
                          <td key={se.id}>
                            {edit.attendance
                              ? <select value={m||""} onChange={e=>{ if(e.target.value) CR.attendance[st.id+":"+se.id]=e.target.value; else delete CR.attendance[st.id+":"+se.id]; rerender(); }}>
                                  <option value="">—</option><option value="P">P</option><option value="L">L</option><option value="A">A</option><option value="E">E</option>
                                </select>
                              : (m ? <Badge kind={m==="P"?"success":m==="A"?"alert":"warn"}>{m}</Badge> : "—")}
                          </td>
                        );
                      })}
                      <td className="mono">{cnt("P")}</td><td className="mono">{cnt("L")}</td><td className="mono">{cnt("A")}</td><td className="mono">{cnt("E")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="grading" && (
        <div>
          <div style={{display:"flex", justifyContent:"flex-end", marginBottom:8}}><EditBtn isEditing={!!edit.grading} onToggle={()=>toggleEdit("grading")} /></div>
          <div className="grid grid-2">
            <div>
              <div className="section-title" style={{marginTop:0}}><h3>Grading weights</h3><span className="hint" style={{color: wTotal===100?"var(--slate)":"var(--alert)"}}>Total {wTotal}%{wTotal!==100?" (should be 100)":""}</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Component (applies to every term)</th><th>Weight %</th></tr></thead>
                  <tbody>
                    {CR.types.map(t=>(
                      <tr key={t}><td>{t}</td><td>{edit.grading ? <input type="number" min="0" max="100" style={{width:90}} value={CR.weights[t]} onChange={e=>{ CR.weights[t]=Number(e.target.value)||0; rerender(); }} /> : CR.weights[t]}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div className="section-title" style={{marginTop:0}}><h3>Grading base</h3></div>
              <div className="card">
                <div className="field" style={{marginBottom:0}}>
                  <label>Grading base (%)</label>
                  {edit.grading
                    ? <input type="number" min="0" max="100" style={numInput} value={CR.base} onChange={e=>{ CR.base = Math.min(100, Math.max(0, Number(e.target.value)||0)); rerender(); }} />
                    : <div style={{fontSize:20, fontWeight:600}}>{CR.base}%</div>}
                </div>
                <div style={{fontSize:12, color:"var(--slate)", marginTop:8}}>Component rating = base + (score &divide; items) &times; (100 &minus; base), rounded. Term % = weighted average of the component ratings. Total grade = average of Prelim, Midterm and Final, rounded.</div>
              </div>
            </div>
          </div>
          <div className="section-title"><h3>Grade equivalence</h3><span className="hint">LCC-B present scale</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Total grade % (minimum)</th><th>Grade point</th><th>Description</th><th>Students</th></tr></thead>
              <tbody>
                {CR_EQUIV.map((e,i)=>(
                  <tr key={i}>
                    <td className="mono">{edit.grading ? <input type="number" style={numInput} value={e.min} onChange={ev=>{ e.min=Number(ev.target.value)||0; rerender(); }} /> : e.min+" and above"}</td>
                    <td className="mono">{edit.grading ? <input type="number" step="0.25" style={numInput} value={e.gp} onChange={ev=>{ e.gp=Number(ev.target.value)||0; rerender(); }} /> : e.gp.toFixed(2)}</td>
                    <td>{edit.grading ? <input style={{width:150}} value={e.desc} onChange={ev=>{ e.desc=ev.target.value; rerender(); }} /> : e.desc}</td>
                    <td className="mono">{eqCount(e)}</td>
                  </tr>
                ))}
                <tr><td className="mono">Below {Math.min(...CR_EQUIV.map(e=>e.min))}</td><td className="mono">{CR_FAIL.gp.toFixed(2)}</td><td>{CR_FAIL.desc}</td><td className="mono">{failEqCount}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="approval" && (
        <div>
          {!canApprove && <div className="card" style={{marginBottom:16, fontSize:12.5, color:"var(--slate)"}}>View only. The Dean or VPAA completes the review checklist and approval decision.</div>}
          <div className="section-title" style={{marginTop:0}}><h3>Department access</h3><span className="hint">Identify the department before reviewing</span></div>
          <div className="card">
            <div className="grid grid-3">
              <div className="field" style={{marginBottom:0}}><label>Department</label>
                <select disabled={!canApprove} value={CR.access.department} onChange={e=>{ CR.access.department=e.target.value; rerender(); }}>
                  {collegeCodes.map(c=><option key={c} value={c}>{c}</option>)}
                </select></div>
              <div className="field" style={{marginBottom:0}}><label>Dean name</label>
                <input disabled={!canApprove} value={CR.access.dean} placeholder={actor} onChange={e=>{ CR.access.dean=e.target.value; rerender(); }} /></div>
              <div className="field" style={{marginBottom:0}}><label>Date accessed</label>
                <div style={{display:"flex", gap:8}}><input value={CR.access.date} readOnly placeholder="Not recorded" />{canApprove && <button className="btn btn-sm" onClick={recordAccess}>Record</button>}</div></div>
            </div>
          </div>

          <div className="section-title">
            <h3>Review checklist</h3>
            <div style={{display:"flex", gap:8, alignItems:"center"}}>
              {canApprove && edit.checklist && <button className="btn btn-sm" onClick={()=>{ CR.checklist.push({label:"New checklist item", auto:null, status:"pending", note:""}); rerender(); }}>+ Item</button>}
              {canApprove && <EditBtn isEditing={!!edit.checklist} onToggle={()=>toggleEdit("checklist")} />}
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Auto-check</th><th>Status</th><th>Reviewer notes</th>{canApprove && edit.checklist && <th></th>}</tr></thead>
              <tbody>
                {CR.checklist.map((it,i)=>(
                  <tr key={i}>
                    <td style={{minWidth:220}}>{canApprove && edit.checklist ? <input style={{width:"100%"}} value={it.label} onChange={e=>{ it.label=e.target.value; rerender(); }} /> : it.label}</td>
                    <td style={{fontSize:12}}>{checks[i] ? <span style={{color: checks[i].ok?"var(--success)":"var(--alert)"}}>{checks[i].ok?"✔":"⚠"} {checks[i].text}</span> : <span style={{color:"var(--slate)"}}>Manual check</span>}</td>
                    <td>
                      <select disabled={!canApprove} value={it.status} onChange={e=>{ it.status=e.target.value; rerender(); }}>
                        <option value="pending">Pending</option><option value="ok">Passed</option><option value="fix">Needs fix</option>
                      </select>
                    </td>
                    <td style={{minWidth:260}}><input disabled={!canApprove} style={{width:"100%"}} value={it.note} placeholder={canApprove?"Add a note":""} onChange={e=>{ it.note=e.target.value; rerender(); }} /></td>
                    {canApprove && edit.checklist && <td>{delBtn("c"+i, ()=>{ CR.checklist.splice(i,1); }, "Remove item")}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-title"><h3>Approval decision</h3><Badge kind={decisionBadge[1]}>{decisionBadge[0]}</Badge></div>
          <div className="card">
            <div className="field"><label>Remarks</label>
              <textarea rows="3" disabled={!canApprove} style={taStyle} value={CR.decision.remarks} onChange={e=>{ CR.decision.remarks=e.target.value; rerender(); }} /></div>
            {canApprove && (
            <div style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"center"}}>
              <button className="btn btn-primary" disabled={!allOk} onClick={()=>decide("approved")}>Approve class record</button>
              <button className="btn" style={{color:"var(--alert)", borderColor:"var(--alert)"}} onClick={()=>decide("returned")}>Return for revision</button>
              <button className="btn" onClick={()=>decide("pending")}>Reset</button>
              {!allOk && <span style={{fontSize:12, color:"var(--slate)"}}>Approval unlocks when every item is marked Passed.</span>}
            </div>
            )}
            {CR.decision.date && <div style={{marginTop:10, fontSize:12, color:"var(--slate)"}}>Last decision by {CR.decision.reviewer} on {CR.decision.date}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
