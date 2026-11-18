/* ===================== Class Record Review (VPAA / Dean) ===================== */
export const CR_TERMS = ["Prelim","Midterm","Final"];

/* Grade equivalence scale (from the class record's "Summary and Grading" sheet) */
export const CR_EQUIV = [
  {min:98, gp:1.00, desc:"Passed"},
  {min:95, gp:1.25, desc:"Passed"},
  {min:92, gp:1.50, desc:"Passed"},
  {min:89, gp:1.75, desc:"Passed"},
  {min:86, gp:2.00, desc:"Passed"},
  {min:83, gp:2.25, desc:"Passed"},
  {min:80, gp:2.50, desc:"Passed"},
  {min:77, gp:2.75, desc:"Passed"},
  {min:75, gp:3.00, desc:"Passed"},
];

export const CR_FAIL = {gp:5.0, desc:"Failed"};

export const CR = {
  teacher:"DR. JANRAE SANICAS", subject:"ENG 210", schedule:"THURSDAY | 4:00-7:00PM | CB 214",
  base:50, threshold:75, gateType:"Examination",
  types:["Attendance","Journal Reflection","Performance Tasks","Examination"],
  weights:{"Attendance":10, "Journal Reflection":10, "Performance Tasks":40, "Examination":40},
  assessments:[
    {"term":"Prelim","type":"Attendance","items":20},
    {"term":"Prelim","type":"Journal Reflection","items":50},
    {"term":"Prelim","type":"Performance Tasks","items":40},
    {"term":"Prelim","type":"Examination","items":80},
    {"term":"Midterm","type":"Attendance","items":50},
    {"term":"Midterm","type":"Journal Reflection","items":45},
    {"term":"Midterm","type":"Performance Tasks","items":50},
    {"term":"Midterm","type":"Examination","items":60},
    {"term":"Final","type":"Attendance","items":40},
    {"term":"Final","type":"Journal Reflection","items":50},
    {"term":"Final","type":"Performance Tasks","items":40},
    {"term":"Final","type":"Examination","items":80},
  ],
  students: [],
  sessions:[],
  attendance:{},
  comments:{}, general:"",
  access:{department:"SHTM", dean:"", date:""},
  checklist:[
    {label:"Attendance records complete for all terms", auto:"attendance", status:"pending", note:""},
    {label:"Scores encoded for Journal Reflection / Performance Tasks", auto:"pt_ww", status:"pending", note:""},
    {label:"Prelim grades encoded and verified", auto:"prelim", status:"pending", note:""},
    {label:"Midterm grades encoded and verified", auto:"midterm", status:"pending", note:""},
    {label:"Final grades encoded and verified", auto:"endterm", status:"pending", note:""},
    {label:"No formula errors present (REF, NAME, DIV errors)", auto:"errors", status:"pending", note:""},
    {label:"Grading weights match the approved syllabus", auto:"weights", status:"pending", note:""},
    {label:"Class record signed by course instructor", auto:null, status:"pending", note:""},
  ],
  decision:{status:"pending", reviewer:"", date:"", remarks:""},
};

export function crFmt(v){ return v==null || Number.isNaN(v) ? "—" : String(Number(v.toFixed(2))); }

export function crRound(x){ return Math.round(x + 1e-9); }

/* raw score + total items for one component within one term */
export function crGroup(st, term, type){
  let raw = null, items = 0;
  CR.assessments.forEach((a,i)=>{ if(a.term===term && a.type===type){ items += a.items; if(st.scores[i]!=null) raw = (raw||0) + st.scores[i]; } });
  return {raw, items};
}

/* component rating = ROUND(base + score/items x (100 - base)) */
export function crRating(st, term, type){
  const g = crGroup(st, term, type);
  if(g.raw==null || !g.items) return null;
  return crRound(CR.base + g.raw/g.items*(100-CR.base));
}

/* term % = ROUND(weighted average of the component ratings that have a score); blank until the gate component (Examination) is scored */
export function crTermPct(st, term){
  if(CR.gateType && crRating(st, term, CR.gateType)==null) return null;
  let acc=0, w=0;
  CR.types.forEach(ty=>{ const r = crRating(st, term, ty); if(r!=null){ const wt = Number(CR.weights[ty]||0); acc += r*wt; w += wt; } });
  return w ? crRound(acc/w) : null;
}

export function crCompute(st){
  const rating = {}, term = {};
  CR_TERMS.forEach(t=>{
    rating[t] = {};
    CR.types.forEach(ty=>{ rating[t][ty] = crRating(st, t, ty); });
    term[t] = crTermPct(st, t);
  });
  const vals = CR_TERMS.map(t=>term[t]).filter(v=>v!=null);
  const total = vals.length ? crRound(vals.reduce((x,y)=>x+y,0)/vals.length) : null;
  const eq = total!=null ? ([...CR_EQUIV].sort((a,b)=>b.min-a.min).find(e=>total>=e.min) || CR_FAIL) : null;
  return {rating, term, total, complete: vals.length===CR_TERMS.length,
    failedTerms: vals.filter(v=>v<CR.threshold).length,
    gp: eq?eq.gp:null, desc: eq?eq.desc:null,
    pass: total!=null ? total>=CR.threshold : null};
}

export function crBand(total){
  if(total==null) return "—";
  if(total>=90) return "Excellent";
  if(total>=80) return "Very Good";
  if(total>=CR.threshold) return "Satisfactory";
  return "Needs Improvement";
}

export function crAutoCheck(key){
  const idxOf = f => CR.assessments.map((a,i)=>f(a)?i:-1).filter(i=>i>=0);
  const missing = idxs => CR.students.filter(st=>idxs.some(i=>st.scores[i]==null)).length;
  const scoreCheck = idxs => { const m = missing(idxs); return m===0 ? {ok:true, text:"All scores encoded"} : {ok:false, text:`${m} student(s) with missing scores`}; };
  if(key==="attendance"){
    if(CR.sessions.length===0) return scoreCheck(idxOf(a=>a.type==="Attendance"));
    const gaps = CR.students.reduce((n,st)=>n+CR.sessions.filter(se=>!CR.attendance[st.id+":"+se.id]).length,0);
    return gaps===0 ? {ok:true, text:`All ${CR.sessions.length} session(s) marked for every student`} : {ok:false, text:`${gaps} attendance mark(s) missing`};
  }
  if(key==="pt_ww") return scoreCheck(idxOf(a=>a.type==="Journal Reflection" || a.type==="Performance Tasks"));
  const termOf = {prelim:"Prelim", midterm:"Midterm", endterm:"Final"};
  if(termOf[key]) return scoreCheck(idxOf(a=>a.term===termOf[key]));
  if(key==="errors"){
    const bad = CR.students.filter(st=>{ const c=crCompute(st); return [c.total,c.gp].some(v=>v==null || !Number.isFinite(v)); }).length;
    return bad===0 ? {ok:true, text:"No calculation errors found"} : {ok:false, text:`${bad} student(s) with calculation errors`};
  }
  if(key==="weights"){
    const t = CR.types.reduce((s,k)=>s+Number(CR.weights[k]||0),0);
    return t===100 ? {ok:true, text:"Weights total 100%"} : {ok:false, text:`Weights total ${t}%`};
  }
  return null;
}
