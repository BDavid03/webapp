import "./WeekTimetable.css";
import { TIMETABLE_CONFIG } from "../data/timetable";

export default function WeekTimetable({ extraEvents = [], interactive = false, onSlotClick, onEventClick }) {
  const cfg = TIMETABLE_CONFIG;
  const days = cfg.days || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const start = clampHour(cfg.startHour ?? 5);
  const end = clampHour(cfg.endHour ?? 24);
  const hours = range(start, end);

  const allEvents = [...(cfg.events || []), ...(extraEvents || [])];
  const eventsByDay = days.map((d) => allEvents.filter((e) => e.day === d));

  return (
    <div className="wt" style={{ "--rows": hours.length }}>
      <div className="wt__header">
        <div className="wt__headcell" />
        {days.map((d) => (
          <div className="wt__headcell" key={d}>{d}</div>
        ))}
      </div>
      <div className="wt__grid">
        {/* Time column */}
        <div className="wt__times">
          {hours.map((h) => (
            <div className="wt__time" key={h}>{hourLabel(h)}</div>
          ))}
        </div>
        {/* Day columns */}
        <div className="wt__cols">
          {days.map((d, idx) => (
            <DayColumn
              key={d}
              day={d}
              hours={hours}
              events={eventsByDay[idx]}
              start={start}
              interactive={interactive}
              onSlotClick={onSlotClick}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({ day, hours, events, start, interactive, onSlotClick, onEventClick }) {
  return (
    <div className="wt__col">
      {/* grid slots */}
      {hours.map((h) => (
        <div
          className={"wt__slot" + (interactive ? " wt__slot--interactive" : "")}
          key={h}
          onClick={interactive ? () => onSlotClick?.(day, h) : undefined}
          title={interactive ? `Add event: ${day} ${hourLabel(h)}` : undefined}
        />
      ))}
      {/* events */}
      {(events || []).map((ev, i) => (
        <EventBlock key={i} ev={ev} start={start} onClick={onEventClick} />
      ))}
    </div>
  );
}

function EventBlock({ ev, start, onClick }) {
  const top = offsetFromStart(ev.start, start);
  const height = durationHeight(ev.start, ev.end);
  const bg = ev.color || "#1976d2";
  const style = { top, height, background: bg };
  return (
    <div
      className="wt__event"
      style={style}
      onClick={onClick ? () => onClick(ev) : undefined}
      title={`${ev.label || "Event"} ${ev.start}-${ev.end}${ev.location ? " @ " + ev.location : ""}`}
    >
      <div className="wt__event-title">{ev.label || "Event"}</div>
      <div className="wt__event-loc">{ev.start}–{ev.end}{ev.location ? ` · ${ev.location}` : ""}</div>
    </div>
  );
}

// Helpers
function offsetFromStart(time, startHour) {
  const [h, m] = parseHM(time);
  const minutes = (h - startHour) * 60 + m;
  const hourH = getHourHeight();
  return (minutes / 60) * hourH;
}
function durationHeight(start, end) {
  const [sh, sm] = parseHM(start);
  const [eh, em] = parseHM(end);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  const hourH = getHourHeight();
  return Math.max(0.5 * hourH, (minutes / 60) * hourH);
}
function getHourHeight() {
  // fallback to 48 if CSS var not available
  const el = typeof document !== "undefined" ? document.querySelector(".wt") : null;
  const style = el ? getComputedStyle(el).getPropertyValue("--hour-height").trim() : "";
  const n = style.endsWith("px") ? parseFloat(style) : NaN;
  return Number.isFinite(n) ? n : 48;
}
function range(a, b) { const out = []; for (let i = a; i < b; i++) out.push(i); return out; }
function clampHour(h) { const n = Math.max(0, Math.min(24, Math.floor(h))); return n; }
function hourLabel(h) { const hh = h % 24; const am = hh < 12; const base = hh % 12 === 0 ? 12 : hh % 12; return `${base}:00 ${am ? "AM" : "PM"}`; }
function parseHM(s) { const [h, m] = String(s).split(":").map((x)=>parseInt(x,10)); return [h||0, m||0]; }
