import { useCallback, useEffect, useMemo, useState } from "react";
import "./HomePage.css";
import WeekTimetable from "../components/WeekTimetable";
import { useAuth } from "../auth/AuthContext";

const STORAGE_SUBJECTS = "uni_subjects_v1";
const STORAGE_ASSESS = "uni_assessments_v1";
const STORAGE_SEM_START = "uni_sem_start_v1"; // ISO date string
const STORAGE_TT_CUSTOM = "uni_tt_custom_v1";

export default function HomePage() {
  const { currentUser, loading: authLoading } = useAuth();
  const userKey = useCallback(
    (suffix) => (currentUser?.id ? `${currentUser.id}_${suffix}` : suffix),
    [currentUser?.id]
  );
  const usernameKey = useCallback(
    (suffix) => (currentUser?.username ? `${currentUser.username.toLowerCase()}_${suffix}` : suffix),
    [currentUser?.username]
  );
  const [subjects, setSubjects] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [semStart, setSemStart] = useState("");
  const [customEvents, setCustomEvents] = useState([]);

  const [subjForm, setSubjForm] = useState({
    name: "",
    code: "",
    // legacy free-text (kept for compatibility on save)
    tutorialTime: "",
    forumTime: "",
    // structured fields
    tutorialDay: "",
    tutorialStart: "",
    tutorialEnd: "",
    forumDay: "",
    forumStart: "",
    forumEnd: "",
  });
  const [assessForm, setAssessForm] = useState({ title: "", subjectId: "", due: "" });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (authLoading) return; // wait for auth to resolve
    try {
      // Prefer per-user keys; fall back to legacy global keys
      let s = JSON.parse(
        localStorage.getItem(userKey(STORAGE_SUBJECTS)) ||
        localStorage.getItem(usernameKey(STORAGE_SUBJECTS)) ||
        localStorage.getItem(STORAGE_SUBJECTS) || "[]"
      );
      let a = JSON.parse(
        localStorage.getItem(userKey(STORAGE_ASSESS)) ||
        localStorage.getItem(usernameKey(STORAGE_ASSESS)) ||
        localStorage.getItem(STORAGE_ASSESS) || "[]"
      );
      let d = (
        localStorage.getItem(userKey(STORAGE_SEM_START)) ||
        localStorage.getItem(usernameKey(STORAGE_SEM_START)) ||
        localStorage.getItem(STORAGE_SEM_START) || ""
      );
      let ce = JSON.parse(
        localStorage.getItem(userKey(STORAGE_TT_CUSTOM)) ||
        localStorage.getItem(usernameKey(STORAGE_TT_CUSTOM)) ||
        localStorage.getItem(STORAGE_TT_CUSTOM) || "[]"
      );
      // Try load from user db if present
      try {
        const users = JSON.parse(localStorage.getItem("app_users_v1") || "{}");
        const uname = (currentUser?.username || "").toLowerCase();
        const u = uname && users[uname] ? users[uname] : null;
        if (u) {
          if (Array.isArray(u.subjects)) s = u.subjects;
          if (Array.isArray(u.assessments)) a = u.assessments;
          if (typeof u.semStart === "string") d = u.semStart;
          if (Array.isArray(u.timetableEvents)) ce = u.timetableEvents;
        }
      } catch (_) {}
      setSubjects(Array.isArray(s) ? s : []);
      setAssessments(Array.isArray(a) ? a : []);
      setSemStart(d || defaultSemStart());
      setCustomEvents(Array.isArray(ce) ? ce : []);
      setHydrated(true);
    } catch (_) {
      setSemStart(defaultSemStart());
    }
  }, [authLoading, currentUser?.id, currentUser?.username, userKey, usernameKey]);

  useEffect(() => {
    if (!hydrated || authLoading) return;
    try {
      localStorage.setItem(userKey(STORAGE_SUBJECTS), JSON.stringify(subjects));
      localStorage.setItem(usernameKey(STORAGE_SUBJECTS), JSON.stringify(subjects));
    } catch (_) {}
  }, [subjects, currentUser?.id, currentUser?.username, userKey, usernameKey, hydrated, authLoading]);
  useEffect(() => {
    if (!hydrated || authLoading) return;
    try {
      localStorage.setItem(userKey(STORAGE_ASSESS), JSON.stringify(assessments));
      localStorage.setItem(usernameKey(STORAGE_ASSESS), JSON.stringify(assessments));
    } catch (_) {}
  }, [assessments, currentUser?.id, currentUser?.username, userKey, usernameKey, hydrated, authLoading]);
  useEffect(() => {
    if (!hydrated || authLoading) return;
    try {
      localStorage.setItem(userKey(STORAGE_SEM_START), semStart);
      localStorage.setItem(usernameKey(STORAGE_SEM_START), semStart);
    } catch (_) {}
  }, [semStart, currentUser?.id, currentUser?.username, userKey, usernameKey, hydrated, authLoading]);
  useEffect(() => {
    if (!hydrated || authLoading) return;
    try {
      localStorage.setItem(userKey(STORAGE_TT_CUSTOM), JSON.stringify(customEvents));
      localStorage.setItem(usernameKey(STORAGE_TT_CUSTOM), JSON.stringify(customEvents));
    } catch (_) {}
  }, [customEvents, currentUser?.id, currentUser?.username, userKey, usernameKey, hydrated, authLoading]);
  // Also persist custom events inside the current user record for robustness
  useEffect(() => {
    if (!currentUser?.username || !hydrated || authLoading) return;
    try {
      const users = JSON.parse(localStorage.getItem("app_users_v1") || "{}");
      const uname = currentUser.username.toLowerCase();
      if (users[uname]) {
        users[uname].subjects = subjects;
        users[uname].assessments = assessments;
        users[uname].semStart = semStart;
        users[uname].timetableEvents = customEvents;
        localStorage.setItem("app_users_v1", JSON.stringify(users));
      }
    } catch (_) {}
  }, [subjects, assessments, semStart, customEvents, currentUser?.username, hydrated, authLoading]);

  const weekInfo = useMemo(() => computeWeekInfo(semStart), [semStart]);

  function addSubject(e) {
    e.preventDefault();
    if (!subjForm.name.trim()) return;
    // Build legacy strings from structured inputs if provided
    const tutorialStr = subjForm.tutorialDay && subjForm.tutorialStart
      ? `${subjForm.tutorialDay} ${subjForm.tutorialStart}${subjForm.tutorialEnd ? `-${subjForm.tutorialEnd}` : ""}`
      : (subjForm.tutorialTime || "");
    const forumStr = subjForm.forumDay && subjForm.forumStart
      ? `${subjForm.forumDay} ${subjForm.forumStart}${subjForm.forumEnd ? `-${subjForm.forumEnd}` : ""}`
      : (subjForm.forumTime || "");
    const item = {
      id: cryptoRandomId(),
      name: subjForm.name.trim(),
      code: subjForm.code || "",
      // store both string and structured for flexibility
      tutorialTime: tutorialStr,
      forumTime: forumStr,
      tutorialDay: subjForm.tutorialDay || "",
      tutorialStart: subjForm.tutorialStart || "",
      tutorialEnd: subjForm.tutorialEnd || "",
      forumDay: subjForm.forumDay || "",
      forumStart: subjForm.forumStart || "",
      forumEnd: subjForm.forumEnd || "",
      color: colorForIndex(subjects.length),
    };
    setSubjects((s) => [...s, item]);
    setSubjForm({
      name: "",
      code: "",
      tutorialTime: "",
      forumTime: "",
      tutorialDay: "",
      tutorialStart: "",
      tutorialEnd: "",
      forumDay: "",
      forumStart: "",
      forumEnd: "",
    });
  }
  function removeSubject(id) {
    setSubjects((s) => s.filter((x) => x.id !== id));
    setAssessments((a) => a.filter((x) => x.subjectId !== id));
  }

  function addAssessment(e) {
    e.preventDefault();
    if (!assessForm.title.trim() || !assessForm.due) return;
    const item = { id: cryptoRandomId(), title: assessForm.title.trim(), subjectId: assessForm.subjectId || null, due: assessForm.due };
    setAssessments((a) => [...a, item]);
    setAssessForm({ title: "", subjectId: "", due: "" });
  }
  function removeAssessment(id) { setAssessments((a) => a.filter((x) => x.id !== id)); }

  const upcoming = useMemo(() => {
    const now = new Date();
    return [...assessments]
      .map((a) => ({ ...a, days: daysUntil(a.due, now) }))
      .sort((x, y) => (x.days ?? 9999) - (y.days ?? 9999))
      .slice(0, 10);
  }, [assessments]);

  const subjectEvents = useMemo(() => {
    const out = [];
    for (const s of subjects) {
      // Prefer structured fields
      if (s.tutorialDay && s.tutorialStart) {
        const day = cap(s.tutorialDay);
        const start = s.tutorialStart;
        const end = s.tutorialEnd && s.tutorialEnd !== "" ? s.tutorialEnd : addHourTo(start, 1);
        out.push({ source: "subject", subjectId: s.id, day, start, end, label: `${s.name} Tutorial`, location: s.code ? `Code ${s.code}` : "", color: s.color });
      } else if (s.tutorialTime) {
        const ev = parseDayTime(s.tutorialTime);
        if (ev) out.push({ source: "subject", subjectId: s.id, day: ev.day, start: ev.start, end: ev.end, label: `${s.name} Tutorial`, location: s.code ? `Code ${s.code}` : "", color: s.color });
      }
      if (s.forumDay && s.forumStart) {
        const day = cap(s.forumDay);
        const start = s.forumStart;
        const end = s.forumEnd && s.forumEnd !== "" ? s.forumEnd : addHourTo(start, 1);
        out.push({ source: "subject", subjectId: s.id, day, start, end, label: `${s.name} Forum`, location: s.code ? `Code ${s.code}` : "", color: s.color });
      } else if (s.forumTime) {
        const ev = parseDayTime(s.forumTime);
        if (ev) out.push({ source: "subject", subjectId: s.id, day: ev.day, start: ev.start, end: ev.end, label: `${s.name} Forum`, location: s.code ? `Code ${s.code}` : "", color: s.color });
      }
    }
    return out;
  }, [subjects]);

  function handleSlotClick(day, hour) {
    const start = fmtHM(hour, 0);
    const defaultLabel = `${day} ${start}`;
    const label = window.prompt("Event title:", defaultLabel);
    if (!label) return;
    const durStr = window.prompt("Duration in hours (e.g., 1, 1.5):", "1");
    const dur = Math.max(0.5, Math.min(12, parseFloat(durStr || "1")) || 1);
    const endHourFloat = hour + dur;
    const endH = Math.floor(endHourFloat);
    const endM = Math.round((endHourFloat - endH) * 60);
    const location = window.prompt("Location (optional):", "") || "";
    const color = colorForIndex(customEvents.length);
    const ev = { id: cryptoRandomId(), source: "custom", day, start, end: fmtHM(endH, endM), label, location, color };
    setCustomEvents((arr) => [...arr, ev]);
  }

  function handleEventClick(ev) {
    if (ev?.source === "custom" && ev.id) {
      const ok = window.confirm(`Delete "${ev.label}" (${ev.start}-${ev.end})?`);
      if (ok) setCustomEvents((arr) => arr.filter((x) => x.id !== ev.id));
      return;
    }
    window.alert("This event is generated from subjects or config. Edit the subject times or src/data/timetable.js to change it.");
  }

  return (
    <section className="home">
      <h1>Uni Dashboard</h1>

      <div className="home__grid">
        <div className="home__card" style={{ gridColumn: "1 / -1" }}>
          <h2>Subjects</h2>
          <form onSubmit={addSubject} className="home__row">
            <input className="home__input" placeholder="Subject name (e.g., MATH101)" value={subjForm.name} onChange={(e)=>setSubjForm({...subjForm,name:e.target.value})} />
            <input className="home__input" type="text" placeholder="Classroom code (optional)" value={subjForm.code} onChange={(e)=>setSubjForm({...subjForm,code:e.target.value})} />

            <div className="home__two-col">
              <div className="home__row">
                <strong>Forum</strong>
                <div className="home__row--inline">
                  <DaySelect value={subjForm.forumDay} onChange={(v)=>setSubjForm({...subjForm,forumDay:v})} />
                </div>
                <div className="home__row--inline">
                  <input className="home__time" type="time" value={subjForm.forumStart} onChange={(e)=>setSubjForm({...subjForm,forumStart:e.target.value})} placeholder="Start" />
                  <input className="home__time" type="time" value={subjForm.forumEnd} onChange={(e)=>setSubjForm({...subjForm,forumEnd:e.target.value})} placeholder="End" />
                </div>
              </div>

              <div className="home__row">
                <strong>Tutorial</strong>
                <div className="home__row--inline">
                  <DaySelect value={subjForm.tutorialDay} onChange={(v)=>setSubjForm({...subjForm,tutorialDay:v})} />
                </div>
                <div className="home__row--inline">
                  <input className="home__time" type="time" value={subjForm.tutorialStart} onChange={(e)=>setSubjForm({...subjForm,tutorialStart:e.target.value})} placeholder="Start" />
                  <input className="home__time" type="time" value={subjForm.tutorialEnd} onChange={(e)=>setSubjForm({...subjForm,tutorialEnd:e.target.value})} placeholder="End" />
                </div>
              </div>
            </div>

            <div>
              <button className="home__btn" type="submit">Add</button>
            </div>
          </form>
          {subjects.length === 0 ? (
            <div className="home__muted">No subjects yet. Add your first one above.</div>
          ) : (
            <table className="home__table">
              <thead>
                <tr>
                  <th>Subject</th><th>Tutorial</th><th>Forum</th><th>Code</th><th></th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{formatSession(s.tutorialDay, s.tutorialStart, s.tutorialEnd) || s.tutorialTime || <span className="home__muted">—</span>}</td>
                    <td>{formatSession(s.forumDay, s.forumStart, s.forumEnd) || s.forumTime || <span className="home__muted">—</span>}</td>
                    <td>{s.code || <span className="home__muted">—</span>}</td>
                    <td><button className="home__btn" onClick={()=>removeSubject(s.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        

        <div className="home__card" style={{ gridColumn: "1 / -1" }}>
          <h2>Weekly Timetable</h2>
          <div className="home__muted">Subject tutorial/forum times appear automatically. You can also add custom items in <code>src/data/timetable.js</code> and adjust start/end hours there.</div>
          <WeekTimetable
            extraEvents={[...subjectEvents, ...customEvents]}
            interactive
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
          />
        </div>

        <div className="home__card" style={{ gridColumn: "1 / -1" }}>
          <h2>Upcoming Assessments</h2>
          <form onSubmit={addAssessment} className="home__row">
            <input className="home__input" placeholder="Assessment title" value={assessForm.title} onChange={(e)=>setAssessForm({...assessForm,title:e.target.value})} />
            <div className="home__row--inline">
              <select className="home__select" value={assessForm.subjectId} onChange={(e)=>setAssessForm({...assessForm,subjectId:e.target.value})}>
                <option value="">Unassigned</option>
                {subjects.map((s)=> (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input className="home__date" type="date" value={assessForm.due} onChange={(e)=>setAssessForm({...assessForm,due:e.target.value})} />
              <button className="home__btn" type="submit">Add</button>
            </div>
          </form>
          {upcoming.length === 0 ? (
            <div className="home__muted">No assessments yet. Add one above.</div>
          ) : (
            <table className="home__table">
              <thead>
                <tr>
                  <th>Title</th><th>Subject</th><th>Due</th><th>In</th><th></th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>{subjectNameById(subjects, a.subjectId) || <span className="home__muted">—</span>}</td>
                    <td>{formatDate(a.due)}</td>
                    <td>
                      {a.days == null ? (
                        <span className="home__muted">—</span>
                      ) : a.days < 0 ? (
                        <span className="home__danger">{Math.abs(a.days)} day{plural(Math.abs(a.days))} ago</span>
                      ) : a.days === 0 ? (
                        <span className="home__danger">today</span>
                      ) : (
                        <span className={a.days <= 7 ? "home__danger" : "home__ok"}>{a.days} day{plural(a.days)} away</span>
                      )}
                    </td>
                    <td><button className="home__btn" onClick={()=>removeAssessment(a.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Moved to bottom: Semester Week */}
        <div className="home__card">
          <h2>Semester Week</h2>
          <div className="home__row">
            <label>Start date</label>
            <input className="home__date" type="date" value={semStart} onChange={(e)=>setSemStart(e.target.value)} />
          </div>
          <div className="home__row--inline">
            <span className="home__pill">Current week: <strong>{weekInfo.currentWeek}</strong></span>
            <span className="home__pill">As of {new Date().toLocaleDateString()}</span>
          </div>
          <div className="home__muted">Week 1 begins on the chosen start date. Weeks roll over every 7 days.</div>
        </div>

      </div>
    </section>
  );
}

function defaultSemStart() {
  try {
    const y = new Date().getFullYear();
    const start = new Date(y, 8, 14); // Sept 14
    return toISO(start);
  } catch (_) {
    return toISO(new Date());
  }
}
function computeWeekInfo(isoStart) {
  const start = parseISO(isoStart);
  const now = new Date();
  const ms = new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const days = Math.floor(ms / (24*60*60*1000));
  const currentWeek = days < 0 ? 0 : Math.floor(days / 7) + 1;
  return { days, currentWeek };
}
function daysUntil(isoDate, ref) {
  if (!isoDate) return null;
  const due = parseISO(isoDate);
  const a = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const b = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.round((a - b) / (24*60*60*1000));
}
function formatDate(iso) { try { return new Date(iso).toLocaleDateString(); } catch { return iso || ""; } }
function plural(n) { return n === 1 ? "" : "s"; }
function toISO(d) { return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-"); }
function parseISO(iso) {
  const [y,m,dd] = (iso || "").split("-").map((x) => parseInt(x,10));
  if (!y || !m || !dd) return new Date();
  return new Date(y, m-1, dd);
}
function cryptoRandomId() {
  try { return crypto.randomUUID(); } catch (_) { return Math.random().toString(36).slice(2); }
}

function parseDayTime(input) {
  if (!input) return null;
  const m = /^\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})(?::(\d{2}))?(?:\s*-\s*(\d{1,2})(?::(\d{2}))?)?\s*$/i.exec(input);
  if (!m) return null;
  const day = cap(m[1]);
  const sh = clampInt(parseInt(m[2]||"0",10), 0, 23);
  const sm = clampInt(parseInt(m[3]||"0",10), 0, 59);
  let eh = m[4] ? clampInt(parseInt(m[4],10), 0, 23) : (sh + 1);
  let em = m[5] ? clampInt(parseInt(m[5],10), 0, 59) : sm;
  if (eh < sh || (eh === sh && em <= sm)) { eh = sh + 1; em = sm; }
  return { day, start: fmtHM(sh, sm), end: fmtHM(eh, em) };
}
function fmtHM(h, m) { return String(h).padStart(2,"0") + ":" + String(m).padStart(2,"0"); }
function clampInt(n, lo, hi) { return Math.max(lo, Math.min(hi, isFinite(n)?n:lo)); }
function cap(s){ return s.slice(0,1).toUpperCase()+s.slice(1,3).toLowerCase(); }
function subjectNameById(subjects, id){ return subjects.find((s)=>s.id===id)?.name || ""; }
function colorForIndex(i){
  const palette=["#1976d2","#d32f2f","#388e3c","#f57c00","#7b1fa2","#00796b","#455a64","#5d4037"]; return palette[i%palette.length];
}
function parseHM(s){
  const parts = String(s || "").split(":");
  const h = Math.max(0, Math.min(23, parseInt(parts[0] || "0", 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(parts[1] || "0", 10) || 0));
  return [h, m];
}
function addHourTo(hhmm, hours){
  const [h,m]=parseHM(hhmm); const t=h*60+m+Math.round(hours*60); const hh=Math.floor((t/60)%24); const mm=t%60; return fmtHM(hh,mm);
}
function formatSession(day, start, end){
  if (!day || !start) return ""; const e = end && end!=="" ? end : addHourTo(start,1); return `${cap(day)} ${start}-${e}`;
}

function DaySelect({ value, onChange }){
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  return (
    <select className="home__select" value={value} onChange={(e)=>onChange?.(e.target.value)}>
      <option value="">Day</option>
      {days.map((d)=> (<option key={d} value={d}>{d}</option>))}
    </select>
  );
}
