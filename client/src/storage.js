const STORAGE_KEY = "work-tracker-entries";

function readEntries() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function writeEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function computeHours(timeIn, timeOut) {
  if (!timeIn || !timeOut) return null;
  const ms = new Date(timeOut) - new Date(timeIn);
  return Math.round((ms / 3600000) * 100) / 100;
}

export function getEntries() {
  const entries = readEntries();
  entries.sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn));
  return entries;
}

export function getStatus() {
  const entries = readEntries();
  return { open: entries.find((e) => !e.timeOut) || null };
}

export function timeIn(note) {
  const entries = readEntries();
  const alreadyOpen = entries.find((e) => !e.timeOut);
  if (alreadyOpen) {
    throw new Error("Already clocked in");
  }
  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    date: now.slice(0, 10),
    timeIn: now,
    timeOut: null,
    hours: null,
    note: note || "",
  };
  entries.push(entry);
  writeEntries(entries);
  return entry;
}

export function timeOut(note) {
  const entries = readEntries();
  const open = entries.find((e) => !e.timeOut);
  if (!open) {
    throw new Error("Not currently clocked in");
  }
  const now = new Date().toISOString();
  open.timeOut = now;
  open.hours = computeHours(open.timeIn, now);
  if (note) {
    open.note = note;
  }
  writeEntries(entries);
  return open;
}

export function updateEntry(id, { timeIn: newTimeIn, timeOut: newTimeOut, note }) {
  const entries = readEntries();
  const entry = entries.find((e) => e.id === id);
  if (!entry) throw new Error("Entry not found");

  if (newTimeIn) entry.timeIn = newTimeIn;
  if (newTimeOut !== undefined) entry.timeOut = newTimeOut;
  if (note !== undefined) entry.note = note;
  entry.date = entry.timeIn.slice(0, 10);
  entry.hours = computeHours(entry.timeIn, entry.timeOut);

  writeEntries(entries);
  return entry;
}

export function deleteEntry(id) {
  const entries = readEntries();
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) {
    throw new Error("Entry not found");
  }
  writeEntries(next);
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCSV() {
  const entries = readEntries();
  entries.sort((a, b) => new Date(a.timeIn) - new Date(b.timeIn));

  const header = ["Date", "Time In", "Time Out", "Hours", "Note"];
  const rows = entries.map((e) => [
    e.date,
    e.timeIn ? new Date(e.timeIn).toLocaleTimeString() : "",
    e.timeOut ? new Date(e.timeOut).toLocaleTimeString() : "",
    e.hours ?? "",
    e.note ?? "",
  ]);
  const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);
  rows.push([]);
  rows.push(["", "", "Total", Math.round(totalHours * 100) / 100, ""]);

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `time-log-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
