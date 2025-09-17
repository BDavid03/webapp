// Edit this file to manage your weekly timetable.
// - Time range is configurable via startHour/endHour (24h clock)
// - Add events to the `events` array. Day names must match `days` entries.

export const TIMETABLE_CONFIG = {
  // 24h clock: 5 = 5:00, 24 = 24:00 (midnight)
  startHour: 7,  // 07:00
  endHour: 19,   // 19:00 (7 PM)
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  events: [
    // Examples — replace with your own
    // { day: "Mon", start: "10:00", end: "12:00", label: "MATH101 Tutorial", location: "B-201", color: "#1976d2" },
    // { day: "Wed", start: "09:00", end: "10:00", label: "COMP201 Forum", location: "Online", color: "#7b1fa2" },
    // { day: "Fri", start: "13:00", end: "15:00", label: "STAT110 Lab", location: "Lab C", color: "#d32f2f" },
  ],
};
